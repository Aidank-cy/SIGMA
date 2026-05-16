"use client";

import { Edit3, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { ItemCard } from "@/components/feed/ItemCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { SegmentControl } from "@/components/ui/SegmentControl";
import { useSources } from "@/hooks/useSources";
import { useWatchlistItems, useWatchlistMutations, useWatchlists } from "@/hooks/useWatchlists";
import type { Market, Watchlist, WatchlistPayload } from "@/lib/types";

const markets: Market[] = ["us", "cn", "hk", "jp", "eu", "global"];

const emptyPayload: WatchlistPayload = {
  keywords: [],
  markets: [],
  name: "",
  sources: []
};

export default function WatchlistPage() {
  const t = useTranslations("watchlist");
  const { data, isLoading } = useWatchlists();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Watchlist | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const watchlists = data?.items ?? [];
  const active = watchlists.find((item) => item.id === activeId) ?? watchlists[0] ?? null;

  useEffect(() => {
    if (activeId === null && watchlists.length > 0) {
      setActiveId(watchlists[0].id);
    }
  }, [activeId, watchlists]);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-sigma-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase text-sigma-accent">{t("eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-semibold text-sigma-text sm:text-4xl">{t("title")}</h1>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setIsModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t("create")}
        </Button>
      </header>

      {isLoading ? <Skeleton className="h-11 w-80" /> : null}
      {!isLoading && watchlists.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sigma-line p-10 text-center text-sigma-muted">
          {t("empty")}
        </div>
      ) : null}
      {watchlists.length > 0 ? (
        <SegmentControl
          activeId={active?.id ?? ""}
          items={watchlists.map((item) => ({ id: item.id, label: item.name }))}
          onChange={setActiveId}
        />
      ) : null}

      {active ? (
        <WatchlistFeed
          active={active}
          onEdit={() => {
            setEditing(active);
            setIsModalOpen(true);
          }}
        />
      ) : null}

      <WatchlistModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        watchlist={editing}
      />
    </section>
  );
}

interface WatchlistFeedProps {
  active: Watchlist;
  onEdit: () => void;
}

function WatchlistFeed({ active, onEdit }: WatchlistFeedProps) {
  const t = useTranslations("watchlist");
  const { deleteWatchlist } = useWatchlistMutations();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useWatchlistItems(active.id);
  const items = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-sigma-line bg-sigma-elevated p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-sigma-text">{active.name}</h2>
          <p className="mt-1 text-sm text-sigma-muted">
            {t("filterSummary", {
              keywords: active.keywords.length,
              markets: active.markets.length,
              sources: active.sources.length
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onEdit} size="sm" variant="secondary">
            <Edit3 className="h-4 w-4" aria-hidden />
            {t("edit")}
          </Button>
          <Button
            isLoading={deleteWatchlist.isPending}
            onClick={() => deleteWatchlist.mutate(active.id)}
            size="sm"
            variant="danger"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            {t("delete")}
          </Button>
        </div>
      </div>

      {isLoading ? <FeedSkeleton /> : null}
      {!isLoading && items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sigma-line p-10 text-center text-sigma-muted">
          {t("itemsEmpty")}
        </div>
      ) : null}
      {items.map((item, index) => (
        <ItemCard index={index} item={item} key={item.id} />
      ))}
      {hasNextPage ? (
        <Button
          className="self-center"
          isLoading={isFetchingNextPage}
          onClick={() => fetchNextPage()}
          variant="secondary"
        >
          {t("loadMore")}
        </Button>
      ) : null}
    </div>
  );
}

interface WatchlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  watchlist: Watchlist | null;
}

function WatchlistModal({ isOpen, onClose, watchlist }: WatchlistModalProps) {
  const t = useTranslations("watchlist");
  const { data: sourcesData } = useSources();
  const { createWatchlist, updateWatchlist } = useWatchlistMutations();
  const [payload, setPayload] = useState<WatchlistPayload>(emptyPayload);
  const sources = sourcesData?.items ?? [];
  const title = watchlist ? t("editTitle") : t("createTitle");

  useEffect(() => {
    setPayload(
      watchlist
        ? {
            keywords: watchlist.keywords,
            markets: watchlist.markets,
            name: watchlist.name,
            sources: watchlist.sources
          }
        : emptyPayload
    );
  }, [watchlist, isOpen]);

  const keywordText = useMemo(() => payload.keywords.join(", "), [payload.keywords]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (watchlist) {
      await updateWatchlist.mutateAsync({ id: watchlist.id, payload });
    } else {
      await createWatchlist.mutateAsync(payload);
    }
    onClose();
  }

  function toggleSource(sourceId: string) {
    setPayload((current) => ({
      ...current,
      sources: current.sources.includes(sourceId)
        ? current.sources.filter((id) => id !== sourceId)
        : [...current.sources, sourceId]
    }));
  }

  function toggleMarket(market: Market) {
    setPayload((current) => ({
      ...current,
      markets: current.markets.includes(market)
        ? current.markets.filter((item) => item !== market)
        : [...current.markets, market]
    }));
  }

  return (
    <Modal closeLabel={t("close")} isOpen={isOpen} onClose={onClose} title={title}>
      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <Input
          label={t("name")}
          onChange={(event) => setPayload((current) => ({ ...current, name: event.target.value }))}
          required
          value={payload.name}
        />
        <Input
          label={t("keywords")}
          onChange={(event) =>
            setPayload((current) => ({
              ...current,
              keywords: event.target.value
                .split(",")
                .map((keyword) => keyword.trim())
                .filter(Boolean)
            }))
          }
          value={keywordText}
        />

        <div className="space-y-2">
          <p className="text-sm font-medium text-sigma-text">{t("marketLabel")}</p>
          <div className="flex flex-wrap gap-2">
            {markets.map((market) => (
              <button
                className={
                  payload.markets.includes(market)
                    ? "rounded-full bg-sigma-text px-3 py-2 text-sm font-medium text-sigma-bg"
                    : "rounded-full border border-sigma-line px-3 py-2 text-sm font-medium text-sigma-muted hover:text-sigma-text"
                }
                key={market}
                onClick={() => toggleMarket(market)}
                type="button"
              >
                {t(`markets.${market}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-sigma-text">{t("sourceLabel")}</p>
          <div className="max-h-44 space-y-2 overflow-y-auto rounded-2xl border border-sigma-line p-3">
            {sources.length === 0 ? <p className="text-sm text-sigma-muted">{t("sourcesEmpty")}</p> : null}
            {sources.map((source) => (
              <label className="flex items-center gap-3 text-sm text-sigma-text" key={source.id}>
                <input
                  checked={payload.sources.includes(source.id)}
                  className="h-4 w-4 rounded border-sigma-line"
                  onChange={() => toggleSource(source.id)}
                  type="checkbox"
                />
                <span>{source.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button onClick={onClose} variant="ghost">
            {t("cancel")}
          </Button>
          <Button isLoading={createWatchlist.isPending || updateWatchlist.isPending} type="submit">
            {t("save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="space-y-3 border-b border-sigma-line py-5" key={index}>
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-6 w-4/5" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}
