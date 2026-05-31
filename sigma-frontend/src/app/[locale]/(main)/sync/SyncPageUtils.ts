import { Code, Database, Rss } from "lucide-react";

import type { AdminLogResponse, CollectorStatus } from "@/hooks/useAdmin";
import type { Category, DataSource, Market, SourcePayload } from "@/lib/types";

export type LogFilter = CollectorStatus | "all";
export interface SourcePreviewResponse { items: Record<string, unknown>[]; }

export const sourceTypes = ["rss", "api", "scraper"] as const;
export const categories: Category[] = ["politics", "finance", "technology", "macro", "other"];
export const markets: Market[] = ["us", "cn", "hk", "jp", "eu", "kr", "tw", "global"];
export const regionColumns: Market[] = ["us", "cn", "hk", "jp", "eu", "kr", "tw", "global"];
export const marketFilters: Array<Market | ""> = ["", ...regionColumns];
export const statuses: LogFilter[] = ["all", "success", "fail", "timeout"];

export const initialPayload: SourcePayload = {
  category: "finance",
  config: { feed_url: "" },
  is_active: true,
  market: "us",
  max_execution_seconds: 60,
  name: "",
  schedule_cron: "0 * * * *",
  source_type: "rss"
};

export function todayStart() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

export function formatRelative(date: string | undefined, locale: string) {
  if (!date) return null;
  const minutes = Math.round((new Date(date).getTime() - Date.now()) / 60000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}

export function sourceIcon(type: DataSource["source_type"]) {
  if (type === "rss") return Rss;
  if (type === "scraper") return Code;
  return Database;
}

export function defaultConfig(type: SourcePayload["source_type"]): Record<string, unknown> {
  if (type === "api") return { endpoint: "", items_path: "" };
  if (type === "scraper") return { item_selector: "", url: "" };
  return { feed_url: "" };
}

export function sourceConfigComplete(payload: SourcePayload) {
  if (!payload.name.trim()) return false;
  if (payload.source_type === "rss") return Boolean(String(payload.config.feed_url ?? "").trim());
  if (payload.source_type === "api") return Boolean(String(payload.config.endpoint ?? "").trim());
  return Boolean(String(payload.config.url ?? "").trim() && String(payload.config.item_selector ?? "").trim());
}

export function normalizeMarket(market: Market): Market {
  return regionColumns.includes(market) ? market : "global";
}

const friendlyErrorRules: Array<[string[], string]> = [
  [["401", "unauthorized"], "Authentication failed (401) - check API key or token"],
  [["403", "forbidden"], "Access denied (403) - source is blocking requests"],
  [["404", "not found"], "URL not found (404) - feed or endpoint may have moved"],
  [["429", "too many"], "Rate limited (429) - increase collection interval"],
  [["500", "502", "503", "504"], "Source server error (5xx) - try again later"],
  [["timed out", "timeout", "connecttimeout"], "Connection timed out - source is too slow, try increasing timeout"],
  [["name or service not known", "nodename nor servname", "getaddrinfo"], "DNS lookup failed - check URL for typos"],
  [["connection refused"], "Connection refused - source server is not reachable"],
  [["ssl", "certificate"], "SSL certificate error - source has an invalid certificate"],
  [["jsondecodeerror", "expecting value"], "Invalid JSON response - check endpoint URL and items path"],
  [["not well-formed", "xml"], "Invalid RSS feed - URL may not point to a valid feed"],
  [["lock already held"], "Collection conflict - previous run still in progress"]
];

export function friendlyError(raw: string | null): string {
  if (!raw) return "Unknown error - check data source configuration";
  const s = raw.toLowerCase();
  const matched = friendlyErrorRules.find(([patterns]) => patterns.some((pattern) => s.includes(pattern)));
  if (matched) return matched[1];
  return raw.length > 80 ? `${raw.slice(0, 80)}...` : raw;
}

export function buildMockLogResponse(sources: DataSource[], filters: { dateFrom: string; dateTo: string; page: number; sourceId: string; status: LogFilter }): AdminLogResponse {
  const now = Date.now();
  const visibleSources = filters.sourceId ? sources.filter((source) => source.id === filters.sourceId) : sources;
  const baseSources = visibleSources.length > 0 ? visibleSources : sources.slice(0, 1);
  const allItems = baseSources.flatMap((source, sourceIndex) => Array.from({ length: 4 }).map((_, index) => {
    const status = (["success", "success", "fail", "timeout"] as CollectorStatus[])[(index + sourceIndex) % 4];
    return { duration_ms: 520 + index * 180 + sourceIndex * 90, error_message: status === "success" ? null : status === "timeout" ? "Collection exceeded the configured timeout." : "The source returned an invalid response.", executed_at: new Date(now - (index + sourceIndex * 2) * 55 * 60_000).toISOString(), id: `mock-${source.id}-${index}`, items_count: status === "success" ? 12 + index * 3 : 0, source_id: source.id, source_name: source.name, status };
  }));
  const startTime = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00Z`).getTime() : Number.NEGATIVE_INFINITY;
  const endTime = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59Z`).getTime() : Number.POSITIVE_INFINITY;
  const filtered = allItems.filter((item) => filters.status === "all" || item.status === filters.status).filter((item) => {
    const executedAt = new Date(item.executed_at).getTime();
    return executedAt >= startTime && executedAt <= endTime;
  }).sort((left, right) => new Date(right.executed_at).getTime() - new Date(left.executed_at).getTime());
  const pageSize = 12;
  const start = (filters.page - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);
  const successCount = filtered.filter((item) => item.status === "success").length;
  return { has_next: start + pageSize < filtered.length, items: pageItems, page: filters.page, page_size: pageSize, success_rate: filtered.length === 0 ? 0 : successCount / filtered.length, total: filtered.length };
}
