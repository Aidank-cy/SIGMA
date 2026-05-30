from fastapi import APIRouter, Cookie, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
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
from app.services import auth_flow_service
from app.services.email_service import send_verification_email
from app.utils.redis_lock import create_redis_client

router = APIRouter(prefix="/auth")


@router.post(
    "/register", response_model=UserRegistrationResponse, status_code=status.HTTP_201_CREATED
)
async def register(
    payload: UserCreate,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> UserRegistrationResponse:
    """Register a user, promoting the first account to admin, and issue JWT credentials."""
    return await auth_flow_service.register(payload, response, db)


@router.post(
    "/request-registration-code",
    response_model=MessageResponse,
    response_model_exclude_none=True,
)
async def request_registration_code(
    payload: RegistrationCodeRequest,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Send an email verification code before creating a new account."""
    return await auth_flow_service.request_registration_code(
        payload, db, create_redis_client, send_verification_email
    )


@router.post(
    "/verify-registration",
    response_model=UserRegistrationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def verify_registration(
    payload: RegistrationCodeVerify,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> UserRegistrationResponse:
    """Verify a registration code, create the account, and issue JWT credentials."""
    return await auth_flow_service.verify_registration(payload, response, db, create_redis_client)


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: UserLogin,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Authenticate a user and return JWT credentials."""
    return await auth_flow_service.login(payload, response, db)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_token_cookie: str | None = Cookie(default=None, alias="refresh_token"),
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Refresh an access token from the httpOnly cookie."""
    return await auth_flow_service.refresh_token(refresh_token_cookie, db)


@router.post(
    "/request-password-reset",
    response_model=MessageResponse,
    response_model_exclude_none=True,
)
async def request_password_reset(
    payload: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Generate a password reset verification code without exposing account existence."""
    return await auth_flow_service.request_password_reset(
        payload, db, create_redis_client, send_verification_email
    )


@router.post("/verify-reset-code", response_model=PasswordResetTokenResponse)
async def verify_reset_code(
    payload: PasswordResetVerify,
    db: AsyncSession = Depends(get_db),
) -> PasswordResetTokenResponse:
    """Verify a reset code and return a temporary reset token."""
    return await auth_flow_service.verify_reset_code(payload, db, create_redis_client)


@router.post("/reset-password", response_model=MessageResponse, response_model_exclude_none=True)
async def reset_password(
    payload: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Reset a password with a verified temporary reset token."""
    return await auth_flow_service.reset_password(payload, db, create_redis_client)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> User:
    """Return the authenticated user."""
    return current_user
