from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")

    app_name: str = "SIGMA"
    app_version: str = "1.0.0"
    database_url: str = "postgresql+asyncpg://sigma:sigma@sigma-postgres:5432/sigma"
    redis_url: str = "redis://sigma-redis:6379/0"
    frontend_url: str = "http://localhost:3000"
    default_locale: str = "zh"
    jwt_secret_key: str = "change-me-to-random-32-chars-minimum"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 7
    login_rate_limit_per_minute: int = 10
    general_rate_limit_per_minute: int = 120
    default_retention_days: int = 30
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    deepseek_api_key: str = ""
    qwen_api_key: str = ""
    resend_api_key: str = ""
    email_from: str = "SIGMA <noreply@sigma.app>"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    default_llm_provider: str = "anthropic"
    default_llm_model: str = "claude-sonnet-4-20250514"
    daily_token_limit: int = 1_000_000


settings = Settings()
