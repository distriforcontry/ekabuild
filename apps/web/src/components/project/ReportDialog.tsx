"use client";
import * as React from "react";
import { toast } from "sonner";
import { Flag, ShieldSecurity } from "iconsax-reactjs";
import { COMPLAINT_CATEGORIES } from "@eka/shared";
import { api, errorMessage } from "@/lib/api";
import { useI18n } from "@/i18n/client";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Field, Input, Textarea } from "@/components/ui/input";

/** "Shikoyat" — POST /complaints { projectId, category, message, contact? } */
export function ReportDialog({ projectId, open, onOpenChange }: { projectId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t, label } = useI18n();
  const [category, setCategory] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState("");
  const [contact, setContact] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setTouched(false);
    }
  }, [open]);

  const valid = Boolean(category) && message.trim().length >= 10;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    setBusy(true);
    try {
      await api.post("/complaints", { projectId, category, message: message.trim(), contact: contact.trim() || undefined });
      toast.success(t("catalog.report.success"));
      setCategory(null);
      setMessage("");
      setContact("");
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, t("common.errors.generic")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <div className="mb-3 grid size-11 place-items-center rounded-xl border border-danger/25 bg-danger/10 text-danger">
              <Flag size={20} variant="Bold" />
            </div>
            <DialogTitle>{t("catalog.report.title")}</DialogTitle>
            <DialogDescription>{t("catalog.report.description")}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label={t("catalog.report.category")} error={touched && !category ? t("common.errors.required") : undefined}>
              <Combobox
                aria-label={t("catalog.report.category")}
                options={COMPLAINT_CATEGORIES.map((c) => ({ value: c, label: label("complaintCategory", c) }))}
                value={category}
                onChange={setCategory}
                placeholder={t("catalog.report.categoryPlaceholder")}
                searchable={false}
              />
            </Field>
            <Field
              label={t("catalog.report.message")}
              htmlFor="report-message"
              hint={t("catalog.report.messageHint")}
              error={touched && message.trim().length < 10 ? t("catalog.report.messageHint") : undefined}
            >
              <Textarea
                id="report-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("catalog.report.messagePlaceholder")}
                maxLength={2000}
                aria-invalid={touched && message.trim().length < 10}
              />
            </Field>
            <Field label={t("catalog.report.contact")} htmlFor="report-contact">
              <Input id="report-contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder={t("catalog.report.contactPlaceholder")} maxLength={120} />
            </Field>
            <p className="flex items-center gap-2 text-xs text-ink-400">
              <ShieldSecurity size={15} className="text-success" />
              {t("catalog.report.anonymous")}
            </p>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              {t("common.actions.cancel")}
            </Button>
            <Button type="submit" variant="danger" loading={busy}>
              {t("catalog.report.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
