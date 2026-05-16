from uuid import uuid4

from app.models.enums import UserRole
from app.services.auth_service import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_password_hash_verify_roundtrip() -> None:
    """Password hashes verify the source password only."""
    hashed_password = hash_password("StrongPass1")

    assert verify_password("StrongPass1", hashed_password)
    assert not verify_password("WrongPass1", hashed_password)


def test_create_and_decode_tokens() -> None:
    """JWT helpers encode expected access and refresh claims."""
    user_id = uuid4()

    access_payload = decode_token(create_access_token(user_id, UserRole.ADMIN, "admin@example.com"))
    refresh_payload = decode_token(create_refresh_token(user_id))

    assert access_payload["sub"] == str(user_id)
    assert access_payload["role"] == UserRole.ADMIN.value
    assert access_payload["email"] == "admin@example.com"
    assert access_payload["type"] == "access"
    assert refresh_payload["sub"] == str(user_id)
    assert refresh_payload["type"] == "refresh"
