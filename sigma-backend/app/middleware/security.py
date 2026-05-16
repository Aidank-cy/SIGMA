from time import monotonic
from typing import Any

from fastapi import Request, Response, status
from jose import JWTError
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse

from app.core.config import settings
from app.services.auth_service import decode_token


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Attach baseline browser security headers to every response."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("X-XSS-Protection", "1; mode=block")
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Apply lightweight per-minute API throttles."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.url.path.startswith("/api/v1/"):
            limiter = _LimiterStore.for_request(request.app.state)
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
        store = getattr(state, "rate_limiter", None)
        if store is None:
            store = cls()
            state.rate_limiter = store
        return store

    def allow(self, key: str, limit: int) -> bool:
        now = monotonic()
        start, count = self._windows.get(key, (now, 0))
        if now - start >= 60:
            start, count = now, 0
        count += 1
        self._windows[key] = (start, count)
        return count <= limit


def _rate_identity(request: Request) -> str:
    authorization = request.headers.get("Authorization", "")
    if authorization.startswith("Bearer "):
        try:
            payload = decode_token(authorization.removeprefix("Bearer ").strip())
            subject = payload.get("sub")
            if subject:
                return f"user:{subject}"
        except JWTError:
            pass
    return f"ip:{_client_ip(request)}"


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    if forwarded_for:
        return forwarded_for.split(",", maxsplit=1)[0].strip()
    if request.client is None:
        return "unknown"
    return request.client.host


def _too_many_requests() -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": "Rate limit exceeded"},
        headers={"Retry-After": "60"},
    )
