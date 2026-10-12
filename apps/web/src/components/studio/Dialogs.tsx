"use client";
import * as React from "react";
import Link from "next/link";
import { CloudAdd, Danger, TickCircle, Buildings2, ExportSquare } from "iconsax-reactjs";
import { formatBytes } from "@eka/shared";
import { toast } from "sonner";
import { useI18n } from "@/i18n/client";
import { api, errorMessage, uploadFile } from "@/lib/api";
import type { ProjectCard } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStudio, useS } from "./context";
import { fmtInt, slugify } from "./scene-utils";
import { Kbd, Toggle } from "./ui";

// ───────────────────────────── help ─────────────────────────────

export function HelpDialog() {
  const { t } = useI18n();
  const { store } = useStudio();
  const open = useS((s) => s.helpOpen);
  const mod = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
  const groups: { title: string; items: [string, string[]][] }[] = [
    {
      title: t("studio.help.groups.tools"),
      items: [
        [t("studio.help.keys.select"), ["Q"]],
        [t("studio.help.keys.move"), ["W"]],
        [t("studio.help.keys.rotate"), ["E"]],
        [t("studio.help.keys.scale"), ["R"]],
        [t("studio.help.keys.measure"), ["M"]],
        [t("studio.help.keys.area"), ["A"]],
        [t("studio.help.keys.pin"), ["N"]],
        [t("studio.help.keys.section"), ["C"]],
      ],
    },
    {
      title: t("studio.help.groups.view"),
      items: [
        [t("studio.help.keys.focus"), ["F"]],
        [t("studio.help.keys.fitAll"), ["⇧", "F"]],
        [t("studio.help.keys.views"), ["1", "2", "3", "4"]],
        [t("studio.help.keys.projection"), ["5"]],
        [t("studio.help.keys.xray"), ["X"]],
        [t("studio.help.keys.wireframe"), ["Z"]],
        [t("studio.help.keys.grid"), ["G"]],
        [t("studio.help.keys.isolate"), ["I"]],
        [t("studio.help.keys.panels"), ["T"]],
      ],
    },
    {
      title: t("studio.help.groups.edit"),
      items: [
        [t("studio.help.keys.hide"), ["H"]],
        [t("studio.help.keys.showAll"), ["⇧", "H"]],
        [t("studio.help.keys.delete"), ["Del"]],
        [t("studio.help.keys.duplicate"), [mod, "D"]],
        [t("studio.help.keys.deselect"), ["Esc"]],
        [t("studio.help.keys.undo"), [mod, "Z"]],
        [t("studio.help.keys.redo"), [mod, "⇧", "Z"]],
      ],
    },
    {
      title: t("studio.help.groups.file"),
      items: [
        [t("studio.help.keys.export"), [mod, "S"]],
        [t("studio.help.keys.open"), [mod, "O"]],
        [t("studio.toolbar.screenshot"), ["P"]],
        [t("studio.help.keys.help"), ["?"]],
      ],
    },
  ];
  return (
    <Dialog open={open} onOpenChange={(o) => store.set({ helpOpen: o })}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{t("studio.help.title")}</DialogTitle>
          <DialogDescription>{t("studio.help.subtitle")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid max-h-[70vh] gap-x-8 gap-y-6 overflow-y-auto sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g.title}>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-gold-400">{g.title}</div>
              <ul className="divide-y divide-line">
                {g.items.map(([label, keys]) => (
                  <li key={label} className="flex items-center justify-between gap-3 py-2 text-sm text-ink-200">
                    <span>{label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────── confirm ─────────────────────────────

export type ConfirmRequest = { title: string; text: string; confirm: string; resolve: (ok: boolean) => void };

export function ConfirmDialog({ req, onClose }: { req: ConfirmRequest | null; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Dialog
      open={Boolean(req)}
      onOpenChange={(o) => {
        if (!o) {
          req?.resolve(false);
          onClose();
        }
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Danger size={20} className="text-warning" variant="Bulk" /> {req?.title}
          </DialogTitle>
          <DialogDescription>{req?.text}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              req?.resolve(false);
              onClose();
            }}
          >
            {t("studio.confirm.stay")}
          </Button>
          <Button
            variant="gold"
            autoFocus
            onClick={() => {
              req?.resolve(true);
              onClose();
            }}
          >
            {req?.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────── upload to project ─────────────────────────────

export type StudioProject = { id: string; slug: string; name: string; isOwner: boolean };

type Phase = "idle" | "export" | "upload" | "attach" | "done" | "error";

export function UploadDialog({
  project,
  isDeveloper,
  filenameBase,
  onUploaded,
}: {
  project: StudioProject | null;
  isDeveloper: boolean;
  filenameBase: string;
  onUploaded: (p: { id: string; slug: string; name: string }, file: { id: string; url: string; size: number }) => void;
}) {
  const { t, tr } = useI18n();
  const { engine, store } = useStudio();
  const open = useS((s) => s.uploadOpen);
  const [projects, setProjects] = React.useState<ProjectCard[] | null>(null);
  const [target, setTarget] = React.useState<string | null>(project?.isOwner ? project.id : null);
  const [onlyVisible, setOnlyVisible] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [pct, setPct] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ slug: string } | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setPhase("idle");
    setPct(0);
    setError(null);
    setDone(null);
    if (project?.isOwner) setTarget(project.id);
    if (isDeveloper && !projects)
      api
        .get<ProjectCard[]>("/dev/projects")
        .then((r) => setProjects(Array.isArray(r) ? r : []))
        .catch(() => setProjects([]));
  }, [open, isDeveloper, project, projects]);

  const st = engine.stats();
  const busy = phase === "export" || phase === "upload" || phase === "attach";
  const options = (projects ?? []).map((p) => ({ value: p.id, label: tr(p.name), description: tr(p.region) }));
  if (project?.isOwner && !options.some((o) => o.value === project.id)) options.unshift({ value: project.id, label: tr(project.name), description: "" });
  const chosen = (projects ?? []).find((p) => p.id === target) ?? (project && project.id === target ? project : null);

  const run = async () => {
    if (!target) return;
    setError(null);
    try {
      setPhase("export");
      await new Promise((r) => setTimeout(r, 30));
      const blob = await engine.exportGLB({ onlyVisible });
      const file = new File([blob], `${filenameBase}.glb`, { type: "model/gltf-binary" });
      setPhase("upload");
      const up = await uploadFile(file, (p) => setPct(Math.round(p * 100)));
      setPhase("attach");
      await api.post(`/dev/projects/${target}/model3d`, { fileId: up.id });
      engine.markSaved();
      setPhase("done");
      const slug = (projects ?? []).find((p) => p.id === target)?.slug ?? project?.slug ?? target;
      const name = (projects ?? []).find((p) => p.id === target)?.name ?? project?.name ?? "";
      setDone({ slug });
      onUploaded({ id: target, slug, name }, { id: up.id, url: up.url, size: up.size });
      toast.success(t("studio.upload.success"), { description: t("studio.upload.successHint") });
    } catch (e) {
      setPhase("error");
      setError(errorMessage(e, t("studio.upload.failed")));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && store.set({ uploadOpen: o })}>
      <DialogContent size="md" onInteractOutside={(e) => busy && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CloudAdd size={20} className="text-gold-400" variant="Bulk" /> {t("studio.upload.title")}
          </DialogTitle>
          <DialogDescription>{t("studio.upload.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {phase === "done" ? (
            <div className="flex flex-col items-center py-4 text-center">
              <div className="mb-3 grid size-14 place-items-center rounded-2xl bg-success/12 text-success">
                <TickCircle size={30} variant="Bulk" />
              </div>
              <div className="text-base font-semibold text-stone-100">{t("studio.upload.success")}</div>
              <p className="mt-1 text-sm text-ink-300">{t("studio.upload.successHint")}</p>
              {done && (
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link href={`/projects/${done.slug}`} target="_blank">
                    <ExportSquare size={15} /> {t("studio.upload.openProject")}
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <>
              <div>
                <div className="mb-1.5 text-xs font-semibold tracking-wide text-ink-200">{t("studio.upload.target")}</div>
                {project?.isOwner && !isDeveloper ? (
                  <div className="flex items-center gap-2 rounded-xl border border-line bg-ink-850 px-3 py-2.5 text-sm text-stone-100">
                    <Buildings2 size={16} className="text-gold-400" /> {tr(project.name)}
                  </div>
                ) : projects && !options.length ? (
                  <p className="rounded-xl border border-dashed border-line-strong px-3 py-3 text-sm text-ink-400">{t("studio.upload.noProjects")}</p>
                ) : (
                  <Combobox options={options} value={target} onChange={(v) => setTarget(v)} placeholder={t("studio.upload.choose")} disabled={busy} />
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-line bg-ink-850/60 px-3 py-2">
                  <div className="text-ink-400">{t("studio.upload.file")}</div>
                  <div className="truncate font-mono text-stone-100">{filenameBase}.glb</div>
                </div>
                <div className="rounded-xl border border-line bg-ink-850/60 px-3 py-2">
                  <div className="text-ink-400">{t("studio.scene.size")}</div>
                  <div className="truncate font-mono text-stone-100">
                    ≈ {formatBytes(engine.info?.fileSize ?? 0)} · {t("studio.upload.triangles", { n: fmtInt(st?.triangles ?? 0) })}
                  </div>
                </div>
              </div>
              <Toggle label={t("studio.export.onlyVisible")} checked={onlyVisible} onChange={setOnlyVisible} disabled={busy} />
              <p className="flex gap-2 rounded-xl border border-warning/25 bg-warning/6 p-3 text-xs leading-relaxed text-ink-200">
                <Danger size={16} className="mt-0.5 shrink-0 text-warning" /> {t("studio.upload.warn")}
              </p>
              {(busy || phase === "error") && (
                <div className={cn("rounded-xl border p-3", phase === "error" ? "border-danger/30 bg-danger/6" : "border-line bg-ink-850/60")}>
                  {phase === "error" ? (
                    <p className="text-sm text-danger">{error}</p>
                  ) : (
                    <>
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="text-ink-200">
                          {phase === "export" ? t("studio.upload.exporting") : phase === "upload" ? t("studio.upload.uploading", { pct }) : t("studio.upload.attaching")}
                        </span>
                        <span className="font-mono text-gold-200">{phase === "upload" ? `${pct}%` : ""}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-fg/8" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                        <div
                          className="h-full rounded-full bg-gold-gradient transition-[width] duration-300 ease-out"
                          style={{ width: `${phase === "export" ? 8 : phase === "upload" ? 10 + pct * 0.8 : 96}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
              {chosen && <span className="sr-only">{chosen.name}</span>}
            </>
          )}
        </DialogBody>
        <DialogFooter>
          {phase === "done" ? (
            <Button variant="gold" onClick={() => store.set({ uploadOpen: false })}>
              {t("studio.upload.done")}
            </Button>
          ) : (
            <>
              <Button variant="ghost" disabled={busy} onClick={() => store.set({ uploadOpen: false })}>
                {t("studio.upload.cancel")}
              </Button>
              <Button variant="gold" loading={busy} disabled={!target || busy} onClick={run}>
                <CloudAdd size={17} /> {t("studio.upload.confirm")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const exportBaseName = (name: string) => `${slugify(name)}-studio`;
