"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useState } from "react";

import { AdminDashboardPanel } from "@/components/admin/AdminDashboardPanel";
import { AdminUsersPanel } from "@/components/admin/AdminUsersPanel";
import { SegmentControl } from "@/components/ui/SegmentControl";

const panels = ["dashboard", "users"] as const;
type AdminPanel = (typeof panels)[number];

function isAdminPanel(value: string | null): value is AdminPanel {
  return panels.includes(value as AdminPanel);
}

export function AdminSettingsSection() {
  const [activePanel, setActivePanel] = useState<AdminPanel>("dashboard");
  const t = useTranslations("admin.nav");
  const settingsT = useTranslations("settings.admin");

  useEffect(() => {
    const requestedPanel = new URLSearchParams(window.location.search).get("admin");
    if (isAdminPanel(requestedPanel)) {
      setActivePanel(requestedPanel);
    }
  }, []);

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
    </section>
  );
}
