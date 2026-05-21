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
import { useAuth } from "@/components/AuthProvider";

interface LoginErrors {
  email?: string;
  password?: string;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<LoginErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const { showToast } = useToast();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("auth");

  const validate = () => {
    const nextErrors: LoginErrors = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      nextErrors.email = t("login.invalidEmail");
    }
    if (password.length === 0) {
      nextErrors.password = t("login.invalidPassword");
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
      const authenticatedUser = await login({ email, password });
      showToast(t("login.success"), "success");
      router.push(`/${authenticatedUser.locale}`);
    } catch {
      showToast(t("login.error"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="absolute inset-[-32px] opacity-[0.18] [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="absolute right-4 top-4 z-10">
        <LocaleSwitcher compact />
      </div>

      <Card className="relative z-10 w-full max-w-md border-border/80 bg-card/90 p-6 shadow-apple backdrop-blur-xl sm:p-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background">
            <BarChart3 className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="text-2xl font-semibold text-foreground">{t("login.title")}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("tagline")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("login.subtitle")}</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            autoComplete="email"
            error={errors.email}
            label={t("email")}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
          <Input
            autoComplete="current-password"
            error={errors.password}
            label={t("password")}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
          <Button className="w-full" isLoading={isSubmitting} size="lg" type="submit">
            {t("login.submit")}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link
            className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:text-foreground"
            href={`/${locale}/register`}
          >
            {t("login.registerLink")}
          </Link>
        </div>
      </Card>
    </main>
  );
}
