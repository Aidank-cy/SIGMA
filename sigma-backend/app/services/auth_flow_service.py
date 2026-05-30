import hmac
import json
import logging
import secrets
from collections.abc import Awaitable, Callable
from uuid import UUID

from fastapi import HTTPException, Response, status
from jose import JWTError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import (
    MessageResponse,
    PasswordResetConfirm,
    PasswordResetRequest,
    PasswordResetTokenResponse,
    PasswordResetVerify,
    RegistrationCodeRequest,
    RegistrationCodeVerify,
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
from app.services.email_service import send_verification_email
from app.utils.redis_lock import create_redis_client

PASSWORD_RESET_TTL_SECONDS = 10 * 60
PASSWORD_RESET_TOKEN_SECONDS = 5 * 60
REGISTRATION_TTL_SECONDS = 10 * 60

RedisFactory = Callable[[], object]
EmailSender = Callable[[str, str, str], Awaitable[str | None]]

LOGGER = logging.getLogger(__name__)


async def register(
    payload: UserCreate, response: Response, db: AsyncSession
) -> UserRegistrationResponse:
    """Register a user, promote the first account to admin, and issue JWT credentials."""
    user = await _create_user(payload, db)
    token = _issue_tokens(user, response)
    return UserRegistrationResponse(
        **UserResponse.model_validate(user).model_dump(), **token.model_dump()
    )


async def request_registration_code(
    payload: RegistrationCodeRequest,
    db: AsyncSession,
    redis_factory: RedisFactory = create_redis_client,
    email_sender: EmailSender = send_verification_email,
) -> MessageResponse:
    """Send an email verification code before creating a new account."""
    email = str(payload.email).lower()
    existing_user = await db.scalar(select(User).where(User.email == email))
    if existing_user is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    code = f"{secrets.randbelow(1_000_000):06d}"
    client = redis_factory()
    try:
        await client.set(f"reg_verify:{email}", code, ex=REGISTRATION_TTL_SECONDS)
        await client.set(
            f"reg_payload:{email}",
            json.dumps(payload.model_dump(mode="json")),
            ex=REGISTRATION_TTL_SECONDS,
        )
    finally:
        await client.aclose()

    dev_code: str | None = None
    try:
        dev_code = await email_sender(email, code, "registration")
    except Exception as exc:
        LOGGER.warning("Failed to send registration code to %s: %s", email, exc)
        dev_code = code
    return MessageResponse(message="verification code sent", dev_code=dev_code)


async def verify_registration(
    payload: RegistrationCodeVerify,
    response: Response,
    db: AsyncSession,
    redis_factory: RedisFactory = create_redis_client,
) -> UserRegistrationResponse:
    """Verify a registration code, create the account, and issue JWT credentials."""
    email = str(payload.email).lower()
    client = redis_factory()
    try:
        stored_code = await client.get(f"reg_verify:{email}")
        stored_payload = await client.get(f"reg_payload:{email}")
    finally:
        await client.aclose()

    if (
        stored_code is None
        or stored_payload is None
        or not hmac.compare_digest(str(stored_code), payload.code)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid verification code"
        )

    registration_payload = RegistrationCodeRequest.model_validate(json.loads(str(stored_payload)))
    user = await _create_user(registration_payload, db)
    client = redis_factory()
    try:
        await client.delete(f"reg_verify:{email}", f"reg_payload:{email}")
    finally:
        await client.aclose()
    token = _issue_tokens(user, response)
    return UserRegistrationResponse(
        **UserResponse.model_validate(user).model_dump(), **token.model_dump()
    )


async def login(payload: UserLogin, response: Response, db: AsyncSession) -> TokenResponse:
    """Authenticate a user and return JWT credentials."""
    email = str(payload.email).lower()
    user = await db.scalar(select(User).where(User.email == email))
    if (
        user is None
        or not user.is_active
        or not verify_password(payload.password, user.hashed_password)
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return _issue_tokens(user, response)


async def refresh_token(refresh_token_cookie: str | None, db: AsyncSession) -> TokenResponse:
    """Refresh an access token from the httpOnly cookie."""
    if refresh_token_cookie is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token"
        )
    try:
        payload = decode_token(refresh_token_cookie)
        if payload.get("type") != "refresh":
            raise JWTError("Unexpected token type")
        user_id = UUID(str(payload["sub"]))
    except (KeyError, ValueError, JWTError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        ) from exc

    user = await db.scalar(select(User).where(User.id == user_id))
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive or missing user"
        )
    return TokenResponse(
        access_token=create_access_token(user.id, user.role, user.email),
        expires_in=60 * 15,
    )


async def request_password_reset(
    payload: PasswordResetRequest,
    db: AsyncSession,
    redis_factory: RedisFactory = create_redis_client,
    email_sender: EmailSender = send_verification_email,
) -> MessageResponse:
    """Generate a password reset verification code without exposing account existence."""
    email = str(payload.email).lower()
    user = await db.scalar(select(User).where(User.email == email))
    dev_code: str | None = None
    if user is not None and user.is_active:
        code = f"{secrets.randbelow(1_000_000):06d}"
        client = redis_factory()
        try:
            await client.set(f"pwd_reset:{email}", code, ex=PASSWORD_RESET_TTL_SECONDS)
        finally:
            await client.aclose()
        try:
            dev_code = await email_sender(email, code, "password_reset")
        except Exception as exc:
            LOGGER.warning("Failed to send password reset code to %s: %s", email, exc)
            dev_code = code
    return MessageResponse(message="verification code sent", dev_code=dev_code)


async def verify_reset_code(
    payload: PasswordResetVerify,
    db: AsyncSession,
    redis_factory: RedisFactory = create_redis_client,
) -> PasswordResetTokenResponse:
    """Verify a reset code and return a temporary reset token."""
    email = str(payload.email).lower()
    client = redis_factory()
    try:
        stored_code = await client.get(f"pwd_reset:{email}")
    finally:
        await client.aclose()
    if stored_code is None or not hmac.compare_digest(str(stored_code), payload.code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid verification code"
        )

    user = await db.scalar(select(User).where(User.email == email))
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid verification code"
        )
    return PasswordResetTokenResponse(
        reset_token=create_password_reset_token(user.id, user.email),
        expires_in=PASSWORD_RESET_TOKEN_SECONDS,
    )


async def reset_password(
    payload: PasswordResetConfirm,
    db: AsyncSession,
    redis_factory: RedisFactory = create_redis_client,
) -> MessageResponse:
    """Reset a password with a verified temporary reset token."""
    try:
        token_payload = decode_token(payload.reset_token)
        if token_payload.get("type") != "password_reset":
            raise JWTError("Unexpected token type")
        user_id = UUID(str(token_payload["sub"]))
        email = str(token_payload["email"]).lower()
    except (KeyError, ValueError, JWTError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid reset token"
        ) from exc

    user = await db.scalar(select(User).where(User.id == user_id, User.email == email))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid reset token")

    user.hashed_password = hash_password(payload.new_password)
    client = redis_factory()
    try:
        await client.delete(f"pwd_reset:{email}")
    finally:
        await client.aclose()
    await db.commit()
    return MessageResponse(message="password reset")


async def _create_user(payload: UserCreate, db: AsyncSession) -> User:
    email = str(payload.email).lower()
    existing_user = await db.scalar(select(User).where(User.email == email))
    if existing_user is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    admin_count = await db.scalar(
        select(func.count()).select_from(User).where(User.role == UserRole.ADMIN)
    )
    role = UserRole.ADMIN if admin_count == 0 else UserRole.USER
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
    return user


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
