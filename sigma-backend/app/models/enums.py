from enum import StrEnum


class UserRole(StrEnum):
    """Supported user roles."""

    ADMIN = "admin"
    USER = "user"


class UserLocale(StrEnum):
    """Supported UI locales."""

    ZH = "zh"
    EN = "en"


class SourceType(StrEnum):
    """Supported collector source types."""

    API = "api"
    RSS = "rss"
    SCRAPER = "scraper"


class IntelligenceCategory(StrEnum):
    """Supported intelligence categories."""

    POLITICS = "politics"
    FINANCE = "finance"
    TECHNOLOGY = "technology"
    MACRO = "macro"
    OTHER = "other"


class Market(StrEnum):
    """Supported market scopes."""

    US = "us"
    CN = "cn"
    JP = "jp"
    EU = "eu"
    HK = "hk"
    GLOBAL = "global"


class ReportType(StrEnum):
    """Supported report cadences."""

    DAILY = "daily"
    DAILY_MORNING = "daily_morning"
    DAILY_AFTERNOON = "daily_afternoon"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class CollectorStatus(StrEnum):
    """Supported collector execution statuses."""

    SUCCESS = "success"
    FAIL = "fail"
    TIMEOUT = "timeout"


class LLMFunctionType(StrEnum):
    """Supported LLM usage function types."""

    SUMMARY = "summary"
    REPORT = "report"
