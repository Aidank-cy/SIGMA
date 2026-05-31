"use client";

import { Code, Database, Pencil, Rss, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { CustomSelect } from "@/components/dashboard/custom-select";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import type { Category, DataSource, Market, SourcePayload } from "@/lib/types";

import { defaultConfig } from "./AdminUserSourcesDraft";

const sourceTypes = ["rss", "api", "scraper"] as const;
export const categories: Category[] = ["politics", "finance", "technology", "macro", "other"];
export const markets: Market[] = ["us", "cn", "hk", "jp", "eu", "kr", "tw", "global"];

interface SourceCardProps { onDelete: () => void; onEdit: () => void; onToggle: (checked: boolean) => void; source: DataSource; }
interface SourceFormProps { isSaving: boolean; onSave: () => void; payload: SourcePayload; setPayload: (payload: Partial<SourcePayload>) => void; }
interface IconButtonProps { children: ReactNode; label: string; onClick: () => void; }

export function SourceCard({ onDelete, onEdit, onToggle, source }: SourceCardProps) {
  const t = useTranslations("sync");
  const Icon = source.source_type === "rss" ? Rss : source.source_type === "scraper" ? Code : Database;
  return (
    <div className="rounded-xl border border-border bg-secondary p-3">
      <div className="flex items-start gap-3">
        <Icon className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-bold text-foreground">{source.name}</p>
            <span className="rounded-2xl bg-card px-2 py-0.5 text-xs font-bold text-muted-foreground">{t(`sources.types.${source.source_type}`)}</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{t(`sources.categories.${source.category}`)} · {t(`sources.markets.${source.market}`)} · {source.schedule_cron ?? "0 * * * *"}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{sourceConfigSummary(source)}</p>
        </div>
        <ToggleSwitch checked={source.is_active} label={t("sources.toggleSource", { name: source.name })} onChange={onToggle} />
      </div>
      <div className="mt-3 flex justify-end gap-1">
        <IconButton label={t("configure")} onClick={onEdit}><Pencil className="h-4 w-4" aria-hidden /></IconButton>
        <IconButton label={t("sources.delete")} onClick={onDelete}><Trash2 className="h-4 w-4" aria-hidden /></IconButton>
      </div>
    </div>
  );
}

export function SourceForm({ isSaving, onSave, payload, setPayload }: SourceFormProps) {
  const t = useTranslations("sync");
  const setConfig = (key: string, value: string) => setPayload({ config: { ...payload.config, [key]: value } });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label={t("sources.name")} labelMode="stacked" onChange={(event) => setPayload({ name: event.target.value })} value={payload.name} />
        <CustomSelect label={t("sources.type")} labelMode="stacked" onChange={(value) => setPayload({ config: defaultConfig(value as SourcePayload["source_type"]), source_type: value as SourcePayload["source_type"] })} options={sourceTypes.map((type) => ({ label: t(`sources.types.${type}`), value: type }))} value={payload.source_type} />
      </div>
      {payload.source_type === "rss" ? <Input label={t("sources.fields.feedUrl")} labelMode="stacked" onChange={(event) => setConfig("feed_url", event.target.value)} value={String(payload.config.feed_url ?? "")} /> : null}
      {payload.source_type === "api" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={t("sources.fields.endpoint")} labelMode="stacked" onChange={(event) => setConfig("endpoint", event.target.value)} value={String(payload.config.endpoint ?? "")} />
          <Input label={t("sources.fields.itemsPath")} labelMode="stacked" onChange={(event) => setConfig("items_path", event.target.value)} value={String(payload.config.items_path ?? "")} />
        </div>
      ) : null}
      {payload.source_type === "scraper" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={t("sources.fields.url")} labelMode="stacked" onChange={(event) => setConfig("url", event.target.value)} value={String(payload.config.url ?? "")} />
          <Input label={t("sources.fields.selector")} labelMode="stacked" onChange={(event) => setConfig("item_selector", event.target.value)} value={String(payload.config.item_selector ?? "")} />
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <CustomSelect label={t("sources.category")} labelMode="stacked" onChange={(value) => setPayload({ category: value as Category })} options={categories.map((category) => ({ label: t(`sources.categories.${category}`), value: category }))} value={payload.category} />
        <CustomSelect label={t("sources.market")} labelMode="stacked" onChange={(value) => setPayload({ market: value as Market })} options={markets.map((market) => ({ label: t(`sources.markets.${market}`), value: market }))} value={payload.market} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label={t("sources.cron")} labelMode="stacked" onChange={(event) => setPayload({ schedule_cron: event.target.value })} value={payload.schedule_cron} />
        <Input label={t("sources.timeout")} labelMode="stacked" min={1} onChange={(event) => setPayload({ max_execution_seconds: Number(event.target.value) })} type="number" value={payload.max_execution_seconds} />
      </div>
      <label className="flex items-center gap-2 text-sm font-bold text-foreground">
        <ToggleSwitch checked={payload.is_active} label={t("sources.active")} onChange={(checked) => setPayload({ is_active: checked })} />
        {payload.is_active ? t("sources.active") : t("sources.inactive")}
      </label>
      <div className="flex justify-end">
        <Button disabled={!sourceConfigComplete(payload)} isLoading={isSaving} onClick={onSave}>{t("sources.save")}</Button>
      </div>
    </div>
  );
}

function IconButton({ children, label, onClick }: IconButtonProps) {
  return <button aria-label={label} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-card hover:text-foreground" onClick={onClick} title={label} type="button">{children}</button>;
}

function sourceConfigComplete(payload: SourcePayload) {
  if (!payload.name.trim()) return false;
  if (payload.source_type === "rss") return Boolean(String(payload.config.feed_url ?? "").trim());
  if (payload.source_type === "api") return Boolean(String(payload.config.endpoint ?? "").trim());
  return Boolean(String(payload.config.url ?? "").trim() && String(payload.config.item_selector ?? "").trim());
}

function sourceConfigSummary(source: DataSource) {
  const config = source.config ?? {};
  if (source.source_type === "rss") return String(config.feed_url ?? "");
  if (source.source_type === "api") return `${String(config.base_url ?? "")}${String(config.endpoint ?? "")}`;
  return String(config.target_url ?? config.url ?? "");
}
