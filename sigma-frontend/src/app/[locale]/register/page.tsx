"use client";

import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

interface RegisterErrors {
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
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();
  const { showToast } = useToast();
  const locale = useLocale();
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }
    setIsSubmitting(true);
    try {
      await register({ display_name: displayName.trim(), email, password });
      showToast(t("register.success"), "success");
      router.push(`/${locale}/login`);
    } catch {
      showToast(t("register.error"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-sigma-bg px-4 py-10">
      <div className="absolute inset-[-32px] animate-sigma-float opacity-[0.18] [background-image:linear-gradient(rgb(var(--sigma-line))_1px,transparent_1px),linear-gradient(90deg,rgb(var(--sigma-line))_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="absolute right-4 top-4 z-10">
        <LocaleSwitcher compact />
      </div>

      <Card className="relative z-10 w-full max-w-md border-sigma-line/80 bg-sigma-surface/86 p-6 shadow-apple backdrop-blur-xl sm:p-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sigma-text text-sigma-bg">
            <BarChart3 className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="text-2xl font-semibold text-sigma-text">{t("register.title")}</h1>
          <p className="mt-2 text-sm leading-6 text-sigma-muted">{t("tagline")}</p>
          <p className="mt-1 text-sm leading-6 text-sigma-muted">{t("register.subtitle")}</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
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
          <Button className="w-full" isLoading={isSubmitting} size="lg" type="submit">
            {t("register.submit")}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link
            className="text-sm font-medium text-sigma-accent hover:text-sigma-text"
            href={`/${locale}/login`}
          >
            {t("register.loginLink")}
          </Link>
        </div>
      </Card>
    </main>
  );
}
