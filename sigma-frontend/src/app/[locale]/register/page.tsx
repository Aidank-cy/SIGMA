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

interface StepOneFieldsProps {
  confirmPassword: string;
  displayName: string;
  email: string;
  errors: RegisterErrors;
  isPending: boolean;
  onConfirmPasswordChange: (value: string) => void;
  onDisplayNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  password: string;
}

interface StepTwoFieldsProps {
  code: string;
  errors: RegisterErrors;
  isRequestPending: boolean;
  isVerifyPending: boolean;
  onCodeChange: (value: string) => void;
  onRequestCode: () => void;
  setErrors: (value: (current: RegisterErrors) => RegisterErrors) => void;
}

interface RegisterCardProps {
  code: string;
  confirmPassword: string;
  displayName: string;
  email: string;
  errors: RegisterErrors;
  locale: "zh" | "en";
  onCodeChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onDisplayNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRequestCode: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  password: string;
  requestPending: boolean;
  setErrors: (value: (current: RegisterErrors) => RegisterErrors) => void;
  step: 1 | 2;
  verifyPending: boolean;
}

function getRegisterErrors({
  confirmPassword,
  displayName,
  email,
  password,
  t
}: {
  confirmPassword: string;
  displayName: string;
  email: string;
  password: string;
  t: ReturnType<typeof useTranslations>;
}) {
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
  return nextErrors;
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
    const nextErrors = getRegisterErrors({ confirmPassword, displayName, email, password, t });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const requestCode = async () => {
    if (!validate()) {
      return;
    }
    try {
      const result = await requestRegistrationCode.mutateAsync({ display_name: displayName.trim(), email, locale, password });
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

      <RegisterCard
        code={code} confirmPassword={confirmPassword}
        displayName={displayName} email={email}
        errors={errors}
        locale={locale}
        onCodeChange={setCode}
        onConfirmPasswordChange={setConfirmPassword}
        onDisplayNameChange={setDisplayName}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onRequestCode={requestCode}
        onSubmit={handleSubmit}
        password={password}
        requestPending={requestRegistrationCode.isPending}
        setErrors={setErrors}
        step={step}
        verifyPending={verifyRegistration.isPending}
      />
    </main>
  );
}

function RegisterCard(props: RegisterCardProps) {
  const t = useTranslations("auth");

  return (
    <Card className="relative z-10 w-full max-w-md border-border/80 bg-card p-6 shadow-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background">
          <BarChart3 className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="text-2xl font-bold text-foreground">{t("register.title")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("tagline")}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("register.subtitle")}</p>
      </div>

      <form className="space-y-4" onSubmit={props.onSubmit}>
        {props.step === 1 ? <StepOneFields {...props} isPending={props.requestPending} /> : (
          <StepTwoFields
            code={props.code}
            errors={props.errors}
            isRequestPending={props.requestPending}
            isVerifyPending={props.verifyPending}
            onCodeChange={props.onCodeChange}
            onRequestCode={props.onRequestCode}
            setErrors={props.setErrors}
          />
        )}
      </form>

      <div className="mt-6 text-center">
        <Link
          className="inline-flex min-h-11 items-center text-sm font-bold text-primary hover:text-foreground"
          href={`/${props.locale}/login`}
        >
          {t("register.loginLink")}
        </Link>
      </div>
    </Card>
  );
}

function StepOneFields({
  confirmPassword,
  displayName,
  email,
  errors,
  isPending,
  onConfirmPasswordChange,
  onDisplayNameChange,
  onEmailChange,
  onPasswordChange,
  password
}: StepOneFieldsProps) {
  const t = useTranslations("auth");

  return (
    <>
      <Input autoComplete="name" error={errors.displayName} label={t("displayName")} onChange={(event) => onDisplayNameChange(event.target.value)} value={displayName} />
      <Input autoComplete="email" error={errors.email} label={t("email")} onChange={(event) => onEmailChange(event.target.value)} type="email" value={email} />
      <Input autoComplete="new-password" error={errors.password} label={t("password")} onChange={(event) => onPasswordChange(event.target.value)} type="password" value={password} />
      <Input autoComplete="new-password" error={errors.confirmPassword} label={t("confirmPassword")} onChange={(event) => onConfirmPasswordChange(event.target.value)} type="password" value={confirmPassword} />
      <Button className="w-full" isLoading={isPending} size="lg" type="submit">
        {t("register.submit")}
      </Button>
    </>
  );
}

function StepTwoFields({
  code,
  errors,
  isRequestPending,
  isVerifyPending,
  onCodeChange,
  onRequestCode,
  setErrors
}: StepTwoFieldsProps) {
  const t = useTranslations("auth");

  return (
    <>
      <Input
        autoComplete="one-time-code"
        error={errors.code}
        inputMode="numeric"
        label={t("register.enterCode")}
        maxLength={6}
        onChange={(event) => {
          setErrors((current) => ({ ...current, code: undefined }));
          onCodeChange(event.target.value.replace(/\D/g, "").slice(0, 6));
        }}
        value={code}
      />
      <Button className="w-full" disabled={code.length !== 6} isLoading={isVerifyPending} size="lg" type="submit">
        {t("register.verify")}
      </Button>
      <Button className="w-full" isLoading={isRequestPending} onClick={onRequestCode} type="button" variant="secondary">
        {t("register.resendCode")}
      </Button>
    </>
  );
}
