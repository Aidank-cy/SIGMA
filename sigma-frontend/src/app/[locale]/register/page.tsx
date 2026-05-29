"use client";

import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useAuthMutations } from "@/hooks/useAuth";

interface RegisterErrors {
  code?: string;
  confirmPassword?: string;
  displayName?: string;
  email?: string;
  password?: string;
}

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [step, setStep] = useState<1 | 2>(1);
  const { requestRegistrationCode, verifyRegistration } = useAuthMutations();
  const { showToast } = useToast();
  const locale = useLocale() as "zh" | "en";
  const router = useRouter();
  const t = useTranslations("auth");

  const validate = () => {
    const nextErrors: RegisterErrors = {};
    if (displayName.trim().length === 0) {
      nextErrors.displayName = t("register.invalidName");
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      nextErrors.email = t("register.invalidEmail");
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      nextErrors.password = t("register.invalidPassword");
    }
    if (confirmPassword !== password) {
      nextErrors.confirmPassword = t("register.passwordMismatch");
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const registrationPayload = () => ({
    display_name: displayName.trim(),
    email,
    locale,
    password
  });

  const requestCode = async () => {
    if (!validate()) {
      return;
    }
    try {
      const result = await requestRegistrationCode.mutateAsync(registrationPayload());
      setStep(2);
      if (result.dev_code) {
        setCode(result.dev_code);
        showToast(t("register.devCode", { code: result.dev_code }), "success");
      } else {
        setCode("");
        showToast(t("register.codeSent"), "success");
      }
    } catch {
      showToast(t("register.error"), "error");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === 1) {
      await requestCode();
      return;
    }
    if (code.length !== 6) {
      setErrors({ code: t("register.enterCode") });
      return;
    }
    try {
      const registeredUser = await verifyRegistration.mutateAsync({ code, email });
      showToast(t("register.success"), "success");
      router.push(`/${registeredUser.locale}`);
    } catch {
      showToast(t("register.error"), "error");
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="absolute right-4 top-4 z-10">
        <LocaleSwitcher compact />
      </div>

      <Card className="relative z-10 w-full max-w-md border-border/80 bg-card p-6 shadow-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background">
            <BarChart3 className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="text-2xl font-bold text-foreground">{t("register.title")}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("tagline")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("register.subtitle")}</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {step === 1 ? (
            <>
              <Input
                autoComplete="name"
                error={errors.displayName}
                label={t("displayName")}
                onChange={(event) => setDisplayName(event.target.value)}
                value={displayName}
              />
              <Input
                autoComplete="email"
                error={errors.email}
                label={t("email")}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
              <Input
                autoComplete="new-password"
                error={errors.password}
                label={t("password")}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
              <Input
                autoComplete="new-password"
                error={errors.confirmPassword}
                label={t("confirmPassword")}
                onChange={(event) => setConfirmPassword(event.target.value)}
                type="password"
                value={confirmPassword}
              />
              <Button className="w-full" isLoading={requestRegistrationCode.isPending} size="lg" type="submit">
                {t("register.submit")}
              </Button>
            </>
          ) : (
            <>
              <Input
                autoComplete="one-time-code"
                error={errors.code}
                inputMode="numeric"
                label={t("register.enterCode")}
                maxLength={6}
                onChange={(event) => {
                  setErrors((current) => ({ ...current, code: undefined }));
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                }}
                value={code}
              />
              <Button
                className="w-full"
                disabled={code.length !== 6}
                isLoading={verifyRegistration.isPending}
                size="lg"
                type="submit"
              >
                {t("register.verify")}
              </Button>
              <Button
                className="w-full"
                isLoading={requestRegistrationCode.isPending}
                onClick={requestCode}
                type="button"
                variant="secondary"
              >
                {t("register.resendCode")}
              </Button>
            </>
          )}
        </form>

        <div className="mt-6 text-center">
          <Link
            className="inline-flex min-h-11 items-center text-sm font-bold text-primary hover:text-foreground"
            href={`/${locale}/login`}
          >
            {t("register.loginLink")}
          </Link>
        </div>
      </Card>
    </main>
  );
}
