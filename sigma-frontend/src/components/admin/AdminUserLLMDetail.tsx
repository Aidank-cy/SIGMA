"use client";

import { UserRound } from "lucide-react";
import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { LLMSettingsPanel } from "@/components/settings/LLMSettingsPanel";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAdminUserLLMConfig } from "@/hooks/useAdminUserDetail";
import { useAdminUsers } from "@/hooks/useAdmin";
import { cn } from "@/lib/cn";

export function AdminUserLLMDetail({ userId }: { userId: string }) {
  const t = useTranslations("admin.llm");
  const userT = useTranslations("admin.users");
  const { list } = useAdminUsers("");
  const llm = useAdminUserLLMConfig(userId);
  const user = useMemo(() => (list.data?.items ?? []).find((item) => item.id === userId) ?? null, [list.data?.items, userId]);

  return (
    <div className="min-h-0 space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <UserAvatar label={user?.display_name || user?.email || t("selectUser")} />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-sigma-text">
              {user?.display_name || user?.email || t("selectUser")}
            </h2>
            <p className="truncate text-sm text-sigma-muted">{user?.email ?? t("current")}</p>
          </div>
          {user ? (
            <span
              className={cn(
                "ml-auto inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold",
                user.is_active ? "bg-sigma-success/10 text-sigma-success" : "bg-muted text-muted-foreground"
              )}
            >
              {user.is_active ? userT("active") : userT("disabled")}
            </span>
          ) : null}
        </div>
      </Card>
      {llm.config.isError ? (
        <Card className="p-5 text-sm text-sigma-muted">{t("error")}</Card>
      ) : llm.config.isLoading ? (
        <Skeleton className="h-[32rem] rounded-lg" />
      ) : (
        <LLMSettingsPanel
          configData={llm.config.data}
          isConfigLoading={llm.config.isLoading}
          isSaving={llm.update.isPending}
          onSave={llm.update.mutateAsync}
          showCharts
          usageData={llm.usage.data}
        />
      )}
    </div>
  );
}

function UserAvatar({ label }: { label: string }) {
  const initials = label
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
      {initials || <UserRound className="h-5 w-5" aria-hidden />}
    </span>
  );
}
