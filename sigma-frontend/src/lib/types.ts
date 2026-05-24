export type Category = "politics" | "finance" | "technology" | "macro" | "other";

export type Market = "us" | "cn" | "jp" | "eu" | "hk" | "kr" | "tw" | "global";

export type ReportType = "daily" | "weekly" | "monthly";

export type Locale = "zh" | "en";

export interface TradingHours {
  open: string;
  close: string;
  beijing_sessions?: Array<{ open: string; close: string }>;
  sessions: Array<{ open: string; close: string }>;
  timezone: string;
}

export interface MarketIndex {
  symbol: string;
  name: string;
  value: number;
  previous_close: number;
  change_pct: number;
  market: Market;
  currency: string;
  is_trading: boolean;
  is_fallback_data: boolean;
  trading_hours: TradingHours;
  sparkline_24h: number[];
  sparkline_times: string[];
  sparkline_ranges?: Record<string, { values: number[]; times: string[] }>;
}

export interface MarketIndicesResponse {
  indices: MarketIndex[];
  updated_at?: string;
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

export interface LLMConfig {
  daily_token_limit: number;
  cost_guard_enabled: boolean;
  api_keys: LLMApiKey[];
}

export type LLMProvider = "anthropic" | "openai" | "deepseek" | "minimax" | "kimi" | "gemini";

export interface LLMApiKey {
  name: string;
  key: string;
  provider: LLMProvider;
  token_limit: number;
  is_default: boolean;
}

export interface LLMUsageDay {
  day: string;
  function_type: "summary" | "report";
  model?: string;
  provider?: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface LLMUsageResponse {
  items: LLMUsageDay[];
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
  category?: Category | string;
  date_from?: string;
  date_to?: string;
  market?: Market | string;
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
  report_frequencies?: ReportType[];
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
