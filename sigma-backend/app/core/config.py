from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")

    app_name: str = "SIGMA"
    app_version: str = "0.1.0"
    database_url: str = "postgresql+asyncpg://sigma:sigma@sigma-postgres:5432/sigma"
    redis_url: str = "redis://sigma-redis:6379/0"
    default_locale: str = "zh"


settings = Settings()
