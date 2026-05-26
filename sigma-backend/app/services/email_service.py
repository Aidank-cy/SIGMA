import asyncio
import logging
import smtplib
from email.message import EmailMessage
from html import escape

import resend

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_verification_email(to: str, code: str, purpose: str) -> None:
    """Send a verification code email through the configured delivery provider."""
    subject, intro = _email_copy(purpose)
    html = _verification_email_html(intro, code)

    if settings.resend_api_key:
        await _send_resend_email(to, subject, html)
        return

    if settings.smtp_host:
        await asyncio.to_thread(_send_smtp_email, to, subject, intro, html)
        return

    logger.warning(
        "No email service configured (set SMTP_HOST or RESEND_API_KEY). Code for %s: %s",
        to,
        code,
    )


async def _send_resend_email(to: str, subject: str, html: str) -> None:
    """Send an HTML email through Resend."""
    resend.api_key = settings.resend_api_key
    params: resend.Emails.SendParams = {
        "from": settings.email_from,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    await resend.Emails.send_async(params)


def _send_smtp_email(to: str, subject: str, intro: str, html: str) -> None:
    """Send an HTML email through SMTP."""
    message = EmailMessage()
    message["From"] = settings.email_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(
        f"SIGMA\n\n{intro}\n\nThis code expires in 10 minutes. "
        "Security note: SIGMA will never ask for this code outside the verification flow. "
        "If you did not initiate this request, please ignore this email. "
        "This code will expire in 10 minutes."
    )
    message.add_alternative(html, subtype="html")

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(message)


def _verification_email_html(intro: str, code: str) -> str:
    safe_code = escape(code)
    safe_intro = escape(intro)
    return (
        "<div style=\"font-family:Arial,sans-serif;line-height:1.6;color:#111827;"
        "max-width:560px;margin:0 auto;padding:24px\">"
        "<h1 style=\"font-size:24px;margin:0 0 16px;color:#111827\">SIGMA</h1>"
        f"<p style=\"margin:0 0 16px\">{safe_intro}</p>"
        f"<p style=\"font-size:32px;font-weight:700;letter-spacing:6px;"
        f"margin:20px 0;color:#111827\">{safe_code}</p>"
        "<p style=\"margin:0 0 12px\">This code will expire in 10 minutes.</p>"
        "<p style=\"margin:0 0 12px;color:#4b5563\">Security note: SIGMA will never ask "
        "for this code outside the verification flow.</p>"
        "<p style=\"margin:0;color:#4b5563\">If you did not initiate this request, "
        "please ignore this email. This code will expire in 10 minutes.</p>"
        "</div>"
    )


def _email_copy(purpose: str) -> tuple[str, str]:
    if purpose == "registration":
        return (
            "SIGMA — Verify Your Email",
            "Welcome to SIGMA! Please enter the following verification code to complete "
            "your account registration:",
        )
    if purpose == "password_reset":
        return (
            "SIGMA — Password Reset Code",
            "You requested a password reset for your SIGMA account. Please enter the "
            "following verification code to proceed:",
        )
    raise ValueError(f"Unsupported verification email purpose: {purpose}")
