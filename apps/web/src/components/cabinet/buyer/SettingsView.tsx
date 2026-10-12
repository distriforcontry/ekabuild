"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Building, Call, LanguageCircle, Lock1, Monitor, Moon, Profile, Sun1, TickCircle, Verify } from "iconsax-reactjs";
import { isPinfl } from "@eka/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { FieldError } from "@/components/auth/FormError";
import { PasswordInput, PasswordStrength } from "@/components/auth/PasswordInput";
import { formatPhone, isEmail, passwordProblem } from "@/components/auth/auth-utils";
import { useI18n } from "@/i18n/client";
import { LOCALES, LOCALE_META, type Locale } from "@/i18n/config";
import { api, ApiError } from "@/lib/api";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCabinetUser } from "../CabinetContext";
import { useFmt } from "../format";
import { CopyButton, KV } from "../ui";

export function SettingsView() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader eyebrow={t("app.shell.area")} title={t("app.settings.title")} description={t("app.settings.subtitle")} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <ProfileCard />
          <PasswordCard />
        </div>
        <div className="space-y-6">
          <PreferencesCard />
          <OrganizationCard />
          <AccountCard />
        </div>
      </div>
    </div>
  );
}

function CardIcon({ icon: Icon }: { icon: typeof Profile }) {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/10 text-gold-300">
      <Icon size={18} variant="Bulk" />
    </span>
  );
}

function ProfileCard() {
  const { t } = useI18n();
  const router = useRouter();
  const { user, setUser } = useCabinetUser();
  const [fullName, setFullName] = React.useState(user.fullName);
  const [email, setEmail] = React.useState(user.email ?? "");
  const [pinfl, setPinfl] = React.useState(user.pinfl ?? "");
  const [submitted, setSubmitted] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const errors = {
    fullName: fullName.trim().length < 3 ? t("app.settings.profile.errors.fullName") : null,
    email: email && !isEmail(email.trim()) ? t("app.settings.profile.errors.email") : null,
    pinfl: pinfl && !isPinfl(pinfl) ? t("app.settings.profile.errors.pinfl") : null,
  };
  const dirty = fullName !== user.fullName || email !== (user.email ?? "") || pinfl !== (user.pinfl ?? "");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (errors.fullName || errors.email || errors.pinfl) return;
    setSaving(true);
    try {
      const res = await api.patch<{ user: User }>("/auth/me", {
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        pinfl: pinfl || undefined,
      });
      if (res?.user) setUser(res.user);
      toast.success(t("app.settings.profile.saved"));
      setSubmitted(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError && err.status === 0 ? t("common.errors.network") : err instanceof Error ? err.message : t("common.errors.generic"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <form onSubmit={save} noValidate>
        <CardHeader className="justify-start">
          <CardIcon icon={Profile} />
          <div>
            <CardTitle>{t("app.settings.profile.title")}</CardTitle>
            <CardDescription>{t("app.settings.profile.subtitle")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="st-name">{t("app.settings.profile.fullName")}</Label>
            <Input id="st-name" value={fullName} onChange={(e) => setFullName(e.target.value)} aria-invalid={Boolean(submitted && errors.fullName) || undefined} autoComplete="name" />
            <FieldError message={submitted ? errors.fullName : null} />
          </div>
          <div>
            <Label htmlFor="st-phone">{t("app.settings.profile.phone")}</Label>
            <div className="flex h-11 items-center gap-2 rounded-xl border border-line bg-ink-850/50 px-3.5">
              <Call size={16} className="text-ink-400" />
              <span id="st-phone" className="flex-1 font-mono text-sm text-ink-200">
                {formatPhone(user.phone)}
              </span>
              {user.phoneVerifiedAt && (
                <Badge tone="success">
                  <Verify variant="Bold" /> {t("app.settings.profile.verified")}
                </Badge>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="st-email">
              {t("app.settings.profile.email")} <span className="font-normal text-ink-400">({t("app.common.optional")})</span>
            </Label>
            <Input id="st-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(submitted && errors.email) || undefined} autoComplete="email" />
            <FieldError message={submitted ? errors.email : null} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="st-pinfl">{t("app.settings.profile.pinfl")}</Label>
            <Input
              id="st-pinfl"
              inputMode="numeric"
              maxLength={14}
              className="font-mono tracking-wider"
              value={pinfl}
              onChange={(e) => setPinfl(e.target.value.replace(/\D/g, "").slice(0, 14))}
              aria-invalid={Boolean(submitted && errors.pinfl) || undefined}
              placeholder="12345678901234"
            />
            {submitted && errors.pinfl ? (
              <FieldError message={errors.pinfl} />
            ) : (
              <p className="mt-1.5 text-xs text-ink-400">
                {t("app.settings.profile.pinflHint")} · <span className="font-mono">{pinfl.length}/14</span>
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" variant="gold" loading={saving} disabled={!dirty}>
            {t("app.settings.profile.save")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const { t } = useI18n();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const problem = passwordProblem(next);
  const errors = {
    current: !current ? t("auth.password.required") : serverError,
    next: problem ? t(problem) : null,
    confirm: !confirm ? t("auth.password.required") : confirm !== next ? t("auth.password.mismatch") : null,
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setServerError(null);
    if (!current || problem || confirm !== next) return;
    setSaving(true);
    try {
      await api.post("/auth/password", { current, next });
      toast.success(t("app.settings.password.success"));
      setCurrent("");
      setNext("");
      setConfirm("");
      setSubmitted(false);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 400 || err.status === 401 || err.status === 403)) setServerError(t("app.settings.password.wrongCurrent"));
      else toast.error(err instanceof ApiError && err.status === 0 ? t("common.errors.network") : t("common.errors.generic"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <form onSubmit={submit} noValidate>
        <CardHeader className="justify-start">
          <CardIcon icon={Lock1} />
          <div>
            <CardTitle>{t("app.settings.password.title")}</CardTitle>
            <CardDescription>{t("app.settings.password.subtitle")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2 md:max-w-[calc(50%-0.625rem)]">
            <Label htmlFor="pw-current">{t("app.settings.password.current")}</Label>
            <PasswordInput
              id="pw-current"
              autoComplete="current-password"
              value={current}
              onChange={(e) => {
                setCurrent(e.target.value);
                setServerError(null);
              }}
              invalid={Boolean(submitted && errors.current)}
              className="h-11"
            />
            <FieldError message={submitted || serverError ? errors.current : null} />
          </div>
          <div>
            <Label htmlFor="pw-next">{t("app.settings.password.next")}</Label>
            <PasswordInput id="pw-next" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} invalid={Boolean(submitted && errors.next)} className="h-11" />
            <PasswordStrength password={next} showRules={false} />
            <FieldError message={submitted ? errors.next : null} />
          </div>
          <div>
            <Label htmlFor="pw-confirm">{t("app.settings.password.confirm")}</Label>
            <PasswordInput id="pw-confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} invalid={Boolean(submitted && errors.confirm)} className="h-11" />
            <FieldError message={submitted ? errors.confirm : null} />
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" variant="secondary" loading={saving}>
            {t("app.settings.password.submit")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function PreferencesCard() {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const changeLocale = (l: Locale) => {
    if (l === locale) return;
    setLocale(l);
    void api.patch("/auth/me", { locale: l }).catch(() => undefined);
  };

  const themes = [
    { value: "dark", icon: Moon, swatch: "bg-[#0b0c0e]", accent: "bg-[#c9a464]" },
    { value: "light", icon: Sun1, swatch: "bg-[#f6f4ef]", accent: "bg-[#b08a4e]" },
    { value: "system", icon: Monitor, swatch: "bg-[linear-gradient(135deg,#0b0c0e_50%,#f6f4ef_50%)]", accent: "bg-[#c9a464]" },
  ] as const;

  return (
    <Card>
      <CardHeader className="justify-start">
        <CardIcon icon={LanguageCircle} />
        <div>
          <CardTitle>{t("app.settings.preferences.title")}</CardTitle>
          <CardDescription>{t("app.settings.preferences.subtitle")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <fieldset>
          <legend className="mb-2 text-xs font-semibold tracking-wide text-ink-200">{t("app.settings.preferences.language")}</legend>
          <div role="radiogroup" className="grid grid-cols-3 gap-2">
            {LOCALES.map((l) => {
              const active = l === locale;
              return (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => changeLocale(l)}
                  className={cn(
                    "relative flex cursor-pointer flex-col items-start gap-1 rounded-xl border p-3 text-left transition",
                    active ? "border-gold-400/70 bg-gold-500/[0.08]" : "border-line bg-ink-850 hover:border-line-strong",
                  )}
                >
                  <span className="font-mono text-xs font-bold text-gold-300">{LOCALE_META[l].short}</span>
                  <span className="text-xs text-stone-100">{LOCALE_META[l].label}</span>
                  {active && (
                    <motion.span layoutId="pref-locale" className="absolute right-2 top-2 text-gold-300">
                      <TickCircle size={14} variant="Bold" />
                    </motion.span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-xs font-semibold tracking-wide text-ink-200">{t("app.settings.preferences.theme")}</legend>
          <div role="radiogroup" className="grid grid-cols-3 gap-2">
            {themes.map((th) => {
              const active = mounted && theme === th.value;
              const Icon = th.icon;
              return (
                <button
                  key={th.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTheme(th.value)}
                  className={cn(
                    "group relative cursor-pointer overflow-hidden rounded-xl border p-2 text-left transition",
                    active ? "border-gold-400/70 bg-gold-500/[0.08]" : "border-line bg-ink-850 hover:border-line-strong",
                  )}
                >
                  <span className={cn("relative block h-14 overflow-hidden rounded-lg border border-line", th.swatch)}>
                    <span className={cn("absolute bottom-2 left-2 h-1.5 w-8 rounded-full", th.accent)} />
                    <span className="absolute left-2 top-2 h-1.5 w-12 rounded-full bg-[#88888855]" />
                  </span>
                  <span className="mt-2 flex items-center gap-1.5 px-1 text-xs font-medium text-stone-100">
                    <Icon size={14} variant={active ? "Bold" : "Linear"} className={active ? "text-gold-300" : "text-ink-400"} />
                    {t(`app.settings.preferences.themes.${th.value}`)}
                  </span>
                  <span className="block px-1 text-[10px] text-ink-400">{t(`app.settings.preferences.themeHints.${th.value}`)}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </CardContent>
    </Card>
  );
}

function OrganizationCard() {
  const { t, label, tr } = useI18n();
  const fmt = useFmt();
  const { user } = useCabinetUser();
  const org = user.organization;
  return (
    <Card>
      <CardHeader className="justify-start">
        <CardIcon icon={Building} />
        <div className="min-w-0 flex-1">
          <CardTitle>{t("app.settings.organization.title")}</CardTitle>
          <CardDescription>{t("app.settings.organization.subtitle")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {!org ? (
          <div className="rounded-xl border border-dashed border-line-strong p-4 text-center">
            <div className="text-sm font-semibold text-stone-100">{t("app.settings.organization.none")}</div>
            <p className="mt-1 text-xs text-ink-400">{t("app.settings.organization.noneHint")}</p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-semibold text-stone-100">{tr(org.name)}</div>
                {org.legalName && <div className="truncate text-xs text-ink-400">{tr(org.legalName)}</div>}
              </div>
              <StatusBadge kind="verification" value={org.status} />
            </div>
            {org.status !== "VERIFIED" && (
              <p
                className={cn(
                  "mb-3 rounded-lg border px-3 py-2 text-xs leading-relaxed",
                  org.status === "REJECTED" ? "border-danger/25 bg-danger/[0.06] text-danger" : "border-warning/25 bg-warning/[0.06] text-warning",
                )}
              >
                {org.status === "REJECTED" ? t("app.settings.organization.rejected") : t("app.settings.organization.pending")}
              </p>
            )}
            <KV
              items={[
                { label: t("app.settings.organization.type"), value: label("orgType", org.type) },
                { label: t("app.settings.organization.tin"), value: org.tin, mono: true },
                ...(org.director ? [{ label: t("app.settings.organization.director"), value: tr(org.director) }] : []),
                ...(org.region ? [{ label: t("app.settings.organization.region"), value: tr(org.region) }] : []),
                ...(org.address ? [{ label: t("app.settings.organization.address"), value: tr(org.address) }] : []),
                ...(org.licenseNumber ? [{ label: t("app.settings.organization.license"), value: org.licenseNumber, mono: true }] : []),
                ...(org.verifiedAt ? [{ label: t("app.settings.organization.verifiedAt"), value: fmt.date(org.verifiedAt) }] : []),
              ]}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AccountCard() {
  const { t, label } = useI18n();
  const fmt = useFmt();
  const { user } = useCabinetUser();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("app.settings.account.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <KV
          items={[
            { label: t("app.settings.account.role"), value: <Badge tone="gold">{label("role", user.role)}</Badge> },
            { label: t("app.settings.account.createdAt"), value: fmt.date(user.createdAt) },
            {
              label: t("app.settings.account.id"),
              value: (
                <span className="inline-flex items-center gap-1">
                  <span className="max-w-36 truncate font-mono text-xs text-ink-300">{user.id}</span>
                  <CopyButton text={user.id} className="size-7" />
                </span>
              ),
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}
