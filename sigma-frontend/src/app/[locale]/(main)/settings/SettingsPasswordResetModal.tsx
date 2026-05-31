"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SegmentControl } from "@/components/ui/SegmentControl";
import { useToast } from "@/components/ui/Toast";
import { useSettingsMutations } from "@/hooks/useSettings";

export function PasswordResetModal({ email, isOpen, onClose }: { email: string; isOpen: boolean; onClose: () => void }) {
  const t = useTranslations("settings");
  const { showToast } = useToast();
  const { requestPasswordReset, resetPassword, verifyResetCode } = useSettingsMutations();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState(""), [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState<{ message: string; type: "error" | "success" } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setCode("");
      setResetToken("");
      setNewPassword("");
      setConfirmPassword("");
      setFeedback(null);
    }
  }, [isOpen]);

  async function sendCode() {
    try {
      const result = await requestPasswordReset.mutateAsync({ email });
      if (result.dev_code) {
        setCode(result.dev_code);
        setFeedback({ message: t("password.devCode", { code: result.dev_code }), type: "success" });
      } else {
        setFeedback({ message: t("password.codeSent"), type: "success" });
      }
      setStep(2);
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : t("password.error"), type: "error" });
    }
  }

  async function verifyCode() {
    try {
      const response = await verifyResetCode.mutateAsync({ code, email });
      setResetToken(response.reset_token);
      setFeedback({ message: t("password.codeVerified"), type: "success" });
      setStep(3);
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : t("password.invalidCode"), type: "error" });
    }
  }

  async function savePassword() {
    if (newPassword !== confirmPassword) {
      setFeedback({ message: t("password.mismatch"), type: "error" });
      return;
    }
    try {
      await resetPassword.mutateAsync({ new_password: newPassword, reset_token: resetToken });
      showToast(t("password.updated"), "success");
      onClose();
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : t("password.error"), type: "error" });
    }
  }

  return (
    <Modal closeLabel={t("password.close")} isOpen={isOpen} onClose={onClose} title={t("password.title")}>
      <div className="space-y-5">
        <SegmentControl activeId={String(step)} items={[{ id: "1", label: t("password.steps.send") }, { id: "2", label: t("password.steps.verify") }, { id: "3", label: t("password.steps.reset") }]} onChange={() => undefined} />
        <p className="rounded-2xl bg-card px-4 py-3 text-sm text-muted-foreground">{t("password.devHint")}</p>
        {feedback ? <p className={feedback.type === "success" ? "text-sm font-bold text-chart-1" : "text-sm font-bold text-destructive"}>{feedback.message}</p> : null}
        {step === 1 ? <div className="space-y-4"><Input label={t("password.email")} labelMode="stacked" readOnly value={email} /><Button isLoading={requestPasswordReset.isPending} onClick={sendCode}>{t("password.sendCode")}</Button></div> : null}
        {step === 2 ? (
          <div className="space-y-4">
            <Input inputMode="numeric" label={t("password.code")} labelMode="stacked" maxLength={6} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} value={code} />
            <Button disabled={code.length !== 6} isLoading={verifyResetCode.isPending} onClick={verifyCode}>{t("password.verify")}</Button>
          </div>
        ) : null}
        {step === 3 ? (
          <div className="space-y-4">
            <Input label={t("password.next")} labelMode="stacked" onChange={(event) => setNewPassword(event.target.value)} type="password" value={newPassword} />
            <Input label={t("password.confirm")} labelMode="stacked" onChange={(event) => setConfirmPassword(event.target.value)} type="password" value={confirmPassword} />
            <Button disabled={newPassword.length === 0 || confirmPassword.length === 0} isLoading={resetPassword.isPending} onClick={savePassword}>{t("password.save")}</Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
