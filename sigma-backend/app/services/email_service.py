from html import escape

import resend

from app.core.config import settings


async def send_verification_email(to: str, code: str, purpose: str) -> None:
    """Send a verification code email through Resend."""
    if not settings.resend_api_key:
        raise RuntimeError("Resend API key is not configured")

    subject, intro = _email_copy(purpose)
    safe_code = escape(code)
    safe_intro = escape(intro)
    resend.api_key = settings.resend_api_key
    params: resend.Emails.SendParams = {
        "from": settings.email_from,
        "to": [to],
        "subject": subject,
        "html": (
            "<div style=\"font-family:Arial,sans-serif;line-height:1.6;color:#111827\">"
            f"<p>{safe_intro}</p>"
            f"<p style=\"font-size:28px;font-weight:700;letter-spacing:6px\">{safe_code}</p>"
            "<p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>"
            "</div>"
        ),
    }
    await resend.Emails.send_async(params)


def _email_copy(purpose: str) -> tuple[str, str]:
    if purpose == "registration":
        return ("Verify your SIGMA account", "Use this code to finish creating your SIGMA account.")
    if purpose == "password_reset":
        return ("Reset your SIGMA password", "Use this code to reset your SIGMA password.")
    raise ValueError(f"Unsupported verification email purpose: {purpose}")
