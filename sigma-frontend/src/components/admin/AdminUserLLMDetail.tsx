"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { LLMSettingsPanel } from "@/components/settings/LLMSettingsPanel";
import {
  ReportConfigEditor,
  defaultReportConfig,
  normalizeReportConfig,
  reportConfigsEqual
} from "@/components/settings/ReportConfigEditor";
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
  const [reportPayload, setReportPayload] = useState<UserReportConfig>(defaultReportConfig);
  const [reportBaseline, setReportBaseline] = useState<UserReportConfig>(defaultReportConfig);

  useEffect(() => {
    if (report.config.data) {
      const normalized = normalizeReportConfig(report.config.data);
      if (!reportConfigsEqual(reportBaseline, normalized)) {
        setReportPayload(normalized);
        setReportBaseline(normalized);
      }
    }
  }, [report.config.data, reportBaseline]);

  async function saveReportConfig() {
    try {
      const saved = await report.update.mutateAsync(reportPayload);
      const normalized = normalizeReportConfig(saved);
      setReportPayload(normalized);
      setReportBaseline(normalized);
      toast.showToast(userT("saved"), "success");
    } catch (error) {
      toast.showToast(error instanceof Error ? error.message : userT("error"), "error");
    }
  }

  return (
    <div className="min-h-0 space-y-4">
      {report.config.isError ? (
        <Card className="p-5 text-sm text-sigma-muted">{userT("error")}</Card>
      ) : report.config.isLoading ? (
        <Skeleton className="h-72 rounded-lg" />
      ) : (
        <ReportConfigEditor
          compact
          className="max-h-[34rem] overflow-auto"
          isSaving={report.update.isPending}
          onSave={saveReportConfig}
          payload={reportPayload}
          saveLabel={userT("saveReportConfig")}
          setPayload={setReportPayload}
          title={userT("reportConfig")}
        />
      )}
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
