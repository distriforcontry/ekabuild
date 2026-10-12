"use client";
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CloseCircle, DocumentText, Eye, ShieldCross, TickCircle, Verify } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label, Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n/client";
import { api, errorMessage } from "@/lib/api";
import type { CertificateItem, FileRef } from "@/lib/types";
import type { DocumentType, VerificationStatus } from "@eka/shared";
import { cn } from "@/lib/utils";
import { FilePreviewDialog } from "../FilePreviewDialog";
import { FileTypeIcon } from "../FileTypeIcon";
import { useApi, type ApiState } from "../hooks";
import { useFmt } from "../format";

export type QueueCert = CertificateItem & { project: { slug: string; name: string } };
export type QueueDoc = {
  id: string;
  type: DocumentType;
  title: string;
  number: string | null;
  issuer: string | null;
  status: VerificationStatus;
  createdAt: string;
  project: { slug: string; name: string };
  file: FileRef | null;
};
export type Queue = { certificates: QueueCert[]; documents: QueueDoc[] };
type Decision = "VERIFIED" | "REJECTED" | "REVOKED";
type Target = { kind: "certificate"; item: QueueCert } | { kind: "document"; item: QueueDoc };
export type QueueTab = "certificates" | "documents";

/** GET /inspector/queue, normalised (never throws). */
export function useInspectorQueue(): ApiState<Queue> {
  return useApi<Queue>("/inspector/queue", undefined, {
    select: (r) => {
      const q = (r ?? {}) as Partial<Queue>;
      return { certificates: Array.isArray(q.certificates) ? q.certificates : [], documents: Array.isArray(q.documents) ? q.documents : [] };
    },
  });
}

export const isExpired = (c: QueueCert) => Boolean(c.validUntil && new Date(c.validUntil).getTime() < Date.now());

/** Tabbed verification queue (certificates / documents) with quick verify / reject / revoke. */
export function InspectorQueue({ state, compact, initialTab = "certificates" }: { state: ApiState<Queue>; compact?: boolean; initialTab?: QueueTab }) {
  const { t, label, tr } = useI18n();
  const fmt = useFmt();
  const { data, loading, setData } = state;
  const [tab, setTab] = React.useState<QueueTab>(initialTab);
  const [decision, setDecision] = React.useState<{ target: Target; status: Decision } | null>(null);
  const [preview, setPreview] = React.useState<{ file: FileRef; title: string } | null>(null);

  const certs = data?.certificates ?? [];
  const docs = data?.documents ?? [];

  // open the tab that actually has work once the queue arrives (unless a tab was asked for explicitly)
  const autoPicked = React.useRef(initialTab !== "certificates");
  React.useEffect(() => {
    if (autoPicked.current || !data) return;
    autoPicked.current = true;
    if (!data.certificates.length && data.documents.length) setTab("documents");
  }, [data]);

  const onDone = (target: Target) => {
    setData((q) =>
      q
        ? target.kind === "certificate"
          ? { ...q, certificates: q.certificates.filter((c) => c.id !== target.item.id) }
          : { ...q, documents: q.documents.filter((d) => d.id !== target.item.id) }
        : q,
    );
  };

  const actions = (target: Target, revoke = false) => (
    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
      <Button size="sm" variant="success" onClick={() => setDecision({ target, status: "VERIFIED" })} aria-label={t("app.inspector.dashboard.verify")}>
        <TickCircle size={14} variant="Bold" /> <span className="hidden xl:inline">{t("app.inspector.dashboard.verify")}</span>
      </Button>
      <Tooltip content={t("app.inspector.dashboard.reject")}>
        <Button
          size="icon-sm"
          variant="ghost"
          className="text-danger hover:bg-danger/10 hover:text-danger"
          onClick={() => setDecision({ target, status: "REJECTED" })}
          aria-label={t("app.inspector.dashboard.reject")}
        >
          <CloseCircle size={16} />
        </Button>
      </Tooltip>
      {revoke && (
        <Tooltip content={t("app.inspector.dashboard.revoke")}>
          <Button size="icon-sm" variant="ghost" className="text-ink-300 hover:text-danger" onClick={() => setDecision({ target, status: "REVOKED" })} aria-label={t("app.inspector.dashboard.revoke")}>
            <ShieldCross size={16} />
          </Button>
        </Tooltip>
      )}
    </div>
  );

  const certColumns: Column<QueueCert>[] = [
    {
      key: "item",
      header: t("app.inspector.dashboard.columns.item"),
      alwaysVisible: true,
      cell: (c) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/10 text-gold-300">
            <Verify size={18} variant="Bulk" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-stone-100">{label("certificateType", c.type)}</div>
            <div className="truncate font-mono text-xs text-ink-400">
              № {c.number}
              <span className="font-sans md:hidden"> · {tr(c.project.name)}</span>
            </div>
          </div>
        </div>
      ),
      sortValue: (c) => c.number,
      exportValue: (c) => c.number,
    },
    {
      key: "project",
      header: t("app.inspector.dashboard.columns.project"),
      cell: (c) => (
        <Link href={`/projects/${c.project.slug}`} target="_blank" onClick={(e) => e.stopPropagation()} className="text-sm text-ink-100 hover:text-gold-300">
          {tr(c.project.name)}
        </Link>
      ),
      sortValue: (c) => c.project.name,
      exportValue: (c) => c.project.name,
      hideOnMobile: true,
    },
    { key: "issuer", header: t("app.inspector.dashboard.columns.issuer"), cell: (c) => <span className="text-sm text-ink-200">{tr(c.issuer)}</span>, exportValue: (c) => c.issuer, hideOnMobile: true },
    {
      key: "issued",
      header: t("app.inspector.dashboard.columns.issued"),
      cell: (c) => <span className="whitespace-nowrap text-xs text-ink-300">{fmt.date(c.issuedAt)}</span>,
      sortValue: (c) => new Date(c.issuedAt),
      exportValue: (c) => c.issuedAt.slice(0, 10),
      hideOnMobile: true,
    },
    {
      key: "validUntil",
      header: t("app.inspector.dashboard.columns.validUntil"),
      cell: (c) => <span className={cn("whitespace-nowrap text-xs", isExpired(c) ? "font-semibold text-danger" : "text-ink-300")}>{c.validUntil ? fmt.date(c.validUntil) : "—"}</span>,
      sortValue: (c) => (c.validUntil ? new Date(c.validUntil) : null),
      exportValue: (c) => c.validUntil?.slice(0, 10) ?? "",
      hideOnMobile: true,
    },
    { key: "actions", header: t("app.inspector.dashboard.columns.actions"), align: "right", alwaysVisible: true, cell: (c) => actions({ kind: "certificate", item: c }, true) },
  ];

  const docColumns: Column<QueueDoc>[] = [
    {
      key: "item",
      header: t("app.inspector.dashboard.columns.item"),
      alwaysVisible: true,
      cell: (d) => (
        <div className="flex min-w-0 items-center gap-3">
          <FileTypeIcon mime={d.file?.mime} name={d.file?.originalName} />
          <div className="min-w-0">
            <div className="max-w-64 truncate text-sm font-semibold text-stone-100">{tr(d.title)}</div>
            <div className="truncate text-xs text-ink-400">
              {label("documentType", d.type)}
              {d.number && <span className="font-mono"> · № {d.number}</span>}
            </div>
          </div>
        </div>
      ),
      sortValue: (d) => d.title,
      exportValue: (d) => d.title,
    },
    {
      key: "project",
      header: t("app.inspector.dashboard.columns.project"),
      cell: (d) => (
        <Link href={`/projects/${d.project.slug}`} target="_blank" onClick={(e) => e.stopPropagation()} className="text-sm text-ink-100 hover:text-gold-300">
          {tr(d.project.name)}
        </Link>
      ),
      sortValue: (d) => d.project.name,
      exportValue: (d) => d.project.name,
      hideOnMobile: true,
    },
    { key: "issuer", header: t("app.inspector.dashboard.columns.issuer"), cell: (d) => <span className="text-sm text-ink-200">{d.issuer ? tr(d.issuer) : "—"}</span>, exportValue: (d) => d.issuer ?? "", hideOnMobile: true },
    {
      key: "created",
      header: t("app.inspector.dashboard.columns.created"),
      cell: (d) => <span className="whitespace-nowrap text-xs text-ink-300">{fmt.date(d.createdAt)}</span>,
      sortValue: (d) => new Date(d.createdAt),
      exportValue: (d) => d.createdAt.slice(0, 10),
      hideOnMobile: true,
    },
    {
      key: "actions",
      header: t("app.inspector.dashboard.columns.actions"),
      align: "right",
      alwaysVisible: true,
      cell: (d) => (
        <div className="flex items-center justify-end gap-1.5">
          {d.file && (
            <Tooltip content={t("app.inspector.dashboard.file")}>
              <Button
                size="icon-sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreview({ file: d.file!, title: tr(d.title) });
                }}
                aria-label={t("app.inspector.dashboard.file")}
              >
                <Eye size={16} className="text-gold-300" />
              </Button>
            </Tooltip>
          )}
          {actions({ kind: "document", item: d })}
        </div>
      ),
    },
  ];

  const tabCount = (n: number, active: boolean) => (
    <span className={cn("rounded-full px-1.5 font-mono text-[10px]", active ? "bg-gold-500/20 text-gold-200" : "bg-fg/8 text-ink-400")}>{n}</span>
  );

  return (
    <>
      <Tabs value={tab} onValueChange={(v) => setTab(v as QueueTab)}>
        <TabsList>
          <TabsTrigger value="certificates">
            <Verify variant={tab === "certificates" ? "Bulk" : "TwoTone"} className="text-gold-400" /> {t("app.inspector.dashboard.tabs.certificates")}
            {tabCount(certs.length, tab === "certificates")}
          </TabsTrigger>
          <TabsTrigger value="documents">
            <DocumentText variant={tab === "documents" ? "Bulk" : "TwoTone"} className="text-gold-400" /> {t("app.inspector.dashboard.tabs.documents")}
            {tabCount(docs.length, tab === "documents")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="certificates" className={compact ? "mt-4" : undefined}>
          <DataTable
            columns={certColumns}
            data={certs}
            loading={loading}
            rowKey={(c) => c.id}
            searchText={(c) => `${c.number} ${c.project.name} ${c.issuer}`}
            searchPlaceholder={t("app.inspector.dashboard.search")}
            emptyTitle={t("app.inspector.dashboard.emptyCertificates")}
            emptyHint={t("app.inspector.dashboard.emptyHint")}
            exportName={compact ? undefined : "certificates-queue"}
            pageSize={compact ? 5 : 10}
            dense={compact}
          />
        </TabsContent>
        <TabsContent value="documents" className={compact ? "mt-4" : undefined}>
          <DataTable
            columns={docColumns}
            data={docs}
            loading={loading}
            rowKey={(d) => d.id}
            searchText={(d) => `${d.title} ${d.number ?? ""} ${d.project.name}`}
            searchPlaceholder={t("app.inspector.dashboard.search")}
            emptyTitle={t("app.inspector.dashboard.emptyDocuments")}
            emptyHint={t("app.inspector.dashboard.emptyHint")}
            exportName={compact ? undefined : "documents-queue"}
            pageSize={compact ? 5 : 10}
            dense={compact}
          />
        </TabsContent>
      </Tabs>

      <DecisionDialog
        state={decision}
        onClose={() => setDecision(null)}
        onDone={(target) => {
          onDone(target);
          setDecision(null);
        }}
      />
      <FilePreviewDialog file={preview?.file ?? null} title={preview?.title} open={Boolean(preview)} onOpenChange={(o) => !o && setPreview(null)} />
    </>
  );
}

function DecisionDialog({ state, onClose, onDone }: { state: { target: Target; status: Decision } | null; onClose: () => void; onDone: (t: Target) => void }) {
  const { t, label, tr } = useI18n();
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [touched, setTouched] = React.useState(false);
  React.useEffect(() => {
    setNote("");
    setTouched(false);
  }, [state]);

  const needNote = state?.status !== "VERIFIED";
  const noteError = needNote && touched && note.trim().length < 3 ? t("app.inspector.dashboard.noteRequired") : null;

  const submit = async () => {
    if (!state) return;
    setTouched(true);
    if (needNote && note.trim().length < 3) return;
    setBusy(true);
    try {
      if (state.target.kind === "certificate") {
        await api.patch(`/certificates/${state.target.item.id}/verify`, { status: state.status, note: note.trim() || undefined });
      } else {
        await api.patch(`/documents/${state.target.item.id}/verify`, { status: state.status, rejectReason: note.trim() || undefined });
      }
      toast.success(t(`app.inspector.dashboard.done.${state.status}`));
      onDone(state.target);
    } catch (e) {
      toast.error(errorMessage(e, t("common.errors.generic")));
    } finally {
      setBusy(false);
    }
  };

  const item = state?.target.item;
  const subtitle = state
    ? state.target.kind === "certificate"
      ? `${label("certificateType", state.target.item.type)} · № ${state.target.item.number}`
      : tr(state.target.item.title)
    : "";

  return (
    <Dialog open={Boolean(state)} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-xl border",
                state?.status === "VERIFIED" ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger",
              )}
            >
              {state?.status === "VERIFIED" ? <TickCircle size={20} variant="Bold" /> : <ShieldCross size={20} variant="Bold" />}
            </span>
            <div className="min-w-0">
              <DialogTitle>{state ? t(`app.inspector.dashboard.noteTitle.${state.status}`) : ""}</DialogTitle>
              <DialogDescription className="truncate">
                {subtitle}
                {item ? ` — ${tr(item.project.name)}` : ""}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogBody>
          <Label htmlFor="decision-note">
            {t("app.inspector.dashboard.noteLabel")} {!needNote && <span className="font-normal text-ink-400">({t("app.common.optional")})</span>}
          </Label>
          <Textarea
            id="decision-note"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={t("app.inspector.dashboard.notePlaceholder")}
            aria-invalid={Boolean(noteError) || undefined}
            autoFocus
          />
          {noteError && <p className="mt-1.5 text-xs text-danger">{noteError}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("common.actions.cancel")}
          </Button>
          <Button variant={state?.status === "VERIFIED" ? "success" : "danger"} onClick={submit} loading={busy}>
            {state ? t(`app.inspector.dashboard.noteTitle.${state.status}`) : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
