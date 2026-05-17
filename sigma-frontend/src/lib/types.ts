export type Category = "politics" | "finance" | "technology" | "macro" | "other";

export type Market = "us" | "cn" | "jp" | "eu" | "hk" | "global";

export type ReportType = "daily" | "weekly" | "monthly";

export type Locale = "zh" | "en";

export interface TradingHours {
  open: string;
  close: string;
  timezone: string;
}

export interface MarketIndex {
  symbol: string;
  name: string;
  value: number;
  change_pct: number;
  market: Market;
  currency: string;
  is_trading: boolean;
  trading_hours: TradingHours;
  sparkline_24h: number[];
}

export interface MarketIndicesResponse {
  indices: MarketIndex[];
  updated_at: string;
}

export type Sentiment = "bullish" | "bearish" | "neutral";

export interface SentimentStatsResponse {
  bullish_pct: number;
}

export interface TrendingKeyword {
  keyword: string;
  count: number;
}

export interface TrendingKeywordsResponse {
  items: TrendingKeyword[];
}

export interface LastCollectionResponse {
  last_success: string | null;
}

export interface PaginatedResponse<T> {
  page: number;
  page_size: number;
  total: number;
  has_next: boolean;
  items: T[];
}

export interface MinimalItem {
  id: string;
  title: string;
  summary: string | null;
  category: Category;
  market: Market;
  published_at: string;
}

export interface ItemSummary extends MinimalItem {
  content_url: string | null;
  collected_at: string;
  expires_at: string;
  source_id: string;
  source_name: string;
}

export interface ItemDetail extends ItemSummary {
  content_raw: string;
  metadata_extra: Record<string, unknown> | null;
  sentiment: Sentiment;
  keywords: string[];
  related: MinimalItem[];
}

export interface ItemFilters {
  category?: Category;
  date_from?: string;
  date_to?: string;
  market?: Market;
  keyword?: string;
  page_size?: number;
  source_id?: string;
}

export interface ReportSummary {
  id: string;
  report_type: ReportType;
  title: string;
  content: string;
  market_scope: Market[];
  category_scope: Category[];
  period_start: string;
  period_end: string;
  generated_at: string;
  item_count: number;
  sentiment_score: number;
}

export interface ReportDetail extends ReportSummary {}

export interface Watchlist {
  id: string;
  user_id: string;
  name: string;
  keywords: string[];
  sources: string[];
  markets: Market[];
  created_at: string;
  updated_at: string;
  item_count: number;
}

export interface WatchlistPayload {
  name: string;
  keywords: string[];
  sources: string[];
  markets: Market[];
}

export interface WatchlistStats {
  matches_today: number;
  bullish_pct: number;
}

export interface WatchlistTrendDay {
  date: string;
  count: number;
}

export interface WatchlistTrend {
  days: WatchlistTrendDay[];
}

export interface UserReportConfig {
  report_frequency: ReportType;
  markets: Market[];
  categories: Category[];
  is_active: boolean;
}

export interface DataSource {
  id: string;
  name: string;
  source_type: "api" | "rss" | "scraper";
  category: Category;
  market: Market;
  config?: Record<string, unknown>;
  schedule_cron?: string;
  max_execution_seconds?: number;
  is_active: boolean;
  is_system?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SourcePayload {
  name: string;
  source_type: "api" | "rss" | "scraper";
  category: Category;
  market: Market;
  config: Record<string, unknown>;
  schedule_cron: string;
  max_execution_seconds: number;
  is_active: boolean;
}
