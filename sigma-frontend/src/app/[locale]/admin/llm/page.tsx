"use client";

import { useTranslations } from "next-intl";

import { LLMSettingsPanel } from "@/components/settings/LLMSettingsPanel";
import { useAdminLLM } from "@/hooks/useAdmin";

export default function AdminLLMPage() {
  const t = useTranslations("admin.llm");
  const { config, update, usage } = useAdminLLM();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-normal text-sigma-muted">{t("eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-sigma-text">{t("title")}</h1>
      </div>

      <LLMSettingsPanel
        configData={config.data}
        isConfigLoading={config.isLoading}
        isSaving={update.isPending}
        onSave={update.mutateAsync}
        showCharts
        usageData={usage.data}
      />
    </div>
  );
}
