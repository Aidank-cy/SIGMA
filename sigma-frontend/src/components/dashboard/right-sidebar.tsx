"use client";

import { motion } from "framer-motion";
import { Flame, Hash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { useTrendingKeywords } from "@/hooks/useStats";

export function RightSidebar() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("sidebar");
  const { data: trending } = useTrendingKeywords();

  return (
    <div className="space-y-6">
      <motion.div
        animate={{ opacity: 1, x: 0 }}
        className="rounded-2xl border border-border bg-card p-6"
        initial={{ opacity: 0, x: 20 }}
        transition={{ delay: 0.2 }}
      >
        <div className="mb-4 flex items-center gap-2">
          <Flame className="h-5 w-5 text-chart-2" />
          <h3 className="font-bold text-foreground">{t("trending")}</h3>
        </div>

        <div className="space-y-1">
          {(trending?.items ?? []).slice(0, 6).map((topic, index) => (
            <motion.button
              animate={{ opacity: 1, x: 0 }}
              className="group flex w-full items-center justify-between rounded-xl p-3 transition-all duration-200"
              initial={{ opacity: 0, x: 20 }}
              key={topic.keyword}
              onClick={() => router.push(`/${locale}/news?keyword=${encodeURIComponent(topic.keyword)}`)}
              transition={{ delay: 0.4 + index * 0.05 }}
              type="button"
              whileHover={{ backgroundColor: "var(--muted)", x: 4 }}
            >
              <div className="flex min-w-0 items-center gap-2">
                <Hash className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                <span className="truncate text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                  {topic.keyword.charAt(0).toUpperCase() + topic.keyword.slice(1)}
                </span>
              </div>
              <span className="text-xs font-bold text-foreground/55">{topic.count}</span>
            </motion.button>
          ))}
          {(trending?.items ?? []).length === 0 ? (
            <p className="rounded-xl bg-muted/50 p-4 text-sm text-foreground/60">{t("empty")}</p>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
