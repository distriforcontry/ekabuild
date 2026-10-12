"use client";
// /app/studio — gallery: open a local file (drag & drop), a URL, the sample model or any project model.
import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowRight,
  Buildings2,
  CloudAdd,
  Data,
  DocumentUpload,
  FolderOpen,
  I3DCubeScan,
  Link2,
  Ruler,
  ShieldTick,
  Brush,
  Warning2,
  Global,
} from "iconsax-reactjs";
import { formatBytes } from "@eka/shared";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/api";
import type { FileRef, Paginated, ProjectCard } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCabinetUser } from "@/components/cabinet/CabinetContext";
import { Studio } from "./Studio";
import { ACCEPT, MODEL_EXT, type ModelSource } from "./loaders";

type Card = {
  id: string;
  slug: string;
  name: string;
  region: string;
  coverUrl: string | null;
  floors: number;
  model: FileRef | null;
  own: boolean;
  published: boolean;
};

/** /projects and /dev/projects cards carry `model3d` (FileRef | null) — no per-project detail requests needed. */
type CardWithModel = ProjectCard & { model3d?: FileRef | null };

function toCard(p: CardWithModel, own: boolean): Card {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    region: p.region,
    coverUrl: p.coverUrl,
    floors: p.floors,
    model: p.model3d ?? null,
    own,
    published: p.published ?? true,
  };
}

export function StudioHome({ initialUrl, initialName }: { initialUrl?: string; initialName?: string }) {
  const router = useRouter();
  const { user } = useCabinetUser();
  const isDev = user.role === "DEVELOPER";
  const [local, setLocal] = React.useState<ModelSource | null>(initialUrl ? { kind: "url", url: initialUrl, name: initialName } : null);

  React.useEffect(() => {
    if (initialUrl) setLocal({ kind: "url", url: initialUrl, name: initialName });
  }, [initialUrl, initialName]);

  if (local)
    return (
      <Studio
        source={local}
        isDeveloper={isDev}
        onBack={() => {
          setLocal(null);
          if (initialUrl) router.replace("/app/studio");
        }}
      />
    );
  return <Gallery isDev={isDev} onOpen={setLocal} />;
}

function Gallery({ isDev, onOpen }: { isDev: boolean; onOpen: (s: ModelSource) => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const [mine, setMine] = React.useState<Card[] | null>(isDev ? null : []);
  const [catalog, setCatalog] = React.useState<Card[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  const [url, setUrl] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setFailed(false);
    (async () => {
      let ownIds = new Set<string>();
      if (isDev) {
        try {
          const own = await api.get<CardWithModel[]>("/dev/projects");
          const list = Array.isArray(own) ? own : [];
          ownIds = new Set(list.map((p) => p.id));
          if (alive) setMine(list.map((p) => toCard(p, true)));
        } catch {
          if (alive) {
            setMine([]);
            setFailed(true);
          }
        }
      }
      try {
        const page = await api.get<Paginated<CardWithModel>>("/projects", { query: { has3d: 1, pageSize: 48, sort: "trust" } });
        const list = (page?.items ?? []).filter((p) => !ownIds.has(p.id) && p.model3d);
        if (alive) setCatalog(list.map((p) => toCard(p, false)));
      } catch {
        if (alive) {
          setCatalog([]);
          setFailed(true);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [isDev, attempt]);

  const features = [
    { icon: Data, label: t("studio.home.features.inspect") },
    { icon: Ruler, label: t("studio.home.features.measure") },
    { icon: Brush, label: t("studio.home.features.edit") },
    { icon: CloudAdd, label: t("studio.home.features.export") },
  ];

  return (
    <div className="space-y-10">
      {/* hero */}
      <section className="relative overflow-hidden rounded-3xl border border-line bg-ink-900 shadow-card">
        <div className="bg-blueprint pointer-events-none absolute inset-0 opacity-70 mask-fade-b" />
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-[radial-gradient(circle,rgb(201_164_100/0.16),transparent_65%)]" />
        <div className="relative grid gap-8 p-6 md:p-8 lg:grid-cols-[1.05fr_1fr] lg:p-10">
          <div className="flex flex-col justify-center">
            <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-gold-400">
              <span className="h-px w-8 bg-gold-500/60" />
              {t("studio.home.eyebrow")}
            </div>
            <h1 className="font-display text-4xl font-medium leading-[1.05] text-stone-100 md:text-5xl">{t("studio.home.title")}</h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-300">{t("studio.home.subtitle")}</p>
            <ul className="mt-6 grid grid-cols-2 gap-2.5 sm:max-w-lg">
              {features.map(({ icon: I, label }, i) => (
                <motion.li
                  key={label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center gap-2.5 rounded-xl border border-line bg-ink-850/60 px-3 py-2.5 text-[13px] text-ink-100"
                >
                  <I size={17} variant="Bulk" className="shrink-0 text-gold-300" />
                  {label}
                </motion.li>
              ))}
            </ul>
          </div>
          <DropCard onFiles={(files) => onOpen({ kind: "files", files })} />
        </div>
      </section>

      {/* url + sample */}
      <section className="grid gap-4 lg:grid-cols-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const u = url.trim();
            if (/^(\/(?!\/)|https?:\/\/)/i.test(u)) onOpen({ kind: "url", url: u });
          }}
          className="flex flex-col justify-between gap-4 rounded-2xl border border-line bg-ink-900 p-5 shadow-card"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/8 text-gold-300">
              <Link2 size={19} variant="Bulk" />
            </span>
            <div className="text-sm font-semibold text-stone-100">{t("studio.home.open.url")}</div>
          </div>
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("studio.home.open.urlPlaceholder")}
              aria-label={t("studio.home.open.url")}
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-ink-850 px-3.5 font-mono text-[13px] text-stone-100 outline-none transition placeholder:text-ink-400 hover:border-line-strong focus:border-gold-500/60 focus:ring-4 focus:ring-gold-500/10"
            />
            <Button type="submit" variant="secondary" size="lg" disabled={!/^(\/(?!\/)|https?:\/\/)/i.test(url.trim())}>
              {t("studio.home.open.urlOpen")}
            </Button>
          </div>
        </form>
        <button
          type="button"
          onClick={() => router.push(`/app/studio?url=${encodeURIComponent("/models/hero-tower.glb")}&name=hero-tower.glb`)}
          className="group/sample relative flex cursor-pointer items-center gap-5 overflow-hidden rounded-2xl border border-line bg-ink-900 p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:border-gold-500/40"
        >
          <span className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-gold-500/25 bg-[radial-gradient(circle_at_30%_20%,rgb(201_164_100/0.35),transparent_70%)]">
            <I3DCubeScan size={34} variant="Bulk" className="text-gold-300 transition-transform duration-500 group-hover/sample:rotate-12 group-hover/sample:scale-110" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-400">{t("studio.home.samples.title")}</span>
            <span className="mt-1 block text-lg font-semibold text-stone-100">{t("studio.home.samples.name")}</span>
            <span className="mt-0.5 block text-sm text-ink-300">{t("studio.home.samples.desc")}</span>
            <span className="mt-1.5 block font-mono text-[11px] text-ink-400">GLB · 9.1 MB · 4 KHR ext.</span>
          </span>
          <ArrowRight size={20} className="shrink-0 text-ink-400 transition group-hover/sample:translate-x-1 group-hover/sample:text-gold-300" />
        </button>
      </section>

      {failed && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-warning/30 bg-warning/6 px-4 py-3 text-sm text-ink-200">
          <Warning2 size={18} className="text-warning" /> {t("studio.home.loadError")}
          <Button variant="ghost" size="sm" onClick={() => setAttempt((a) => a + 1)}>
            {t("studio.home.retry")}
          </Button>
        </div>
      )}

      {isDev && (
        <CardsSection
          icon={Buildings2}
          title={t("studio.home.mine.title")}
          subtitle={t("studio.home.mine.subtitle")}
          cards={mine}
          empty={t("studio.home.mine.empty")}
          emptyHint={t("studio.home.mine.emptyHint")}
        />
      )}
      <CardsSection icon={Global} title={t("studio.home.catalog.title")} subtitle={t("studio.home.catalog.subtitle")} cards={catalog} empty={t("studio.home.catalog.empty")} />
    </div>
  );
}

function DropCard({ onFiles }: { onFiles: (files: File[]) => void }) {
  const { t } = useI18n();
  const input = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  const [bad, setBad] = React.useState(false);
  const take = (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (!files.length) return;
    if (!files.some((f) => MODEL_EXT.test(f.name))) {
      setBad(true);
      return;
    }
    setBad(false);
    onFiles(files);
  };
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t("studio.home.open.title")}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), input.current?.click())}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files);
      }}
      className={cn(
        "group/drop relative flex min-h-72 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-all duration-300",
        over ? "scale-[1.01] border-gold-400 bg-gold-500/10" : "border-line-strong bg-ink-850/50 hover:border-gold-500/50 hover:bg-gold-500/4",
      )}
    >
      <span className="relative mb-5 grid size-18 place-items-center">
        <span className="absolute inset-0 rounded-2xl border border-gold-500/30 animate-pulse-ring" />
        <span className="relative grid size-16 place-items-center rounded-2xl bg-gold-gradient text-onyx shadow-glow transition-transform duration-500 group-hover/drop:-translate-y-1">
          {over ? <DocumentUpload size={28} variant="Bold" /> : <FolderOpen size={28} variant="Bold" />}
        </span>
      </span>
      <span className="text-xl font-semibold text-stone-100">{over ? t("studio.home.open.drop") : t("studio.home.open.title")}</span>
      <span className="mt-1.5 text-sm text-ink-300">{t("studio.home.open.hint")}</span>
      <span className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl border border-line-strong bg-ink-900 px-4 text-sm font-semibold text-stone-100 transition group-hover/drop:border-gold-500/50">
        {t("studio.home.open.button")}
      </span>
      <span className="mt-4 font-mono text-[11px] text-ink-400">{t("studio.home.open.formats")}</span>
      <span className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-ink-400">
        <ShieldTick size={13} className="text-success" /> {t("studio.home.open.local")}
      </span>
      {bad && <span className="mt-2 text-xs text-danger">{t("studio.home.open.badType")}</span>}
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept={ACCEPT}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function CardsSection({
  icon: I,
  title,
  subtitle,
  cards,
  empty,
  emptyHint,
}: {
  icon: typeof Buildings2;
  title: string;
  subtitle: string;
  cards: Card[] | null;
  empty: string;
  emptyHint?: string;
}) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-100">
            <I size={20} variant="Bulk" className="text-gold-400" /> {title}
          </h2>
          <p className="mt-1 text-sm text-ink-400">{subtitle}</p>
        </div>
        {cards && cards.length > 0 && <span className="font-mono text-xs text-ink-400">{cards.length}</span>}
      </div>
      {!cards ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : !cards.length ? (
        <div className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
          <div className="text-sm font-semibold text-stone-100">{empty}</div>
          {emptyHint && <p className="mx-auto mt-1 max-w-md text-sm text-ink-400">{emptyHint}</p>}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {cards.map((c, i) => (
            <ModelCard key={c.id} c={c} i={i} />
          ))}
        </div>
      )}
    </section>
  );
}

function ModelCard({ c, i }: { c: Card; i: number }) {
  const { t, tr } = useI18n();
  const router = useRouter();
  const href = `/app/studio/${c.slug}`;
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i, 8) * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => router.push(href)}
      className="group/card relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-line bg-ink-900 text-left shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-gold-500/40 hover:shadow-lift"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-ink-850">
        {c.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${c.coverUrl}?w=480`}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-700 group-hover/card:scale-105"
          />
        ) : (
          <div className="bg-blueprint size-full" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/10 to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {c.own && <Badge tone="gold">{t("studio.home.card.yours")}</Badge>}
          {c.own && !c.published && <Badge tone="neutral">{t("studio.home.card.draft")}</Badge>}
        </div>
        <span
          className={cn(
            "absolute right-3 top-3 grid size-9 place-items-center rounded-xl backdrop-blur",
            c.model ? "bg-gold-gradient text-onyx shadow-glow" : "border border-line-strong bg-ink-900/70 text-ink-300",
          )}
        >
          <I3DCubeScan size={18} variant={c.model ? "Bold" : "Linear"} />
        </span>
        <div className="absolute inset-x-3 bottom-3">
          <div className="truncate text-base font-semibold text-stone-100">{tr(c.name)}</div>
          <div className="truncate text-xs text-ink-300">
            {tr(c.region)} · {t("studio.home.card.floors", { n: c.floors })}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        {c.model ? (
          <span className="min-w-0 truncate font-mono text-[11px] text-ink-400">
            {c.model.originalName} · {formatBytes(c.model.size)}
          </span>
        ) : (
          <span className="text-xs text-ink-400">{t("studio.home.card.noModel")}</span>
        )}
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-gold-300">
          {c.model ? t("studio.home.card.open") : t("studio.home.card.upload")}
          <ArrowRight size={14} className="transition-transform group-hover/card:translate-x-0.5" />
        </span>
      </div>
    </motion.button>
  );
}
