"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import type { Icon as IconType } from "iconsax-reactjs";
import { ArrowRight, Briefcase, Buildings, InfoCircle, Profile, TickCircle } from "iconsax-reactjs";
import { REGIONS, isTin } from "@eka/shared";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/api";
import { homeForRole } from "@/lib/roles";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AuthHeading, AuthStepper, stepMotion } from "./AuthFrame";
import { FieldError, FormError } from "./FormError";
import { OtpStep } from "./OtpStep";
import { PasswordInput, PasswordStrength } from "./PasswordInput";
import { PhoneInput } from "./PhoneInput";
import { authErrorMessage, errorCode, formatPhone, isEmail, isValidPhone, passwordProblem, type OtpSendResponse } from "./auth-utils";

type AccountType = "INDIVIDUAL" | "COMPANY" | "DEVELOPER";
const ACCOUNT_TYPES: { value: AccountType; icon: IconType }[] = [
  { value: "INDIVIDUAL", icon: Profile },
  { value: "COMPANY", icon: Briefcase },
  { value: "DEVELOPER", icon: Buildings },
];

type Details = {
  fullName: string;
  email: string;
  password: string;
  confirm: string;
  accountType: AccountType;
  orgName: string;
  tin: string;
  director: string;
  region: string | null;
  address: string;
  terms: boolean;
};

const EMPTY: Details = {
  fullName: "",
  email: "",
  password: "",
  confirm: "",
  accountType: "INDIVIDUAL",
  orgName: "",
  tin: "",
  director: "",
  region: null,
  address: "",
  terms: false,
};

export function RegisterForm() {
  const { t, tr } = useI18n();
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [phone, setPhone] = React.useState("");
  const [sent, setSent] = React.useState<OtpSendResponse | null>(null);
  const [token, setToken] = React.useState<string | null>(null);
  const [d, setD] = React.useState<Details>(EMPTY);
  const [touched, setTouched] = React.useState<Partial<Record<keyof Details, boolean>>>({});
  const [submitted, setSubmitted] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<{ message: string; code: string | null } | null>(null);

  const isCompany = d.accountType !== "INDIVIDUAL";
  const set = <K extends keyof Details>(k: K, v: Details[K]) => setD((p) => ({ ...p, [k]: v }));
  const touch = (k: keyof Details) => () => setTouched((p) => ({ ...p, [k]: true }));

  // ── validation
  const pwProblem = passwordProblem(d.password);
  const errors: Partial<Record<keyof Details, string>> = {
    fullName: d.fullName.trim().split(/\s+/).filter(Boolean).length < 2 ? t("auth.register.errors.fullName") : undefined,
    email: d.email && !isEmail(d.email.trim()) ? t("auth.register.errors.email") : undefined,
    password: pwProblem ? t(pwProblem) : undefined,
    confirm: !d.confirm ? t("auth.password.required") : d.confirm !== d.password ? t("auth.password.mismatch") : undefined,
    orgName: isCompany && d.orgName.trim().length < 2 ? t("auth.register.errors.orgName") : undefined,
    tin: isCompany && !isTin(d.tin) ? t("auth.register.errors.tin") : undefined,
    region: isCompany && !d.region ? t("auth.register.errors.region") : undefined,
    terms: !d.terms ? t("auth.register.terms.required") : undefined,
  };
  const show = (k: keyof Details) => ((touched[k] || submitted) && errors[k]) || null;
  const valid = Object.values(errors).every((e) => !e);

  const phoneError = submitted && step === 0 && !isValidPhone(phone) ? t("auth.phone.invalid") : null;

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!isValidPhone(phone)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<OtpSendResponse>("/auth/otp/send", { phone, purpose: "REGISTER" });
      setSent(res);
      setSubmitted(false);
      setStep(1);
    } catch (err) {
      setError({ message: authErrorMessage(err, t), code: errorCode(err) });
    } finally {
      setLoading(false);
    }
  };

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!valid || !token) return;
    setLoading(true);
    setError(null);
    try {
      const { user } = await api.post<{ user: User }>("/auth/register", {
        verificationToken: token,
        fullName: d.fullName.trim().replace(/\s+/g, " "),
        password: d.password,
        email: d.email.trim() || undefined,
        accountType: d.accountType,
        organization: isCompany
          ? {
              name: d.orgName.trim(),
              tin: d.tin,
              director: d.director.trim() || undefined,
              address: d.address.trim() || undefined,
              region: d.region ?? undefined,
            }
          : undefined,
      });
      toast.success(t("auth.register.success"));
      router.replace(homeForRole(user.role));
      router.refresh();
    } catch (err) {
      const code = errorCode(err);
      setError({ message: authErrorMessage(err, t), code });
      if (code === "TOKEN_EXPIRED" || code === "INVALID_TOKEN") {
        setToken(null);
        setSent(null);
        setStep(0);
      }
      setLoading(false);
    }
  };

  const steps = [t("auth.register.steps.phone"), t("auth.register.steps.otp"), t("auth.register.steps.details")];

  return (
    <div>
      <AuthHeading
        eyebrow={t("auth.register.stepOf", { n: step + 1, total: 3 })}
        title={t("auth.register.title")}
        subtitle={t("auth.register.subtitle")}
      />
      <AuthStepper steps={steps} current={step} />

      <AnimatePresence mode="wait" initial={false}>
        {step === 0 && (
          <motion.form key="phone" {...stepMotion} onSubmit={sendCode} noValidate className="space-y-5">
            <div>
              <Label htmlFor="reg-phone">{t("auth.phone.label")}</Label>
              <PhoneInput
                id="reg-phone"
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
            <FormError message={error?.message} />
            {error?.code === "PHONE_TAKEN" && (
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">{t("auth.register.login")}</Link>
              </Button>
            )}
            <Button type="submit" variant="gold" size="lg" className="w-full" loading={loading}>
              {t("auth.register.sendCode")} {!loading && <ArrowRight size={18} />}
            </Button>
          </motion.form>
        )}

        {step === 1 && sent && (
          <motion.div key="otp" {...stepMotion}>
            <OtpStep
              phone={phone}
              purpose="REGISTER"
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
          <motion.form key="details" {...stepMotion} onSubmit={register} noValidate className="space-y-6">
            <div className="flex items-center gap-2 rounded-xl border border-success/25 bg-success/[0.07] px-3.5 py-2.5 text-sm">
              <TickCircle size={18} variant="Bold" className="text-success" />
              <span className="text-ink-200">{t("auth.register.phoneVerified")}:</span>
              <span className="font-mono text-stone-100">{formatPhone(phone)}</span>
            </div>

            {/* account type */}
            <fieldset>
              <legend className="mb-2 text-xs font-semibold tracking-wide text-ink-200">{t("auth.register.accountType.label")}</legend>
              <div role="radiogroup" className="grid gap-2.5 sm:grid-cols-3">
                {ACCOUNT_TYPES.map(({ value, icon: Icon }) => {
                  const active = d.accountType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => set("accountType", value)}
                      className={cn(
                        "group relative flex cursor-pointer flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98]",
                        active ? "border-gold-400/70 bg-gold-500/[0.08] shadow-glow" : "border-line bg-ink-850 hover:border-line-strong",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-9 place-items-center rounded-lg transition-colors",
                          active ? "bg-gold-gradient text-onyx" : "bg-ink-800 text-ink-300 group-hover:text-gold-300",
                        )}
                      >
                        <Icon size={18} variant={active ? "Bold" : "Linear"} />
                      </span>
                      <span className="text-[13px] font-semibold leading-tight text-stone-100">{t(`auth.register.accountType.${value}.title`)}</span>
                      <span className="text-[11px] leading-snug text-ink-400">{t(`auth.register.accountType.${value}.text`)}</span>
                      {active && (
                        <motion.span layoutId="acct-check" className="absolute right-2.5 top-2.5 text-gold-300">
                          <TickCircle size={16} variant="Bold" />
                        </motion.span>
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* personal */}
            <div className="space-y-4">
              <SectionLabel>{t("auth.register.sections.personal")}</SectionLabel>
              <div>
                <Label htmlFor="reg-name">{t("auth.register.fields.fullName")}</Label>
                <Input
                  id="reg-name"
                  autoComplete="name"
                  className="h-12"
                  placeholder={t("auth.register.fields.fullNamePlaceholder")}
                  value={d.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                  onBlur={touch("fullName")}
                  aria-invalid={Boolean(show("fullName")) || undefined}
                  autoFocus
                />
                <FieldError message={show("fullName")} />
              </div>
              <div>
                <Label htmlFor="reg-email">
                  {t("auth.register.fields.email")} <span className="font-normal text-ink-400">({t("auth.register.fields.emailOptional")})</span>
                </Label>
                <Input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  className="h-12"
                  placeholder={t("auth.register.fields.emailPlaceholder")}
                  value={d.email}
                  onChange={(e) => set("email", e.target.value)}
                  onBlur={touch("email")}
                  aria-invalid={Boolean(show("email")) || undefined}
                />
                <FieldError message={show("email")} />
              </div>
            </div>

            {/* organization */}
            <AnimatePresence initial={false}>
              {isCompany && (
                <motion.div
                  key="org"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-4 rounded-2xl border border-line bg-ink-900/60 p-4">
                    <SectionLabel>{t("auth.register.sections.organization")}</SectionLabel>
                    <div>
                      <Label htmlFor="reg-org">{t("auth.register.fields.orgName")}</Label>
                      <Input
                        id="reg-org"
                        autoComplete="organization"
                        placeholder={t("auth.register.fields.orgNamePlaceholder")}
                        value={d.orgName}
                        onChange={(e) => set("orgName", e.target.value)}
                        onBlur={touch("orgName")}
                        aria-invalid={Boolean(show("orgName")) || undefined}
                      />
                      <FieldError message={show("orgName")} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="reg-tin">{t("auth.register.fields.tin")}</Label>
                        <Input
                          id="reg-tin"
                          inputMode="numeric"
                          maxLength={9}
                          className="font-mono tracking-wider"
                          placeholder={t("auth.register.fields.tinPlaceholder")}
                          value={d.tin}
                          onChange={(e) => set("tin", e.target.value.replace(/\D/g, "").slice(0, 9))}
                          onBlur={touch("tin")}
                          aria-invalid={Boolean(show("tin")) || undefined}
                        />
                        {show("tin") ? (
                          <FieldError message={show("tin")} />
                        ) : (
                          <p className="mt-1.5 text-xs text-ink-400">
                            {t("auth.register.fields.tinHint")} · <span className="font-mono">{d.tin.length}/9</span>
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="reg-director">{t("auth.register.fields.director")}</Label>
                        <Input
                          id="reg-director"
                          placeholder={t("auth.register.fields.directorPlaceholder")}
                          value={d.director}
                          onChange={(e) => set("director", e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>{t("auth.register.fields.region")}</Label>
                      <Combobox
                        aria-label={t("auth.register.fields.region")}
                        options={REGIONS.map((r) => ({ value: r, label: tr(r) }))}
                        value={d.region}
                        onChange={(v) => {
                          set("region", v);
                          setTouched((p) => ({ ...p, region: true }));
                        }}
                        placeholder={t("auth.register.fields.regionPlaceholder")}
                      />
                      <FieldError message={show("region")} />
                    </div>
                    <div>
                      <Label htmlFor="reg-address">{t("auth.register.fields.address")}</Label>
                      <Input
                        id="reg-address"
                        autoComplete="street-address"
                        placeholder={t("auth.register.fields.addressPlaceholder")}
                        value={d.address}
                        onChange={(e) => set("address", e.target.value)}
                      />
                    </div>
                    <p className="flex gap-2 text-xs leading-relaxed text-ink-400">
                      <InfoCircle size={16} variant="Bulk" className="mt-px shrink-0 text-info" />
                      {t("auth.register.orgReviewNote")}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* security */}
            <div className="space-y-4">
              <SectionLabel>{t("auth.register.sections.security")}</SectionLabel>
              <div>
                <Label htmlFor="reg-password">{t("auth.password.label")}</Label>
                <PasswordInput
                  id="reg-password"
                  autoComplete="new-password"
                  placeholder={t("auth.password.newPlaceholder")}
                  value={d.password}
                  onChange={(e) => set("password", e.target.value)}
                  onBlur={touch("password")}
                  invalid={Boolean(show("password"))}
                />
                <PasswordStrength password={d.password} />
                <FieldError message={show("password")} />
              </div>
              <div>
                <Label htmlFor="reg-confirm">{t("auth.password.confirmLabel")}</Label>
                <PasswordInput
                  id="reg-confirm"
                  autoComplete="new-password"
                  placeholder={t("auth.password.confirmPlaceholder")}
                  value={d.confirm}
                  onChange={(e) => set("confirm", e.target.value)}
                  onBlur={touch("confirm")}
                  invalid={Boolean(show("confirm"))}
                />
                <FieldError message={show("confirm")} />
              </div>
            </div>

            {/* terms */}
            <div>
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-ink-300">
                <input
                  type="checkbox"
                  checked={d.terms}
                  onChange={(e) => set("terms", e.target.checked)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition peer-focus-visible:ring-2 peer-focus-visible:ring-gold-400",
                    d.terms ? "border-gold-400 bg-gold-400 text-onyx" : "border-line-strong bg-ink-850",
                    show("terms") && "border-danger/70",
                  )}
                >
                  {d.terms && (
                    <svg viewBox="0 0 12 12" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m2.5 6 2.5 2.5 4.5-5" />
                    </svg>
                  )}
                </span>
                <span>
                  {t("auth.register.terms.prefix")}{" "}
                  <Link href="/about#terms" target="_blank" className="font-semibold text-gold-300 underline-offset-4 hover:underline">
                    {t("auth.register.terms.terms")}
                  </Link>{" "}
                  {t("auth.register.terms.and")}{" "}
                  <Link href="/about#privacy" target="_blank" className="font-semibold text-gold-300 underline-offset-4 hover:underline">
                    {t("auth.register.terms.privacy")}
                  </Link>{" "}
                  {t("auth.register.terms.suffix")}
                </span>
              </label>
              <FieldError message={show("terms")} />
            </div>

            <FormError message={error?.message} />
            <Button type="submit" variant="gold" size="lg" className="w-full" loading={loading}>
              {t("auth.register.submit")} {!loading && <ArrowRight size={18} />}
            </Button>
          </motion.form>
        )}
      </AnimatePresence>

      <p className="mt-8 text-center text-sm text-ink-300">
        {t("auth.register.hasAccount")}{" "}
        <Link href="/login" className="font-semibold text-gold-300 underline-offset-4 hover:underline">
          {t("auth.register.login")}
        </Link>
      </p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-ink-400">
      {children}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
