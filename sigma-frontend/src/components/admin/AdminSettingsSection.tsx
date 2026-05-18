"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { AdminDashboardPanel } from "@/components/admin/AdminDashboardPanel";
import { AdminLLMPanel } from "@/components/admin/AdminLLMPanel";
import { AdminLogsPanel } from "@/components/admin/AdminLogsPanel";
import { AdminSourcesPanel } from "@/components/admin/AdminSourcesPanel";
import { AdminUsersPanel } from "@/components/admin/AdminUsersPanel";
import { SegmentControl } from "@/components/ui/SegmentControl";

const panels = ["dashboard", "users", "sources", "llm", "logs"] as const;
type AdminPanel = (typeof panels)[number];

export function AdminSettingsSection() {
  const [activePanel, setActivePanel] = useState<AdminPanel>("dashboard");
  const t = useTranslations("admin.nav");
  const settingsT = useTranslations("settings.admin");

  return (
    <section className="space-y-5 border-t border-sigma-line pt-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-normal text-sigma-accent">
            {settingsT("eyebrow")}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-sigma-text">{settingsT("title")}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-sigma-muted">{settingsT("caption")}</p>
        </div>
        <div className="overflow-x-auto pb-1">
          <SegmentControl
            activeId={activePanel}
            items={panels.map((panel) => ({ id: panel, label: t(panel) }))}
            onChange={(value) => setActivePanel(value as AdminPanel)}
          />
        </div>
      </div>

      {activePanel === "dashboard" ? <AdminDashboardPanel /> : null}
      {activePanel === "users" ? <AdminUsersPanel /> : null}
      {activePanel === "sources" ? <AdminSourcesPanel /> : null}
      {activePanel === "llm" ? <AdminLLMPanel /> : null}
      {activePanel === "logs" ? <AdminLogsPanel /> : null}
    </section>
  );
}
