"use client";

import { Database, KeyRound, Save, Shield, Trash2, UserCheck, UserX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { AdminUserLLMDetail } from "@/components/admin/AdminUserLLMDetail";
import type { AdminDetailSaveHandle, AdminDetailSaveState } from "@/components/admin/AdminUserLLMDetail";
import { AdminUserSourcesDetail } from "@/components/admin/AdminUserSourcesDetail";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { SegmentControl } from "@/components/ui/SegmentControl";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAdminUsers } from "@/hooks/useAdmin";
import type { AdminUser } from "@/hooks/useAdmin";
import { cn } from "@/lib/cn";

type DetailTab = "llm" | "sources";
const initialSaveState: AdminDetailSaveState = { isDirty: false, isSaving: false, isValid: true };

export function AdminUsersPanel() {
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>("llm");
  const [detailSaveState, setDetailSaveState] = useState<AdminDetailSaveState>(initialSaveState);
  const detailRef = useRef<AdminDetailSaveHandle | null>(null);
  const t = useTranslations("admin.users");
  const common = useTranslations("common");
  const llmT = useTranslations("admin.llm");
  const syncT = useTranslations("sync");
  const toast = useToast();
  const { list, remove, update } = useAdminUsers(query);
  const users = useMemo(() => list.data?.items ?? [], [list.data?.items]);
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;

  useEffect(() => {
    if (selectedUserId !== null && users.some((user) => user.id === selectedUserId)) {
      return;
    }
    setSelectedUserId(users[0]?.id ?? null);
  }, [selectedUserId, users]);

  useEffect(() => {
    setDetailSaveState(initialSaveState);
  }, [activeDetailTab, selectedUserId]);

  const handleUpdate = async (user: AdminUser, payload: { role?: "admin" | "user"; is_active?: boolean }) => {
    try {
      await update.mutateAsync({ id: user.id, payload });
      toast.showToast(t("saved"), "success");
    } catch (error) {
      toast.showToast(error instanceof Error ? error.message : t("error"), "error");
    }
  };

  const handleDelete = async () => {
    if (pendingDelete === null || confirmation !== pendingDelete.email) {
      return;
    }
    try {
      await remove.mutateAsync(pendingDelete.id);
      toast.showToast(t("deleted"), "success");
      setPendingDelete(null);
      setConfirmation("");
    } catch (error) {
      toast.showToast(error instanceof Error ? error.message : t("error"), "error");
    }
  };

  const handleDetailSave = async () => {
    if (!detailRef.current || !detailSaveState.isDirty || detailSaveState.isSaving || !detailSaveState.isValid) {
      return;
    }
    try {
      await detailRef.current.save();
      toast.showToast(t("saved"), "success");
      setDetailSaveState(initialSaveState);
    } catch (error) {
      toast.showToast(error instanceof Error ? error.message : t("error"), "error");
    }
  };

  return (
    <div className="space-y-6">
      <Header eyebrow={t("eyebrow")} title={t("title")} />
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:max-w-sm">
              <Input
                label={t("search")}
                onChange={(event) => setQuery(event.target.value)}
                value={query}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-secondary text-xs uppercase tracking-normal text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-bold">{t("user")}</th>
                  <th className="px-3 py-3 font-bold">{t("role")}</th>
                  <th className="px-3 py-3 font-bold">{t("status")}</th>
                  <th className="px-3 py-3 font-bold">{t("created")}</th>
                  <th className="px-3 py-3 font-bold">{t("llm")}</th>
                  <th className="px-3 py-3 font-bold">{t("sources")}</th>
                  <th className="px-3 py-3 text-right font-bold">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isSelected = selectedUserId === user.id;
                  return (
                    <tr
                      className={cn(
                        "cursor-pointer border-t border-border transition-colors hover:bg-secondary/60",
                        isSelected ? "bg-primary/5" : ""
                      )}
                      key={user.id}
                      onClick={() => setSelectedUserId(user.id)}
                    >
                      <td className="px-3 py-4">
                        <p className="font-bold text-foreground">{user.display_name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </td>
                      <td className="px-3 py-4">
                        <button
                          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-secondary hover:text-foreground"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleUpdate(user, { role: user.role === "admin" ? "user" : "admin" });
                          }}
                          type="button"
                        >
                          <Shield className="h-3.5 w-3.5" aria-hidden />
                          {t(`roles.${user.role}`)}
                        </button>
                      </td>
                      <td className="px-3 py-4">
                        <button
                          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-secondary hover:text-foreground"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleUpdate(user, { is_active: !user.is_active });
                          }}
                          type="button"
                        >
                          {user.is_active ? (
                            <UserCheck className="h-3.5 w-3.5 text-chart-1" aria-hidden />
                          ) : (
                            <UserX className="h-3.5 w-3.5 text-destructive" aria-hidden />
                          )}
                          {user.is_active ? t("active") : t("disabled")}
                        </button>
                      </td>
                      <td className="px-3 py-4 text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-4">
                        <CountBadge
                          icon="llm"
                          label={t("llmCount", { count: user.llm_key_count })}
                          onClick={() => {
                            setSelectedUserId(user.id);
                            setActiveDetailTab("llm");
                          }}
                        />
                      </td>
                      <td className="px-3 py-4">
                        <CountBadge
                          icon="sources"
                          label={t("sourceCount", { count: user.source_count })}
                          onClick={() => {
                            setSelectedUserId(user.id);
                            setActiveDetailTab("sources");
                          }}
                        />
                      </td>
                      <td className="px-3 py-4 text-right">
                        <Button
                          onClick={(event) => {
                            event.stopPropagation();
                            setPendingDelete(user);
                          }}
                          size="sm"
                          variant="ghost"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                          {t("delete")}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!list.isLoading && users.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">{t("empty")}</p>
            ) : null}
          </div>
        </Card>

        <Card className="min-h-[42rem] overflow-hidden p-6">
          {selectedUser ? (
            <div className="flex h-full min-h-0 flex-col gap-6">
              <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-foreground">{selectedUser.display_name}</h2>
                  <p className="truncate text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
                <div className="flex flex-col gap-3 sm:items-end lg:flex-row lg:items-center">
                  <SegmentControl
                    activeId={activeDetailTab}
                    items={[
                      { id: "llm", label: llmT("llmConfiguration") },
                      { id: "sources", label: syncT("dataSources") }
                    ]}
                    onChange={(value) => setActiveDetailTab(value as DetailTab)}
                  />
                  <Button
                    disabled={!detailSaveState.isDirty || detailSaveState.isSaving || !detailSaveState.isValid}
                    isLoading={detailSaveState.isSaving}
                    onClick={handleDetailSave}
                    size="sm"
                    type="button"
                  >
                    <Save className="h-4 w-4" aria-hidden />
                    {llmT("save")}
                  </Button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto pr-1">
                {activeDetailTab === "llm" ? (
                  <AdminUserLLMDetail
                    key={selectedUser.id}
                    onSaveStateChange={setDetailSaveState}
                    ref={detailRef}
                    userId={selectedUser.id}
                  />
                ) : null}
                {activeDetailTab === "sources" ? (
                  <AdminUserSourcesDetail
                    key={selectedUser.id}
                    onSaveStateChange={setDetailSaveState}
                    ref={detailRef}
                    userId={selectedUser.id}
                  />
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[36rem] items-center justify-center p-8 text-center">
              <div>
                <p className="text-lg font-bold text-foreground">{t("selectUser")}</p>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t("selectUserCaption")}</p>
              </div>
            </div>
          )}
        </Card>
      </section>

      <Modal
        closeLabel={common("close")}
        isOpen={pendingDelete !== null}
        onClose={() => {
          setPendingDelete(null);
          setConfirmation("");
        }}
        title={t("deleteTitle")}
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">
            {pendingDelete ? t("deleteBody", { email: pendingDelete.email }) : ""}
          </p>
          <Input
            label={t("confirmEmail")}
            onChange={(event) => setConfirmation(event.target.value)}
            value={confirmation}
          />
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setPendingDelete(null);
                setConfirmation("");
              }}
              variant="ghost"
            >
              {t("cancel")}
            </Button>
            <Button
              disabled={pendingDelete === null || confirmation !== pendingDelete.email}
              isLoading={remove.isPending}
              onClick={handleDelete}
              variant="danger"
            >
              {t("delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function CountBadge({
  icon,
  label,
  onClick
}: {
  icon: "llm" | "sources";
  label: string;
  onClick: () => void;
}) {
  const Icon = icon === "llm" ? KeyRound : Database;
  return (
    <button
      className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border px-3 py-1 text-xs font-bold text-muted-foreground hover:bg-secondary hover:text-foreground"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      type="button"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}

function Header({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-sm font-bold uppercase tracking-normal text-muted-foreground">{eyebrow}</p>
      <h1 className="mt-2 text-[32px] font-bold text-foreground">{title}</h1>
    </div>
  );
}
