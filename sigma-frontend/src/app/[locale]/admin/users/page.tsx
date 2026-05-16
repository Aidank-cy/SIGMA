"use client";

import { Shield, Trash2, UserCheck, UserX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAdminUsers } from "@/hooks/useAdmin";
import type { AdminUser } from "@/hooks/useAdmin";

export default function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const t = useTranslations("admin.users");
  const common = useTranslations("common");
  const toast = useToast();
  const { list, remove, update } = useAdminUsers(query);

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

  return (
    <div className="space-y-6">
      <Header eyebrow={t("eyebrow")} title={t("title")} />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-sigma-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-sm">
            <Input
              label={t("search")}
              onChange={(event) => setQuery(event.target.value)}
              value={query}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-sigma-elevated text-xs uppercase tracking-normal text-sigma-muted">
              <tr>
                <th className="px-5 py-3 font-medium">{t("user")}</th>
                <th className="px-5 py-3 font-medium">{t("role")}</th>
                <th className="px-5 py-3 font-medium">{t("status")}</th>
                <th className="px-5 py-3 font-medium">{t("created")}</th>
                <th className="px-5 py-3 text-right font-medium">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {(list.data?.items ?? []).map((user) => (
                <tr className="border-t border-sigma-line" key={user.id}>
                  <td className="px-5 py-4">
                    <p className="font-medium text-sigma-text">{user.display_name}</p>
                    <p className="text-xs text-sigma-muted">{user.email}</p>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      className="inline-flex items-center gap-2 rounded-full border border-sigma-line px-3 py-1.5 text-xs font-medium text-sigma-muted hover:bg-sigma-elevated hover:text-sigma-text"
                      onClick={() =>
                        handleUpdate(user, { role: user.role === "admin" ? "user" : "admin" })
                      }
                      type="button"
                    >
                      <Shield className="h-3.5 w-3.5" aria-hidden />
                      {t(`roles.${user.role}`)}
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      className="inline-flex items-center gap-2 rounded-full border border-sigma-line px-3 py-1.5 text-xs font-medium text-sigma-muted hover:bg-sigma-elevated hover:text-sigma-text"
                      onClick={() => handleUpdate(user, { is_active: !user.is_active })}
                      type="button"
                    >
                      {user.is_active ? (
                        <UserCheck className="h-3.5 w-3.5 text-sigma-success" aria-hidden />
                      ) : (
                        <UserX className="h-3.5 w-3.5 text-sigma-danger" aria-hidden />
                      )}
                      {user.is_active ? t("active") : t("disabled")}
                    </button>
                  </td>
                  <td className="px-5 py-4 text-sigma-muted">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Button onClick={() => setPendingDelete(user)} size="sm" variant="ghost">
                      <Trash2 className="h-4 w-4" aria-hidden />
                      {t("delete")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.isLoading && (list.data?.items ?? []).length === 0 ? (
            <p className="p-5 text-sm text-sigma-muted">{t("empty")}</p>
          ) : null}
        </div>
      </Card>

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
          <p className="text-sm leading-6 text-sigma-muted">
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

function Header({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-sm font-medium uppercase tracking-normal text-sigma-muted">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-semibold text-sigma-text">{title}</h1>
    </div>
  );
}
