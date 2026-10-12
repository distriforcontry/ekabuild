"use client";
import * as React from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { motion } from "motion/react";
import { ArrowRight, Award, Calendar, DocumentDownload, DocumentText, Eye, Lock, Unlock, Warning2 } from "iconsax-reactjs";
import type { AccessLevel } from "@eka/shared";
import type { CertificateItem, DocumentItem } from "@/lib/types";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { Tooltip } from "@/components/ui/tooltip";
import { useFormat } from "@/components/catalog/use-format";
import { useProject } from "../ProjectProvider";
import { FileViewerDialog } from "../FileViewerDialog";
import { CopyButton, Section, downloadUrl } from "../bits";
import { DRAWING_TYPES } from "./DrawingsTab";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://ekabuild.uz").replace(/\/$/, "");
const ACCESS_TONE: Record<AccessLevel, "success" | "gold" | "neutral"> = { PUBLIC: "success", BUYERS: "gold", PRIVATE: "neutral" };

export function DocumentsTab() {
  const { project: p } = useProject();
  const { t } = useI18n();
  const certs = p.certificates ?? [];
  const docs = (p.documents ?? []).filter((d) => !DRAWING_TYPES.includes(d.type));

  return (
    <div className="space-y-6">
      <Section icon={Award} title={t("catalog.documents.certificates")} description={t("catalog.documents.certificatesHint")}>
        {certs.length === 0 ? (
          <EmptyState icon={Award} title={t("catalog.documents.noCertificates")} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {certs.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: Math.min(i, 6) * 0.06, ease: [0.16, 1, 0.3, 1] }}
              >
                <CertificateCard cert={c} />
              </motion.div>
            ))}
          </div>
        )}
      </Section>

      <DocumentsTable docs={docs} />
    </div>
  );
}

function CertificateCard({ cert: c }: { cert: CertificateItem }) {
  const { t, label, tr } = useI18n();
  const fmt = useFormat();
  const days = fmt.daysUntil(c.validUntil);
  const expired = c.status === "EXPIRED" || (days !== null && days < 0);
  const soon = !expired && days !== null && days <= 60;
  const url = `${SITE_URL}/verify/${encodeURIComponent(c.code)}`;

  return (
    <article
      className={cn(
        "group relative flex h-full gap-4 overflow-hidden rounded-2xl border bg-ink-850 p-4 transition-colors duration-300 md:p-5",
        expired ? "border-danger/30" : soon ? "border-warning/30" : "border-line hover:border-gold-500/30",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-400">{label("certificateType", c.type)}</div>
        <div className="mt-1 flex items-center gap-1 font-mono text-[15px] font-semibold text-stone-100">
          <span className="truncate">№ {c.number}</span>
          <CopyButton value={c.number} />
        </div>
        <div className="mt-0.5 truncate text-sm text-ink-300">{tr(c.issuer)}</div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-ink-400">{t("catalog.documents.issuedAt")}</div>
            <div className="text-ink-100">{fmt.date(c.issuedAt)}</div>
          </div>
          <div>
            <div className="text-ink-400">{t("catalog.documents.validUntil")}</div>
            <div className={cn(expired ? "text-danger" : soon ? "text-warning" : "text-ink-100")}>
              {c.validUntil ? fmt.date(c.validUntil) : t("catalog.documents.indefinite")}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge kind="certificateStatus" value={c.status} />
          {expired && c.status !== "EXPIRED" && (
            <Badge tone="danger">
              <Warning2 variant="Bold" />
              {t("catalog.documents.expired")}
            </Badge>
          )}
          {soon && (
            <Badge tone="warning">
              <Calendar variant="Bold" />
              {t("catalog.date.daysLeft", { count: days! })}
            </Badge>
          )}
        </div>
        {c.note && <p className="mt-2 line-clamp-2 text-xs text-ink-400">{tr(c.note)}</p>}
        <Link
          href={`/verify/${encodeURIComponent(c.code)}`}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-gold-300 underline-offset-4 hover:underline"
        >
          {t("catalog.documents.verifyOnline")} <ArrowRight size={13} />
        </Link>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <Tooltip content={t("catalog.documents.scanQr")}>
          <Link href={`/verify/${encodeURIComponent(c.code)}`} className="block overflow-hidden rounded-xl shadow-card transition-transform duration-300 hover:scale-105" aria-label={t("catalog.documents.verifyOnline")}>
            <QRCodeSVG value={url} size={88} bgColor="#f4f1ea" fgColor="#121214" marginSize={2} level="M" />
          </Link>
        </Tooltip>
        <span className="font-mono text-[10px] text-ink-400" title={t("catalog.documents.code")}>
          {c.code}
        </span>
      </div>
    </article>
  );
}

function DocumentsTable({ docs }: { docs: DocumentItem[] }) {
  const { project: p, buy, loginHref, packagePurchase } = useProject();
  const { t, label, tr } = useI18n();
  const fmt = useFormat();
  const [viewing, setViewing] = React.useState<DocumentItem | null>(null);

  const unlock = (
    <>
      {!p.viewer.authenticated ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={loginHref("documents")}>
            <Unlock size={14} /> {t("catalog.documents.unlock")}
          </Link>
        </Button>
      ) : packagePurchase ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/app/purchases/${packagePurchase.id}`}>
            <Unlock size={14} /> {t("catalog.documents.unlock")}
          </Link>
        </Button>
      ) : p.packagePrice ? (
        <Button variant="outline" size="sm" onClick={() => buy({ kind: "DOCUMENT_PACKAGE" })}>
          <Unlock size={14} /> {t("catalog.documents.unlock")}
        </Button>
      ) : (
        <Lock size={16} className="text-ink-400" />
      )}
    </>
  );

  const columns: Column<DocumentItem>[] = [
    {
      key: "type",
      header: t("catalog.documents.cols.type"),
      sortValue: (d) => label("documentType", d.type),
      exportValue: (d) => label("documentType", d.type),
      cell: (d) => <span className="whitespace-nowrap text-ink-200">{label("documentType", d.type)}</span>,
    },
    {
      key: "title",
      header: t("catalog.documents.cols.title"),
      alwaysVisible: true,
      sortValue: (d) => d.title,
      exportValue: (d) => d.title,
      cell: (d) => (
        <div className="min-w-48 max-w-72">
          <div className="flex items-center gap-1.5 font-medium text-stone-100">
            {d.locked && <Lock size={14} className="shrink-0 text-ink-400" />}
            <span className="truncate">{tr(d.title)}</span>
          </div>
          {d.description && <div className="truncate text-xs text-ink-400">{tr(d.description)}</div>}
        </div>
      ),
    },
    {
      key: "number",
      header: t("catalog.documents.cols.number"),
      hideOnMobile: true,
      exportValue: (d) => d.number,
      cell: (d) => <span className="whitespace-nowrap font-mono text-xs text-ink-200">{d.number ?? "—"}</span>,
    },
    {
      key: "issuer",
      header: t("catalog.documents.cols.issuer"),
      hideOnMobile: true,
      exportValue: (d) => d.issuer,
      cell: (d) => <span className="line-clamp-2 max-w-48 text-ink-200">{d.issuer ? tr(d.issuer) : "—"}</span>,
    },
    {
      key: "dates",
      header: t("catalog.documents.cols.dates"),
      hideOnMobile: true,
      sortValue: (d) => d.issuedAt ?? d.createdAt,
      exportValue: (d) => d.issuedAt,
      cell: (d) => {
        const days = fmt.daysUntil(d.expiresAt);
        return (
          <div className="whitespace-nowrap text-xs">
            <div className="text-ink-200">{fmt.date(d.issuedAt ?? d.createdAt)}</div>
            {d.expiresAt && (
              <div className={cn(days !== null && days < 0 ? "text-danger" : days !== null && days <= 60 ? "text-warning" : "text-ink-400")}>
                → {fmt.date(d.expiresAt)}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      header: t("catalog.documents.cols.status"),
      sortValue: (d) => d.status,
      exportValue: (d) => label("verification", d.status),
      cell: (d) => <StatusBadge kind="verification" value={d.status} />,
    },
    {
      key: "access",
      header: t("catalog.documents.cols.access"),
      exportValue: (d) => label("access", d.access),
      cell: (d) => (
        <Badge tone={ACCESS_TONE[d.access]}>
          {d.locked ? <Lock variant="Bold" /> : <Unlock variant="Bold" />}
          {label("access", d.access)}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: t("catalog.documents.cols.actions"),
      align: "right",
      alwaysVisible: true,
      cell: (d) =>
        d.locked || !d.file ? (
          <div className="flex justify-end">{unlock}</div>
        ) : (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon-sm" onClick={() => setViewing(d)} aria-label={t("catalog.file.view")} title={t("catalog.file.view")}>
              <Eye size={16} />
            </Button>
            <Button variant="ghost" size="icon-sm" asChild>
              <a href={downloadUrl(d.file)} aria-label={t("catalog.file.download")} title={`${t("catalog.file.download")} · ${fmt.bytes(d.file.size)}`}>
                <DocumentDownload size={16} />
              </a>
            </Button>
          </div>
        ),
    },
  ];

  return (
    <Section icon={DocumentText} title={t("catalog.documents.documents")} description={t("catalog.documents.documentsHint")} bodyClassName="px-0 pb-0 md:px-0 md:pb-0">
      <DataTable
        columns={columns}
        data={docs}
        rowKey={(d) => d.id}
        searchText={(d) => [d.title, d.number, d.issuer, label("documentType", d.type)].filter(Boolean).join(" ")}
        exportName="eka-hujjatlar"
        emptyTitle={t("catalog.documents.noDocuments")}
        className="rounded-none rounded-b-3xl border-x-0 border-b-0 shadow-none"
        onRowClick={(d) => !d.locked && d.file && setViewing(d)}
      />
      <FileViewerDialog file={viewing?.file ?? null} title={viewing?.title ?? ""} open={Boolean(viewing?.file)} onOpenChange={(o) => !o && setViewing(null)} />
    </Section>
  );
}
