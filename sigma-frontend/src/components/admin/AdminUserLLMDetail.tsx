"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";

import { LLMSettingsPanel } from "@/components/settings/LLMSettingsPanel";
import {
  ReportConfigEditor,
  defaultReportConfig,
  normalizeReportConfig,
  reportConfigsEqual
} from "@/components/settings/ReportConfigEditor";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useAdminUserLLMConfig, useAdminUserReportConfig } from "@/hooks/useAdminUserDetail";
import type { UserReportConfig } from "@/lib/types";

export function AdminUserLLMDetail({ userId }: { userId: string }) {
  const t = useTranslations("admin.llm");
  const userT = useTranslations("admin.users");
  const llm = useAdminUserLLMConfig(userId);
  const report = useAdminUserReportConfig(userId);
  const toast = useToast();
  const [reportPayload, setReportPayload] = useState<UserReportConfig>(() => {
    if (report.config.data) {
      return normalizeReportConfig(report.config.data);
    }
    return defaultReportConfig;
  });
  const reportBaselineRef = useRef<UserReportConfig>(reportPayload);
  const reportPayloadRef = useRef<UserReportConfig>(reportPayload);
  const setSyncedReportPayload = useCallback(
    (value: UserReportConfig | ((current: UserReportConfig) => UserReportConfig)) => {
      setReportPayload((current) => {
        const next = typeof value === "function" ? value(current) : value;
        reportPayloadRef.current = next;
        return next;
      });
    },
    []
  );

  useEffect(() => {
    if (report.config.data) {
      const normalized = normalizeReportConfig(report.config.data);
      if (
        reportConfigsEqual(normalized, reportBaselineRef.current) ||
        reportConfigsEqual(normalized, reportPayloadRef.current)
      ) {
        return;
      }
      reportBaselineRef.current = normalized;
      reportPayloadRef.current = normalized;
      setReportPayload(normalized);
    }
  }, [report.config.data]);

  async function saveReportConfig() {
    try {
      const saved = await report.update.mutateAsync(reportPayload);
      const normalized = normalizeReportConfig(saved);
      reportBaselineRef.current = normalized;
      reportPayloadRef.current = normalized;
      setReportPayload(normalized);
      toast.showToast(userT("saved"), "success");
    } catch (error) {
      toast.showToast(error instanceof Error ? error.message : userT("error"), "error");
    }
  }

  return (
    <div className="min-h-0 space-y-4">
      {report.config.isLoading ? (
        <Skeleton className="h-72 rounded-lg" />
      ) : (
        <ReportConfigEditor
          compact
          className="max-h-[34rem] overflow-auto"
          isSaving={report.update.isPending}
          onSave={saveReportConfig}
          payload={reportPayload}
          saveLabel={userT("saveReportConfig")}
          setPayload={setSyncedReportPayload}
          title={userT("reportConfig")}
        />
      )}
      {llm.config.isError ? (
        <ErrorCard
          isRetrying={llm.config.isFetching}
          message={t("error")}
          onRetry={() => llm.config.refetch()}
          retryLabel={userT("retry")}
        />
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

function ErrorCard({
  isRetrying,
  message,
  onRetry,
  retryLabel
}: {
  isRetrying: boolean;
  message: string;
  onRetry: () => void;
  retryLabel: string;
}) {
  return (
    <Card className="flex items-center justify-between gap-3 p-5 text-sm text-sigma-muted">
      <span>{message}</span>
      <Button isLoading={isRetrying} onClick={onRetry} size="sm" type="button" variant="secondary">
        <RotateCcw className="h-4 w-4" aria-hidden />
        {retryLabel}
      </Button>
    </Card>
  );
}
