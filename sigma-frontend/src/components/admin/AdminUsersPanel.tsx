"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import type { AdminDetailSaveHandle, AdminDetailSaveState } from "@/components/admin/AdminUserLLMDetail";
import { DeleteUserModal, Header, UserDetailCard, UsersTable, type DetailTab } from "@/components/admin/AdminUsersPanelParts";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useAdminUsers } from "@/hooks/useAdmin";
import type { AdminUser } from "@/hooks/useAdmin";

const initialSaveState: AdminDetailSaveState = { isDirty: false, isSaving: false, isValid: true };

export function AdminUsersPanel() {
  const state = useAdminUsersPanelState();
  const t = useTranslations("admin.users");
  return (
    <div className="space-y-6">
      <Header eyebrow={t("eyebrow")} title={t("title")} />
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:max-w-sm"><Input label={t("search")} onChange={(event) => state.setQuery(event.target.value)} value={state.query} /></div>
          </div>
          <UsersTable handleUpdate={state.handleUpdate} selectedUserId={state.selectedUserId} setActiveDetailTab={state.setActiveDetailTab} setPendingDelete={state.setPendingDelete} setSelectedUserId={state.setSelectedUserId} users={state.users} />
        </Card>
        <UserDetailCard activeDetailTab={state.activeDetailTab} detailRef={state.detailRef} detailSaveState={state.detailSaveState} handleDetailSave={state.handleDetailSave} selectedUser={state.selectedUser} setActiveDetailTab={state.setActiveDetailTab} setDetailSaveState={state.setDetailSaveState} />
      </section>
      <DeleteUserModal confirmation={state.confirmation} handleDelete={state.handleDelete} pendingDelete={state.pendingDelete} removeIsPending={state.remove.isPending} setConfirmation={state.setConfirmation} setPendingDelete={state.setPendingDelete} />
    </div>
  );
}

function useAdminUsersPanelState() {
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>("llm");
  const [detailSaveState, setDetailSaveState] = useState<AdminDetailSaveState>(initialSaveState);
  const detailRef = useRef<AdminDetailSaveHandle | null>(null);
  const t = useTranslations("admin.users");
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

  return { activeDetailTab, confirmation, detailRef, detailSaveState, handleDelete, handleDetailSave, handleUpdate, pendingDelete, query, remove, selectedUser, selectedUserId, setActiveDetailTab, setConfirmation, setDetailSaveState, setPendingDelete, setQuery, setSelectedUserId, users };
}
