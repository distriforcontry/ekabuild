"use client";
import * as React from "react";
import { motion } from "motion/react";
import { Danger, TickCircle } from "iconsax-reactjs";
import { toast } from "sonner";
import { COMPLAINT_CATEGORIES, type ComplaintCategory } from "@eka/shared";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api";
import { useI18n } from "@/i18n/client";

/**
 * "Report fraud" button + dialog → POST /complaints.
 * `context` (e.g. the certificate code) is prepended to the message so moderators know what it is about.
 */
export function ReportFraudDialog({
  context,
  projectId,
  defaultCategory = "FAKE_DOCUMENT",
  label,
  variant = "danger",
  size = "lg",
  className,
}: {
  context?: string;
  projectId?: string;
  defaultCategory?: ComplaintCategory;
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const { t, label: enumLabel } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState<string | null>(defaultCategory);
  const [message, setMessage] = React.useState("");
  const [contact, setContact] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [doneId, setDoneId] = React.useState<string | null>(null);
  const ids = { msg: React.useId(), contact: React.useId() };

  const reset = () => {
    setMessage("");
    setContact("");
    setError(null);
    setDoneId(null);
    setCategory(defaultCategory);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 10) {
      setError(t("landing.complaint.errorMessage"));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const body = context ? `[${context}]\n\n${message.trim()}` : message.trim();
      const res = await api.post<{ id: string }>("/complaints", {
        projectId: projectId || undefined,
        category: category ?? "OTHER",
        message: body,
        contact: contact.trim() || undefined,
      });
      setDoneId(res?.id ?? "—");
    } catch (err) {
      toast.error(errorMessage(err, t("common.errors.generic")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setTimeout(reset, 300);
      }}
    >
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Danger variant="Bold" />
          {label ?? t("landing.complaint.button")}
        </Button>
      </DialogTrigger>
      <DialogContent size="md">
        {doneId ? (
          <div className="px-6 py-10 text-center">
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 240, damping: 16 }}
              className="mx-auto grid size-16 place-items-center rounded-full bg-success/15 text-success"
            >
              <TickCircle size={34} variant="Bold" />
            </motion.div>
            <DialogTitle className="mt-5 text-xl">{t("landing.complaint.success")}</DialogTitle>
            <DialogDescription className="mx-auto mt-2 max-w-sm">{t("landing.complaint.successText", { id: doneId })}</DialogDescription>
            <Button variant="secondary" className="mt-6" onClick={() => setOpen(false)}>
              {t("landing.complaint.done")}
            </Button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-danger/15 text-danger">
                  <Danger size={16} variant="Bold" />
                </span>
                {t("landing.complaint.title")}
              </DialogTitle>
              <DialogDescription>{t("landing.complaint.description")}</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              {context && <div className="rounded-xl border border-line bg-ink-850 px-3 py-2 font-mono text-xs text-ink-300">{context}</div>}
              <Field label={t("landing.complaint.category")}>
                <Combobox
                  aria-label={t("landing.complaint.category")}
                  searchable={false}
                  clearable={false}
                  value={category}
                  onChange={setCategory}
                  options={COMPLAINT_CATEGORIES.map((c) => ({ value: c, label: enumLabel("complaintCategory", c) }))}
                />
              </Field>
              <Field label={t("landing.complaint.message")} htmlFor={ids.msg} error={error ?? undefined}>
                <Textarea
                  id={ids.msg}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t("landing.complaint.messagePlaceholder")}
                  aria-invalid={!!error || undefined}
                  maxLength={4000}
                  required
                />
              </Field>
              <Field label={t("landing.complaint.contact")} htmlFor={ids.contact}>
                <Input
                  id={ids.contact}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder={t("landing.complaint.contactPlaceholder")}
                  autoComplete="tel"
                />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t("common.actions.cancel")}
              </Button>
              <Button type="submit" variant="danger" loading={busy}>
                {t("landing.complaint.submit")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
