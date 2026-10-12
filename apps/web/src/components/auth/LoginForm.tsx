"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowRight, Code1, Key, MessageText1 } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/api";
import { homeForRole } from "@/lib/roles";
import type { User } from "@/lib/types";
import { AuthHeading, stepMotion } from "./AuthFrame";
import { FieldError, FormError } from "./FormError";
import { OtpStep } from "./OtpStep";
import { PasswordInput } from "./PasswordInput";
import { PhoneInput } from "./PhoneInput";
import { authErrorMessage, errorCode, formatPhone, isValidPhone, safeNext, type OtpSendResponse } from "./auth-utils";

type Mode = "password" | "otp";

// Seed accounts (docs/API.md) — the hint box is rendered only outside production.
const DEMO_PASSWORD = "Eka12345!";
const DEMO_ACCOUNTS = [
  { phone: "+998901000001", role: "superadmin" },
  { phone: "+998901000002", role: "developer" },
  { phone: "+998901000003", role: "inspector" },
  { phone: "+998901000004", role: "buyer" },
  { phone: "+998901000005", role: "company" },
] as const;

export function LoginForm({ next }: { next?: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>("password");
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<{ message: string; code: string | null } | null>(null);
  const [sent, setSent] = React.useState<OtpSendResponse | null>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);

  const phoneValid = isValidPhone(phone);
  const phoneError = submitted && !phoneValid ? t("auth.phone.invalid") : null;
  const passwordError = submitted && mode === "password" && !password ? t("auth.password.required") : null;

  const finish = (user: User) => {
    toast.success(t("auth.login.success", { name: user.fullName }));
    router.replace(safeNext(next) ?? homeForRole(user.role));
    router.refresh();
  };

  const loginWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!phoneValid || !password) return;
    setLoading(true);
    setError(null);
    try {
      const { user } = await api.post<{ user: User }>("/auth/login", { login: phone, password });
      finish(user);
    } catch (err) {
      setError({ message: authErrorMessage(err, t), code: errorCode(err) });
      setLoading(false);
    }
  };

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!phoneValid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<OtpSendResponse>("/auth/otp/send", { phone, purpose: "LOGIN" });
      setSent(res);
    } catch (err) {
      setError({ message: authErrorMessage(err, t), code: errorCode(err) });
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: string) => {
    setMode(m as Mode);
    setError(null);
    setSubmitted(false);
    setSent(null);
  };

  const fillDemo = (p: string) => {
    setMode("password");
    setSent(null);
    setPhone(p);
    setPassword(DEMO_PASSWORD);
    setError(null);
    requestAnimationFrame(() => passwordRef.current?.focus());
  };

  return (
    <div>
      <AuthHeading title={t("auth.login.title")} subtitle={t("auth.login.subtitle")} />

      <Tabs value={mode} onValueChange={switchMode}>
        <TabsList className="mb-7 grid w-full grid-cols-2">
          <TabsTrigger value="password" className="justify-center">
            <Key variant={mode === "password" ? "Bulk" : "Linear"} /> {t("auth.login.tabs.password")}
          </TabsTrigger>
          <TabsTrigger value="otp" className="justify-center">
            <MessageText1 variant={mode === "otp" ? "Bulk" : "Linear"} /> {t("auth.login.tabs.otp")}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <AnimatePresence mode="wait" initial={false}>
        {mode === "password" ? (
          <motion.form key="password" {...stepMotion} onSubmit={loginWithPassword} noValidate className="space-y-5">
            <div>
              <Label htmlFor="login-phone">{t("auth.phone.label")}</Label>
              <PhoneInput
                id="login-phone"
                value={phone}
                onChange={(v) => {
                  setPhone(v);
                  setError(null);
                }}
                invalid={Boolean(phoneError)}
                autoFocus
                aria-describedby="login-phone-error"
              />
              <FieldError id="login-phone-error" message={phoneError} />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <Label htmlFor="login-password" className="mb-0">
                  {t("auth.password.label")}
                </Label>
                <Link href="/forgot" className="text-xs font-semibold text-gold-300 underline-offset-4 transition hover:underline">
                  {t("auth.password.forgot")}
                </Link>
              </div>
              <PasswordInput
                ref={passwordRef}
                id="login-password"
                autoComplete="current-password"
                placeholder={t("auth.password.placeholder")}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                invalid={Boolean(passwordError)}
              />
              <FieldError message={passwordError} />
            </div>
            <FormError message={error?.message} />
            <Button type="submit" variant="gold" size="lg" className="w-full" loading={loading}>
              {t("auth.login.submit")} {!loading && <ArrowRight size={18} />}
            </Button>
          </motion.form>
        ) : !sent ? (
          <motion.form key="otp-phone" {...stepMotion} onSubmit={sendCode} noValidate className="space-y-5">
            <div>
              <Label htmlFor="otp-phone">{t("auth.phone.label")}</Label>
              <PhoneInput
                id="otp-phone"
                value={phone}
                onChange={(v) => {
                  setPhone(v);
                  setError(null);
                }}
                invalid={Boolean(phoneError)}
                autoFocus
              />
              <FieldError message={phoneError} />
              <p className="mt-2 text-xs text-ink-400">{t("auth.login.otpHint")}</p>
            </div>
            <FormError message={error?.message} />
            {error?.code === "USER_NOT_FOUND" && (
              <Button asChild variant="outline" size="md" className="w-full">
                <Link href="/register">{t("auth.login.register")}</Link>
              </Button>
            )}
            <Button type="submit" variant="gold" size="lg" className="w-full" loading={loading}>
              {t("auth.login.sendCode")} {!loading && <ArrowRight size={18} />}
            </Button>
          </motion.form>
        ) : (
          <motion.div key="otp-code" {...stepMotion}>
            <OtpStep
              phone={phone}
              purpose="LOGIN"
              sent={sent}
              onVerified={({ user }) => {
                if (user) finish(user);
              }}
              onChangePhone={() => setSent(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <p className="mt-8 text-center text-sm text-ink-300">
        {t("auth.login.noAccount")}{" "}
        <Link href="/register" className="font-semibold text-gold-300 underline-offset-4 hover:underline">
          {t("auth.login.register")}
        </Link>
      </p>

      {process.env.NODE_ENV !== "production" && (
        <div className="mt-8 rounded-2xl border border-dashed border-line-strong bg-ink-900/60 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold-300">
            <Code1 size={16} variant="Bulk" /> {t("auth.login.demo.title")}
          </div>
          <p className="mt-1 text-xs text-ink-400">{t("auth.login.demo.hint")}</p>
          <ul className="mt-3 grid gap-1.5">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.phone}>
                <button
                  type="button"
                  onClick={() => fillDemo(a.phone)}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-xs transition hover:bg-fg/5"
                >
                  <span className="font-mono text-stone-100">{formatPhone(a.phone)}</span>
                  <span className="truncate text-ink-400">{t(`auth.login.demo.${a.role}`)}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 border-t border-line pt-2 text-xs text-ink-400">
            {t("auth.login.demo.password")}: <span className="font-mono text-stone-100">{DEMO_PASSWORD}</span>
          </div>
        </div>
      )}
    </div>
  );
}
