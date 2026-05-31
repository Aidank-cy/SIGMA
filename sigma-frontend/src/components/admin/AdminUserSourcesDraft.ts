import type { DataSource, SourcePayload } from "@/lib/types";

export async function persistSourceDraft({
  baselineSources,
  createSource,
  deleteSource,
  draftSources,
  updateSource
}: {
  baselineSources: DataSource[];
  createSource: (source: DataSource) => Promise<unknown>;
  deleteSource: (sourceId: string) => Promise<unknown>;
  draftSources: DataSource[];
  updateSource: (source: DataSource) => Promise<unknown>;
}) {
  const draftById = new Map(draftSources.map((source) => [source.id, source]));
  const baselineById = new Map(baselineSources.map((source) => [source.id, source]));

  for (const source of baselineSources) {
    if (!draftById.has(source.id)) {
      await deleteSource(source.id);
    }
  }

  for (const source of draftSources) {
    if (isDraftSource(source)) {
      await createSource(source);
      continue;
    }
    const baseline = baselineById.get(source.id);
    if (baseline && !dataSourcesEqual(source, baseline)) {
      await updateSource(source);
    }
  }
}

export function draftSourceFromPayload(payload: SourcePayload, userId: string): DataSource {
  return {
    ...payload,
    created_by: userId,
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    is_system: false
  };
}

export function sourcePayloadFromSource(source: DataSource): SourcePayload {
  return {
    category: source.category,
    config: source.config ?? defaultConfig(source.source_type),
    is_active: source.is_active,
    market: source.market,
    max_execution_seconds: source.max_execution_seconds ?? 60,
    name: source.name,
    schedule_cron: source.schedule_cron ?? "0 * * * *",
    source_type: source.source_type
  };
}

export function isDraftSource(source: DataSource) {
  return source.id.startsWith("draft-");
}

export function dataSourceListsEqual(left: DataSource[], right: DataSource[]) {
  if (left.length !== right.length) {
    return false;
  }
  const rightById = new Map(right.map((source) => [source.id, source]));
  return left.every((source) => {
    const other = rightById.get(source.id);
    return other !== undefined && dataSourcesEqual(source, other);
  });
}

function dataSourcesEqual(left: DataSource, right: DataSource) {
  return (
    left.name === right.name &&
    left.source_type === right.source_type &&
    left.category === right.category &&
    left.market === right.market &&
    (left.schedule_cron ?? "0 * * * *") === (right.schedule_cron ?? "0 * * * *") &&
    (left.max_execution_seconds ?? 60) === (right.max_execution_seconds ?? 60) &&
    left.is_active === right.is_active &&
    stableStringify(left.config ?? {}) === stableStringify(right.config ?? {})
  );
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${key}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function defaultConfig(type: SourcePayload["source_type"]): Record<string, unknown> {
  if (type === "api") {
    return { endpoint: "", items_path: "" };
  }
  if (type === "scraper") {
    return { item_selector: "", url: "" };
  }
  return { feed_url: "" };
}
