import hmac
import logging
import secrets
from uuid import UUID

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from jose import JWTError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import (
    MessageResponse,
    PasswordResetConfirm,
    PasswordResetRequest,
    PasswordResetTokenResponse,
    PasswordResetVerify,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserRegistrationResponse,
    UserResponse,
)
from app.services.auth_service import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.utils.redis_lock import create_redis_client

router = APIRouter(prefix="/auth")
logger = logging.getLogger(__name__)

PASSWORD_RESET_TTL_SECONDS = 10 * 60
PASSWORD_RESET_TOKEN_SECONDS = 5 * 60


@router.post("/register", response_model=UserRegistrationResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: UserCreate,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> UserRegistrationResponse:
    """Register a user, promoting the first account to admin, and issue JWT credentials."""
    email = str(payload.email).lower()
    existing_user = await db.scalar(select(User).where(User.email == email))
    if existing_user is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user_count = await db.scalar(select(func.count()).select_from(User))
    role = UserRole.ADMIN if user_count == 0 else UserRole.USER
    user = User(
        email=email,
        hashed_password=hash_password(payload.password),
        display_name=payload.display_name,
        locale=payload.locale,
        role=role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    token = _issue_tokens(user, response)
    return UserRegistrationResponse(**UserResponse.model_validate(user).model_dump(), **token.model_dump())


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: UserLogin,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Authenticate a user and return JWT credentials."""
    email = str(payload.email).lower()
    user = await db.scalar(select(User).where(User.email == email))
    if user is None or not user.is_active or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    return _issue_tokens(user, response)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_token_cookie: str | None = Cookie(default=None, alias="refresh_token"),
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Refresh an access token from the httpOnly cookie."""
    if refresh_token_cookie is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")

    try:
        payload = decode_token(refresh_token_cookie)
        if payload.get("type") != "refresh":
            raise JWTError("Unexpected token type")
        user_id = UUID(str(payload["sub"]))
    except (KeyError, ValueError, JWTError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc

    user = await db.scalar(select(User).where(User.id == user_id))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive or missing user")

    return TokenResponse(
        access_token=create_access_token(user.id, user.role, user.email),
        expires_in=60 * 15,
    )


@router.post("/request-password-reset", response_model=MessageResponse)
async def request_password_reset(
    payload: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Generate a password reset verification code without exposing account existence."""
    email = str(payload.email).lower()
    user = await db.scalar(select(User).where(User.email == email))
    if user is not None and user.is_active:
        code = f"{secrets.randbelow(1_000_000):06d}"
        client = create_redis_client()
        try:
            await client.set(_password_reset_key(email), code, ex=PASSWORD_RESET_TTL_SECONDS)
        finally:
            await client.aclose()
        # TODO: integrate email service like SendGrid or Resend
        logger.info("Password reset code for %s: %s", email, code)
    return MessageResponse(message="verification code sent")


@router.post("/verify-reset-code", response_model=PasswordResetTokenResponse)
async def verify_reset_code(
    payload: PasswordResetVerify,
    db: AsyncSession = Depends(get_db),
) -> PasswordResetTokenResponse:
    """Verify a reset code and return a temporary reset token."""
    email = str(payload.email).lower()
    client = create_redis_client()
    try:
        stored_code = await client.get(_password_reset_key(email))
    finally:
        await client.aclose()
    if stored_code is None or not hmac.compare_digest(str(stored_code), payload.code):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid verification code")

    user = await db.scalar(select(User).where(User.email == email))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid verification code")

    return PasswordResetTokenResponse(
        reset_token=create_password_reset_token(user.id, user.email),
        expires_in=PASSWORD_RESET_TOKEN_SECONDS,
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    payload: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Reset a password with a verified temporary reset token."""
    try:
        token_payload = decode_token(payload.reset_token)
        if token_payload.get("type") != "password_reset":
            raise JWTError("Unexpected token type")
        user_id = UUID(str(token_payload["sub"]))
        email = str(token_payload["email"]).lower()
    except (KeyError, ValueError, JWTError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid reset token") from exc

    user = await db.scalar(select(User).where(User.id == user_id, User.email == email))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid reset token")

    user.hashed_password = hash_password(payload.new_password)
    client = create_redis_client()
    try:
        await client.delete(_password_reset_key(email))
    finally:
        await client.aclose()
    await db.commit()
    return MessageResponse(message="password reset")


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> User:
    """Return the authenticated user."""
    return current_user


def _password_reset_key(email: str) -> str:
    return f"pwd_reset:{email}"


def _issue_tokens(user: User, response: Response) -> TokenResponse:
    access_token = create_access_token(user.id, user.role, user.email)
    refresh_token = create_refresh_token(user.id)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        path="/",
        max_age=60 * 60 * 24 * 7,
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=60 * 15,
    )
