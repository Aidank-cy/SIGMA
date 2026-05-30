import logging
from email.message import EmailMessage
from typing import Any

import pytest

from app.core.config import settings
from app.services import email_service


@pytest.mark.asyncio
async def test_send_verification_email_uses_resend_when_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Resend remains the first configured email delivery path."""
    sent: dict[str, Any] = {}

    async def fake_send_async(params: dict[str, Any]) -> None:
        sent.update(params)

    monkeypatch.setattr(settings, "resend_api_key", "re_test")
    monkeypatch.setattr(settings, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(email_service.resend.Emails, "send_async", fake_send_async)

    result = await email_service.send_verification_email(
        "user@example.com", "123456", "registration"
    )

    assert result is None
    assert sent["to"] == ["user@example.com"]
    assert sent["subject"] == "SIGMA — Verify Your Email"
    assert "Welcome to SIGMA!" in sent["html"]
    assert "123456" in sent["html"]
    assert "If you did not initiate this request" in sent["html"]


@pytest.mark.asyncio
async def test_send_verification_email_uses_smtp_when_resend_is_not_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """SMTP sends the same contextual verification email when Resend is absent."""
    smtp_calls: dict[str, Any] = {}

    class FakeSMTP:
        def __init__(self, host: str, port: int, timeout: int) -> None:
            smtp_calls["host"] = host
            smtp_calls["port"] = port
            smtp_calls["timeout"] = timeout

        def __enter__(self) -> "FakeSMTP":
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def starttls(self) -> None:
            smtp_calls["tls"] = True

        def login(self, user: str, password: str) -> None:
            smtp_calls["login"] = (user, password)

        def send_message(self, message: EmailMessage) -> None:
            smtp_calls["message"] = message

    monkeypatch.setattr(settings, "resend_api_key", "")
    monkeypatch.setattr(settings, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(settings, "smtp_port", 2525)
    monkeypatch.setattr(settings, "smtp_user", "smtp-user")
    monkeypatch.setattr(settings, "smtp_password", "smtp-password")
    monkeypatch.setattr(settings, "smtp_use_tls", True)
    monkeypatch.setattr(email_service.smtplib, "SMTP", FakeSMTP)

    result = await email_service.send_verification_email(
        "user@example.com", "654321", "password_reset"
    )

    assert result is None
    message = smtp_calls["message"]
    assert smtp_calls["host"] == "smtp.example.com"
    assert smtp_calls["port"] == 2525
    assert smtp_calls["tls"] is True
    assert smtp_calls["login"] == ("smtp-user", "smtp-password")
    assert message["To"] == "user@example.com"
    assert message["Subject"] == "SIGMA — Password Reset Code"
    html_body = message.get_body(preferencelist=("html",)).get_content()
    assert "You requested a password reset" in html_body
    assert "654321" in html_body


@pytest.mark.asyncio
async def test_send_verification_email_returns_code_when_no_delivery_is_configured(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Missing email configuration returns the code and logs an explicit warning."""
    monkeypatch.setattr(settings, "resend_api_key", "")
    monkeypatch.setattr(settings, "smtp_host", "")

    with caplog.at_level(logging.WARNING):
        result = await email_service.send_verification_email(
            "user@example.com", "111222", "registration"
        )

    assert result == "111222"
    assert "No email service configured" in caplog.text
    assert "SMTP_HOST" in caplog.text
    assert "RESEND_API_KEY" in caplog.text
    assert "user@example.com" in caplog.text
    assert "111222" in caplog.text
