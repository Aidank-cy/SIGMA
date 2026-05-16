from app.collectors.api_collector import APICollector
from app.collectors.base import BaseCollector
from app.collectors.rss_collector import RSSCollector
from app.collectors.scraper_collector import ScraperCollector
from app.models.data_source import DataSource
from app.models.enums import SourceType

COLLECTORS: dict[SourceType, type[BaseCollector]] = {
    SourceType.API: APICollector,
    SourceType.RSS: RSSCollector,
    SourceType.SCRAPER: ScraperCollector,
}


def create_collector(source: DataSource) -> BaseCollector:
    """Create a collector for the source type."""
    try:
        collector_cls = COLLECTORS[source.source_type]
    except KeyError as exc:
        raise ValueError(f"Unsupported source type: {source.source_type}") from exc
    return collector_cls(source)
