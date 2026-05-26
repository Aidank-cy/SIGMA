"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";

import {
  LLMSettingsPanel,
  llmConfigsEqual,
  normalizedLLMConfigForSave
} from "@/components/settings/LLMSettingsPanel";
import {
  ReportConfigEditor,
  defaultReportConfig,
  normalizeReportConfig,
  reportConfigsEqual
} from "@/components/settings/ReportConfigEditor";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAdminUserLLMConfig, useAdminUserReportConfig } from "@/hooks/useAdminUserDetail";
import type { LLMConfig, UserReportConfig } from "@/lib/types";

export interface AdminDetailSaveState {
  isDirty: boolean;
  isSaving: boolean;
  isValid: boolean;
}

export interface AdminDetailSaveHandle {
  save: () => Promise<void>;
}

interface AdminUserLLMDetailProps {
  onSaveStateChange?: (state: AdminDetailSaveState) => void;
  userId: string;
}

export const AdminUserLLMDetail = forwardRef<AdminDetailSaveHandle, AdminUserLLMDetailProps>(function AdminUserLLMDetail(
  { onSaveStateChange, userId },
  ref
) {
  const t = useTranslations("admin.llm");
  const userT = useTranslations("admin.users");
  const llm = useAdminUserLLMConfig(userId);
  const report = useAdminUserReportConfig(userId);
  const [reportPayload, setReportPayload] = useState<UserReportConfig>(() => {
    if (report.config.data) {
      return normalizeReportConfig(report.config.data);
    }
    return defaultReportConfig;
  });
  const reportBaselineRef = useRef<UserReportConfig>(reportPayload);
  const reportPayloadRef = useRef<UserReportConfig>(reportPayload);
  const llmBaselineRef = useRef<LLMConfig | null>(null);
  const [llmDraft, setLlmDraft] = useState<LLMConfig | null>(null);
  const [llmDraftHasInvalidApiKeys, setLlmDraftHasInvalidApiKeys] = useState(false);
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

  useEffect(() => {
    if (llm.config.data) {
      llmBaselineRef.current = normalizedLLMConfigForSave(llm.config.data);
    }
  }, [llm.config.data]);

  const reportIsDirty = !reportConfigsEqual(reportPayload, reportBaselineRef.current);
  const llmIsDirty =
    llmDraft !== null &&
    llmBaselineRef.current !== null &&
    !llmConfigsEqual(llmDraft, llmBaselineRef.current);
  const isSaving = report.update.isPending || llm.update.isPending;
  const isValid = !llmIsDirty || !llmDraftHasInvalidApiKeys;

  useEffect(() => {
    onSaveStateChange?.({ isDirty: reportIsDirty || llmIsDirty, isSaving, isValid });
  }, [isSaving, isValid, llmIsDirty, onSaveStateChange, reportIsDirty]);

  useImperativeHandle(
    ref,
    () => ({
      async save() {
        if (!isValid) {
          throw new Error(t("error"));
        }
        if (reportIsDirty) {
          const saved = await report.update.mutateAsync(reportPayloadRef.current);
          const normalized = normalizeReportConfig(saved);
          reportBaselineRef.current = normalized;
          reportPayloadRef.current = normalized;
          setReportPayload(normalized);
        }
        if (llmIsDirty && llmDraft !== null) {
          const saved = await llm.update.mutateAsync(llmDraft);
          const normalized = normalizedLLMConfigForSave(saved);
          llmBaselineRef.current = normalized;
          setLlmDraft(normalized);
        }
      }
    }),
    [isValid, llm, llmDraft, llmIsDirty, report, reportIsDirty, t]
  );

  return (
    <div className="min-h-0 space-y-4">
      <ReportConfigEditor
        compact
        className="max-h-[34rem] overflow-auto"
        isSaving={report.update.isPending}
        hideSaveButton
        payload={reportPayload}
        setPayload={setSyncedReportPayload}
        title={userT("reportConfig")}
      />
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
          hideSaveButton
          ignoreDailyLimitCooldown
          isConfigLoading={llm.config.isLoading}
          isSaving={llm.update.isPending}
          onDraftChange={(form, meta) => {
            setLlmDraft(form);
            setLlmDraftHasInvalidApiKeys(meta.hasInvalidApiKeys);
          }}
          onSave={llm.update.mutateAsync}
          preserveDirtyDraft
          showCharts
          usageData={llm.usage.data}
        />
      )}
    </div>
  );
});

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
