from time import monotonic
from typing import Any

from fastapi import Request, Response, status
from jose import JWTError
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse

from app.core.config import settings
from app.services.auth_service import decode_token

CONTENT_SECURITY_POLICY = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "img-src 'self' data: https://fastapi.tiangolo.com; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; "
    "object-src 'none'; "
    "base-uri 'self'; "
    "form-action 'self'"
)
AUTH_SCHEME_PREFIX = "Bearer "
RATE_LIMIT_WINDOW_SECONDS = 60
RETRY_AFTER_HEADER_SECONDS = "60"
WWW_AUTHENTICATE_BEARER = "Bearer"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Attach baseline browser security headers to every response."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """Apply security headers after downstream request handling."""
        response = await call_next(request)
        return apply_security_headers(response)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Apply lightweight per-minute API throttles."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """Reject invalid or over-limit API requests before routing."""
        if request.url.path.startswith("/api/v1/"):
            if request.method == "OPTIONS":
                return await call_next(request)
            limiter = _LimiterStore.for_request(request.app.state)
            authorization = request.headers.get("Authorization", "")
            if authorization.startswith(AUTH_SCHEME_PREFIX) and not _has_valid_bearer_token(
                authorization
            ):
                return _invalid_token()
            login_key = _client_ip(request)
            general_key = _rate_identity(request)
            if request.url.path == "/api/v1/auth/login" and not limiter.allow(
                f"login:{login_key}",
                settings.login_rate_limit_per_minute,
            ):
                return _too_many_requests()
            if not limiter.allow(
                f"general:{general_key}",
                settings.general_rate_limit_per_minute,
            ):
                return _too_many_requests()
        return await call_next(request)


class _LimiterStore:
    def __init__(self) -> None:
        self._windows: dict[str, tuple[float, int]] = {}

    @classmethod
    def for_request(cls, state: Any) -> "_LimiterStore":
        """Return the app-scoped limiter store for one request."""
        store = getattr(state, "rate_limiter", None)
        if store is None:
            store = cls()
            state.rate_limiter = store
        return store

    def allow(self, key: str, limit: int) -> bool:
        """Return whether a rate-limit key is still within its window."""
        now = monotonic()
        start, count = self._windows.get(key, (now, 0))
        if now - start >= RATE_LIMIT_WINDOW_SECONDS:
            start, count = now, 0
        count += 1
        self._windows[key] = (start, count)
        return count <= limit


def _rate_identity(request: Request) -> str:
    authorization = request.headers.get("Authorization", "")
    if authorization.startswith(AUTH_SCHEME_PREFIX):
        try:
            payload = decode_token(authorization.removeprefix(AUTH_SCHEME_PREFIX).strip())
            subject = payload.get("sub")
            if subject:
                return f"user:{subject}"
        except JWTError:
            pass
    return f"ip:{_client_ip(request)}"


def _has_valid_bearer_token(authorization: str) -> bool:
    try:
        decode_token(authorization.removeprefix(AUTH_SCHEME_PREFIX).strip())
    except JWTError:
        return False
    return True


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    if forwarded_for:
        return forwarded_for.split(",", maxsplit=1)[0].strip()
    if request.client is None:
        return "unknown"
    return request.client.host


def _too_many_requests() -> JSONResponse:
    response = JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": "Rate limit exceeded"},
        headers={"Retry-After": RETRY_AFTER_HEADER_SECONDS},
    )
    return apply_security_headers(response)


def _invalid_token() -> JSONResponse:
    response = JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"detail": "Invalid token"},
        headers={"WWW-Authenticate": WWW_AUTHENTICATE_BEARER},
    )
    return apply_security_headers(response)


def apply_security_headers(response: Response) -> Response:
    """Attach standard browser security headers to a response."""
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("X-XSS-Protection", "1; mode=block")
    response.headers.setdefault("Content-Security-Policy", CONTENT_SECURITY_POLICY)
    return response
