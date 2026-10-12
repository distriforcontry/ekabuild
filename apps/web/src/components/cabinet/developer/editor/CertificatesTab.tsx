"use client";
import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { ExportSquare, Verify } from "iconsax-reactjs";
import { CERTIFICATE_TYPES, type CertificateType } from "@eka/shared";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Field, Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { StatusBadge } from "@/components/ui/status-badge";
import { useI18n } from "@/i18n/client";
import { api, errorMessage } from "@/lib/api";
import type { ProjectDetail } from "@/lib/types";
import { useFmt } from "../../format";
import { FormSection } from "./fields";

export function CertificatesTab({ projectId, detail, onChanged }: { projectId: string; detail: ProjectDetail | null; onChanged: () => Promise<void> | void }) {
  const { t, label, tr } = useI18n();
  const fmt = useFmt();
  const [type, setType] = React.useState<CertificateType>("BUILDING_PERMIT");
  const [number, setNumber] = React.useState("");
  const [issuer, setIssuer] = React.useState("");
  const [issuedAt, setIssuedAt] = React.useState("");
  const [validUntil, setValidUntil] = React.useState("");
  const [documentId, setDocumentId] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [origin, setOrigin] = React.useState("https://ekabuild.uz");
  React.useEffect(() => setOrigin(window.location.origin), []);

  const req = t("app.developer.editor.basic.required");
  const errors = {
    number: number.trim() ? null : req,
    issuer: issuer.trim() ? null : req,
    issuedAt: issuedAt ? null : req,
    validUntil: validUntil && issuedAt && validUntil < issuedAt ? t("app.developer.editor.basic.invalidDate") : null,
  };
  const valid = Object.values(errors).every((e) => !e);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) return;
    setSaving(true);
    try {
      await api.post(`/dev/projects/${projectId}/certificates`, {
        type,
        number: number.trim(),
        issuer: issuer.trim(),
        issuedAt,
        validUntil: validUntil || undefined,
        documentId: documentId ?? undefined,
      });
      toast.success(t("app.developer.editor.certificates.success"));
      setNumber("");
      setIssuer("");
      setIssuedAt("");
      setValidUntil("");
      setDocumentId(null);
      setSubmitted(false);
      await onChanged();
    } catch (err) {
      toast.error(errorMessage(err, t("common.errors.generic")));
    } finally {
      setSaving(false);
    }
  };

  const certs = detail?.certificates ?? [];
  const docOptions = (detail?.documents ?? []).map((d) => ({ value: d.id, label: tr(d.title), description: label("documentType", d.type) }));
  const F = (k: "type" | "number" | "issuer" | "issuedAt" | "validUntil" | "document") => t(`app.developer.editor.certificates.fields.${k}`);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <FormSection title={t("app.developer.editor.certificates.title")} description={t("app.developer.editor.certificates.subtitle")} className="self-start">
        <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label={F("type")} className="sm:col-span-2">
            <Combobox
              options={CERTIFICATE_TYPES.map((v) => ({ value: v, label: label("certificateType", v) }))}
              value={type}
              onChange={(v) => v && setType(v as CertificateType)}
              clearable={false}
              aria-label={F("type")}
            />
          </Field>
          <Field label={F("number")} error={submitted ? errors.number : null} htmlFor="cert-number">
            <Input id="cert-number" className="font-mono" value={number} onChange={(e) => setNumber(e.target.value)} aria-invalid={Boolean(submitted && errors.number) || undefined} />
          </Field>
          <Field label={F("issuer")} error={submitted ? errors.issuer : null} htmlFor="cert-issuer">
            <Input id="cert-issuer" value={issuer} onChange={(e) => setIssuer(e.target.value)} aria-invalid={Boolean(submitted && errors.issuer) || undefined} />
          </Field>
          <Field label={F("issuedAt")} error={submitted ? errors.issuedAt : null} htmlFor="cert-issued">
            <DatePicker value={issuedAt || null} onChange={(v) => setIssuedAt(v ?? "")} aria-label={F("issuedAt")} />
          </Field>
          <Field label={F("validUntil")} error={submitted ? errors.validUntil : null} htmlFor="cert-valid">
            <DatePicker value={validUntil || null} onChange={(v) => setValidUntil(v ?? "")} min={issuedAt || undefined} aria-label={F("validUntil")} />
          </Field>
          <Field label={F("document")} className="sm:col-span-2">
            <Combobox options={docOptions} value={documentId} onChange={setDocumentId} aria-label={F("document")} />
          </Field>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" variant="gold" loading={saving}>
              {t("app.developer.editor.certificates.submit")}
            </Button>
          </div>
        </form>
      </FormSection>

      <div>
        <h3 className="mb-3 text-base font-semibold text-stone-100">
          {t("app.developer.editor.certificates.list")} <span className="font-mono text-sm text-ink-400">· {certs.length}</span>
        </h3>
        {certs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center text-sm text-ink-400">{t("app.developer.editor.certificates.empty")}</div>
        ) : (
          <ul className="grid gap-3">
            {certs.map((c, i) => (
              <motion.li
                key={c.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex gap-4 rounded-xl border border-line bg-ink-900 p-4"
              >
                <Link href={`/verify/${c.code}`} target="_blank" className="shrink-0 rounded-lg bg-[#faf8f3] p-1.5 transition hover:scale-105" aria-label={t("app.developer.editor.certificates.verifyPage")}>
                  <QRCodeSVG value={`${origin}/verify/${c.code}`} size={64} bgColor="#faf8f3" fgColor="#121214" level="M" />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-stone-100">{label("certificateType", c.type)}</span>
                    <StatusBadge kind="certificateStatus" value={c.status} />
                  </div>
                  <div className="mt-1 font-mono text-xs text-ink-200">№ {c.number}</div>
                  <div className="mt-1 text-xs text-ink-400">
                    {tr(c.issuer)} · {fmt.date(c.issuedAt)} ·{" "}
                    {c.validUntil ? t("app.developer.editor.certificates.validUntil", { date: fmt.date(c.validUntil) }) : t("app.developer.editor.certificates.indefinite")}
                  </div>
                  {c.note && <p className="mt-1.5 text-xs italic text-ink-300">{c.note}</p>}
                  <Link href={`/verify/${c.code}`} target="_blank" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gold-300 hover:underline">
                    <Verify size={13} variant="Bold" /> {t("app.developer.editor.certificates.verifyPage")} <span className="font-mono font-normal text-ink-400">{c.code}</span>
                    <ExportSquare size={12} />
                  </Link>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
