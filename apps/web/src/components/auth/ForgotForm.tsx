"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowRight, TickCircle } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/api";
import { AuthHeading, AuthStepper, stepMotion } from "./AuthFrame";
import { FieldError, FormError } from "./FormError";
import { OtpStep } from "./OtpStep";
import { PasswordInput, PasswordStrength } from "./PasswordInput";
import { PhoneInput } from "./PhoneInput";
import { authErrorMessage, errorCode, formatPhone, isValidPhone, passwordProblem, type OtpSendResponse } from "./auth-utils";

export function ForgotForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [phone, setPhone] = React.useState("");
  const [sent, setSent] = React.useState<OtpSendResponse | null>(null);
  const [token, setToken] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const phoneError = submitted && step === 0 && !isValidPhone(phone) ? t("auth.phone.invalid") : null;
  const pwKey = passwordProblem(password);
  const pwError = submitted && step === 2 && pwKey ? t(pwKey) : null;
  const confirmError =
    submitted && step === 2 ? (!confirm ? t("auth.password.required") : confirm !== password ? t("auth.password.mismatch") : null) : null;

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!isValidPhone(phone)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<OtpSendResponse>("/auth/otp/send", { phone, purpose: "RESET" });
      setSent(res);
      setSubmitted(false);
      setStep(1);
    } catch (err) {
      setError(authErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (passwordProblem(password) || confirm !== password || !token) return;
    setLoading(true);
    setError(null);
    try {
      await api.post("/auth/password/reset", { verificationToken: token, password });
      toast.success(t("auth.forgot.success"));
      router.push("/login");
    } catch (err) {
      setError(authErrorMessage(err, t));
      const code = errorCode(err);
      if (code === "TOKEN_EXPIRED" || code === "INVALID_TOKEN") {
        setToken(null);
        setSent(null);
        setStep(0);
      }
      setLoading(false);
    }
  };

  return (
    <div>
      <AuthHeading title={t("auth.forgot.title")} subtitle={t("auth.forgot.subtitle")} />
      <AuthStepper steps={[t("auth.forgot.steps.phone"), t("auth.forgot.steps.otp"), t("auth.forgot.steps.password")]} current={step} />

      <AnimatePresence mode="wait" initial={false}>
        {step === 0 && (
          <motion.form key="phone" {...stepMotion} onSubmit={sendCode} noValidate className="space-y-5">
            <div>
              <Label htmlFor="fg-phone">{t("auth.phone.label")}</Label>
              <PhoneInput
                id="fg-phone"
                value={phone}
                onChange={(v) => {
                  setPhone(v);
                  setError(null);
                }}
                invalid={Boolean(phoneError)}
                autoFocus
              />
              <FieldError message={phoneError} />
            </div>
            <FormError message={error} />
            <Button type="submit" variant="gold" size="lg" className="w-full" loading={loading}>
              {t("auth.forgot.sendCode")} {!loading && <ArrowRight size={18} />}
            </Button>
          </motion.form>
        )}
        {step === 1 && sent && (
          <motion.div key="otp" {...stepMotion}>
            <OtpStep
              phone={phone}
              purpose="RESET"
              sent={sent}
              onVerified={({ verificationToken }) => {
                if (!verificationToken) return;
                setToken(verificationToken);
                setError(null);
                setSubmitted(false);
                setStep(2);
              }}
              onChangePhone={() => {
                setSent(null);
                setStep(0);
              }}
            />
          </motion.div>
        )}
        {step === 2 && (
          <motion.form key="password" {...stepMotion} onSubmit={reset} noValidate className="space-y-5">
            <div className="flex items-center gap-2 rounded-xl border border-success/25 bg-success/[0.07] px-3.5 py-2.5 text-sm">
              <TickCircle size={18} variant="Bold" className="text-success" />
              <span className="font-mono text-stone-100">{formatPhone(phone)}</span>
            </div>
            <div>
              <Label htmlFor="fg-password">{t("auth.password.newLabel")}</Label>
              <PasswordInput
                id="fg-password"
                autoComplete="new-password"
                autoFocus
                placeholder={t("auth.password.newPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                invalid={Boolean(pwError)}
              />
              <PasswordStrength password={password} />
              <FieldError message={pwError} />
            </div>
            <div>
              <Label htmlFor="fg-confirm">{t("auth.password.confirmLabel")}</Label>
              <PasswordInput
                id="fg-confirm"
                autoComplete="new-password"
                placeholder={t("auth.password.confirmPlaceholder")}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                invalid={Boolean(confirmError)}
              />
              <FieldError message={confirmError} />
            </div>
            <FormError message={error} />
            <Button type="submit" variant="gold" size="lg" className="w-full" loading={loading}>
              {t("auth.forgot.submit")}
            </Button>
          </motion.form>
        )}
      </AnimatePresence>

      <p className="mt-8 text-center text-sm text-ink-300">
        {t("auth.forgot.remembered")}{" "}
        <Link href="/login" className="font-semibold text-gold-300 underline-offset-4 hover:underline">
          {t("auth.forgot.login")}
        </Link>
      </p>
    </div>
  );
}
