"use client";
import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Code, Edit2, MessageText1, Refresh } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import { OtpInput } from "./OtpInput";
import { authErrorMessage, errorCode, formatPhone, type OtpPurpose, type OtpSendResponse } from "./auth-utils";
import { FormError } from "./FormError";

export type OtpVerifyResult = { verificationToken?: string; user?: User };

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Enter the SMS code: auto-submit on 6 digits, resend countdown, dev-mode code hint. */
export function OtpStep({
  phone,
  purpose,
  sent,
  onVerified,
  onChangePhone,
}: {
  phone: string;
  purpose: OtpPurpose;
  sent: OtpSendResponse;
  onVerified: (r: OtpVerifyResult) => void | Promise<void>;
  onChangePhone: () => void;
}) {
  const { t } = useI18n();
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errorKey, setErrorKey] = React.useState(0);
  const [devCode, setDevCode] = React.useState(sent.devCode ?? null);
  const [resendIn, setResendIn] = React.useState(sent.resendIn ?? 60);

  React.useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendIn > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const verify = async (value = code) => {
    if (value.length !== 6 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<OtpVerifyResult>("/auth/otp/verify", { phone, code: value, purpose });
      await onVerified(res);
    } catch (e) {
      setError(authErrorMessage(e, t));
      setErrorKey((k) => k + 1);
      setCode("");
      if (errorCode(e) === "CODE_EXPIRED") setResendIn(0);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setError(null);
    try {
      const res = await api.post<OtpSendResponse>("/auth/otp/send", { phone, purpose });
      setResendIn(res.resendIn ?? 60);
      setDevCode(res.devCode ?? null);
      setCode("");
      toast.success(t("auth.otp.resent"));
    } catch (e) {
      setError(authErrorMessage(e, t));
    } finally {
      setResending(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void verify();
      }}
      className="space-y-6"
      noValidate
    >
      <div className="flex items-start gap-4 rounded-2xl border border-line bg-ink-850/60 p-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/10 text-gold-300">
          <MessageText1 size={20} variant="Bulk" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-stone-100">{t("auth.otp.title")}</div>
          <p className="mt-0.5 text-sm text-ink-300">{t("auth.otp.sentTo", { phone: formatPhone(phone) })}</p>
          <button
            type="button"
            onClick={onChangePhone}
            className="mt-1.5 inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-gold-300 underline-offset-4 transition hover:underline"
          >
            <Edit2 size={13} /> {t("auth.otp.changePhone")}
          </button>
        </div>
      </div>

      <div>
        <OtpInput
          value={code}
          onChange={(v) => {
            setCode(v);
            if (error) setError(null);
          }}
          onComplete={(v) => void verify(v)}
          errorKey={errorKey}
          invalid={Boolean(error)}
          disabled={loading}
        />
        <FormError message={error} className="mt-3" />
      </div>

      <AnimatePresence>
        {devCode && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-3 rounded-xl border border-dashed border-gold-500/40 bg-gold-500/[0.06] px-4 py-3"
          >
            <Code size={18} variant="Bulk" className="shrink-0 text-gold-300" />
            <div className="min-w-0 flex-1 text-xs leading-relaxed text-ink-300">
              <span className="font-semibold uppercase tracking-wider text-gold-300">{t("auth.otp.devTitle")} · </span>
              {t("auth.otp.devHint")} <span className="font-mono text-sm font-semibold tracking-[0.2em] text-stone-100">{devCode}</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setCode(devCode);
                void verify(devCode);
              }}
            >
              {t("auth.otp.devFill")}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <Button type="submit" variant="gold" size="lg" className="w-full" loading={loading} disabled={code.length !== 6}>
        {loading ? t("auth.otp.verifying") : t("auth.otp.verify")}
      </Button>

      <div className="flex flex-col items-center gap-1 text-center text-sm">
        {resendIn > 0 ? (
          <span className="text-ink-400" aria-live="polite">
            {t("auth.otp.resendIn", { time: fmtTime(resendIn) })}
          </span>
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={resend} loading={resending}>
            {!resending && <Refresh size={14} />} {t("auth.otp.resend")}
          </Button>
        )}
        <span className="text-xs text-ink-500">{t("auth.otp.expires")}</span>
      </div>
    </form>
  );
}
