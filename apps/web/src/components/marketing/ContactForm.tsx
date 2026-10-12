"use client";
import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Messages3, Send2, TickCircle, Warning2 } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Field, Input, Textarea } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { SupportMessage, SupportThread } from "@/lib/types";
import { useI18n } from "@/i18n/client";
import { normalizeUzPhone, openSupport, refreshSupport, writeGuestToken } from "@/components/support/support-utils";

const TOPICS = ["general", "buy", "developer", "verify", "complaint", "technical"] as const;
type Topic = (typeof TOPICS)[number];

/** Contact form → opens a support thread (POST /support/threads) the visitor can continue in the chat widget. */
export function ContactForm({ defaultName = "" }: { defaultName?: string }) {
  const { t } = useI18n();
  const [name, setName] = React.useState(defaultName);
  const [phone, setPhone] = React.useState("");
  const [topic, setTopic] = React.useState<string | null>("general");
  const [message, setMessage] = React.useState("");
  const [errors, setErrors] = React.useState<{ name?: string; phone?: string; message?: string }>({});
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const ids = { name: React.useId(), phone: React.useId(), msg: React.useId() };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = t("landing.pages.contact.errorName");
    const normalized = normalizeUzPhone(phone);
    if (!normalized) errs.phone = t("landing.pages.contact.errorPhone");
    if (message.trim().length < 10) errs.message = t("landing.pages.contact.errorMessage");
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    setFailed(false);
    try {
      const subject = t(`landing.pages.contact.topics.${(topic ?? "general") as Topic}`);
      const res = await api.post<{ thread: SupportThread; messages: SupportMessage[]; guestToken?: string }>(
        "/support/threads",
        { subject, body: message.trim(), guestName: name.trim(), guestPhone: normalized },
        { retry: false },
      );
      if (res?.guestToken) writeGuestToken(res.guestToken);
      refreshSupport();
      setDone(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setMessage("");
    setDone(false);
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {done ? (
        <motion.div
          key="done"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center py-10 text-center"
          role="status"
        >
          <motion.span
            initial={{ scale: 0, rotate: -25 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 15, delay: 0.1 }}
            className="grid size-20 place-items-center rounded-full bg-success/15 text-success"
          >
            <TickCircle size={44} variant="Bold" />
          </motion.span>
          <h3 className="mt-6 font-display text-3xl text-stone-100">{t("landing.pages.contact.success")}</h3>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-300">{t("landing.pages.contact.successText")}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button variant="gold" size="lg" onClick={() => openSupport()}>
              <Messages3 variant="Bold" />
              {t("landing.pages.contact.openChat")}
            </Button>
            <Button variant="ghost" size="lg" onClick={reset}>
              {t("landing.pages.contact.sendAnother")}
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.form key="form" onSubmit={submit} noValidate initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t("landing.pages.contact.name")} htmlFor={ids.name} error={errors.name}>
              <Input
                id={ids.name}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("landing.pages.contact.namePlaceholder")}
                autoComplete="name"
                aria-invalid={!!errors.name || undefined}
                required
              />
            </Field>
            <Field label={t("landing.pages.contact.phoneField")} htmlFor={ids.phone} error={errors.phone}>
              <Input
                id={ids.phone}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 __ ___ __ __"
                inputMode="tel"
                autoComplete="tel"
                className="font-mono"
                aria-invalid={!!errors.phone || undefined}
                required
              />
            </Field>
          </div>
          <Field label={t("landing.pages.contact.topic")}>
            <Combobox
              aria-label={t("landing.pages.contact.topic")}
              searchable={false}
              clearable={false}
              value={topic}
              onChange={setTopic}
              options={TOPICS.map((k) => ({ value: k, label: t(`landing.pages.contact.topics.${k}`) }))}
            />
          </Field>
          <Field label={t("landing.pages.contact.message")} htmlFor={ids.msg} error={errors.message}>
            <Textarea
              id={ids.msg}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("landing.pages.contact.messagePlaceholder")}
              className="min-h-36"
              maxLength={4000}
              aria-invalid={!!errors.message || undefined}
              required
            />
          </Field>
          {failed && (
            <div role="alert" className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm">
              <Warning2 size={18} variant="Bold" className="mt-0.5 shrink-0 text-danger" />
              <span className="text-ink-200">
                {t("landing.support.startError")}{" "}
                <a href={t("common.contact.phoneHref")} className="whitespace-nowrap font-mono font-semibold text-stone-100 underline-offset-4 hover:underline">
                  {t("common.contact.phone")}
                </a>
              </span>
            </div>
          )}
          <div className="flex flex-col-reverse gap-4 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-sm text-xs leading-relaxed text-ink-400">{t("landing.pages.contact.privacy")}</p>
            <Button type="submit" variant="gold" size="lg" loading={busy} className="shrink-0">
              {!busy && <Send2 variant="Bold" />}
              {t("landing.pages.contact.submit")}
            </Button>
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
