"use client";
// Inspector panels: properties, material editor, floors, scene stats, notes (measures/areas/pins), view settings.
import * as React from "react";
import * as THREE from "three";
import {
  ArrowUp2,
  Box,
  Brush,
  Buildings,
  Copy,
  Data,
  DocumentDownload,
  DocumentUpload,
  Eye,
  EyeSlash,
  Gps,
  Layer,
  Lock,
  MessageText,
  Mouse,
  RotateRight,
  Ruler,
  Scissor,
  SearchZoomIn,
  Sun1,
  Trash,
  Unlock,
  Warning2,
  InfoCircle,
  Grid1,
  Scanning,
} from "iconsax-reactjs";
import { toast } from "sonner";
import { formatBytes } from "@eka/shared";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useStudio, useS } from "./context";
import type { MatKey, MatPatch } from "./engine";
import type { EnvPreset, Pin } from "./store";
import {
  displayName,
  downloadBlob,
  fmtInt,
  fmtM,
  fmtM2,
  fmtNum,
  isLocked,
  kindOf,
  materialsOf,
  renderablesUnder,
  slugify,
  texturesOf,
  trianglesOf,
  uid,
  verticesOf,
  worldBox,
} from "./scene-utils";
import { downloadNotesJson, downloadStatsCsv, statsRows } from "./exporters";
import { ColorField, IconBtn, MiniStat, NumField, PanelEmpty, Row, Section, Segmented, Slider, Toggle } from "./ui";

const D2R = Math.PI / 180;

// ───────────────────────────── properties ─────────────────────────────

export function PropertiesPanel() {
  const { engine, store } = useStudio();
  const { t } = useI18n();
  const selection = useS((s) => s.selection);
  useS((s) => s.version);
  useS((s) => s.tick);
  const isolated = useS((s) => s.isolated);
  const o = engine.get(selection);
  if (!o)
    return (
      <PanelEmpty
        icon={Mouse}
        title={t("studio.props.none")}
        hint={t("studio.props.noneHint")}
      />
    );
  const kind = kindOf(o);
  const locked = isLocked(o, engine.root);
  const trs = engine.readTRS(o);
  const euler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().fromArray(trs.q), "XYZ");
  const rot = [euler.x / D2R, euler.y / D2R, euler.z / D2R];
  const box = worldBox(o, true, engine.root);
  const size = box.isEmpty() ? new THREE.Vector3() : box.getSize(new THREE.Vector3());
  const meshes = renderablesUnder(o, false);
  let tris = 0,
    verts = 0;
  const mats = new Set<THREE.Material>();
  for (const m of meshes) {
    tris += trianglesOf(m);
    verts += verticesOf(m);
    materialsOf(m).forEach((x) => mats.add(x));
  }
  const path: THREE.Object3D[] = [];
  let p = o.parent;
  while (p && p !== engine.wrapper) {
    path.unshift(p);
    p = p.parent;
  }
  const setP = (i: number, v: number) => {
    const next = { ...trs, p: [...trs.p] as typeof trs.p };
    next.p[i] = v;
    engine.setTRS(o.uuid, next, `p${i}`);
  };
  const setR = (i: number, v: number) => {
    const e = euler.clone();
    if (i === 0) e.x = v * D2R;
    if (i === 1) e.y = v * D2R;
    if (i === 2) e.z = v * D2R;
    const q = new THREE.Quaternion().setFromEuler(e);
    engine.setTRS(o.uuid, { ...trs, q: q.toArray() as typeof trs.q }, `r${i}`);
  };
  const setSc = (i: number, v: number) => {
    const next = { ...trs, s: [...trs.s] as typeof trs.s };
    next.s[i] = v === 0 ? 0.0001 : v;
    engine.setTRS(o.uuid, next, `s${i}`);
  };
  const axes = ["x", "y", "z"] as const;
  return (
    <div>
      <div className="border-b border-line px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/8 text-gold-300">
            {kind === "group" ? <Layer size={20} variant="Bulk" /> : <Box size={20} variant="Bulk" />}
          </div>
          <div className="min-w-0 flex-1">
            <NameInput
              key={o.uuid + displayName(o)}
              value={displayName(o)}
              onCommit={(v) => engine.rename(o.uuid, v)}
              label={t("studio.props.name")}
              disabled={o === engine.root}
            />
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge tone="gold">{t(`studio.outliner.kinds.${kind}`)}</Badge>
              {locked && (
                <Badge tone="warning">
                  <Lock variant="Bold" /> {t("studio.props.lockedShort")}
                </Badge>
              )}
              {!o.visible && <Badge tone="neutral">{t("studio.props.hidden")}</Badge>}
            </div>
          </div>
        </div>
        {path.length > 0 && (
          <nav aria-label={t("studio.props.path")} className="mt-3 flex flex-wrap items-center gap-1 text-[11px] text-ink-400">
            {path.map((x, i) => (
              <React.Fragment key={x.uuid}>
                {i > 0 && <span className="text-ink-500">/</span>}
                <button type="button" onClick={() => engine.select(x.uuid)} className="max-w-32 cursor-pointer truncate rounded px-1 hover:bg-fg/6 hover:text-stone-100">
                  {x === engine.root ? engine.info?.name || "Scene" : displayName(x) || "—"}
                </button>
              </React.Fragment>
            ))}
          </nav>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-0.5">
          <IconBtn size="sm" icon={ArrowUp2} label={t("studio.props.selectParent")} disabled={!o.parent || o === engine.root} onClick={() => o.parent && o.parent !== engine.wrapper && engine.select(o.parent.uuid)} />
          <IconBtn size="sm" icon={SearchZoomIn} label={t("studio.outliner.focus")} kbd="F" onClick={() => engine.cam?.fit(box)} />
          <IconBtn size="sm" icon={Gps} label={isolated === o.uuid ? t("studio.outliner.unisolate") : t("studio.outliner.isolate")} kbd="I" active={isolated === o.uuid} onClick={() => engine.isolate(o.uuid)} />
          <IconBtn size="sm" icon={o.visible ? EyeSlash : Eye} label={o.visible ? t("studio.outliner.hide") : t("studio.outliner.show")} kbd="H" onClick={() => engine.toggleVisible(o.uuid)} />
          <IconBtn size="sm" icon={locked ? Unlock : Lock} label={locked ? t("studio.outliner.unlock") : t("studio.outliner.lock")} kbd="L" active={Boolean(o.userData.__locked)} onClick={() => engine.toggleLock(o.uuid)} />
          <IconBtn size="sm" icon={Copy} label={t("studio.outliner.duplicate")} kbd="Ctrl D" disabled={o === engine.root} onClick={() => engine.duplicate(o.uuid)} />
          <IconBtn size="sm" icon={Trash} tone="danger" label={t("studio.outliner.delete")} kbd="Del" disabled={o === engine.root} onClick={() => engine.remove(o.uuid)} />
        </div>
      </div>

      <Section
        title={t("studio.props.transform")}
        icon={RotateRight}
        action={
          <button
            type="button"
            disabled={locked}
            onClick={() => engine.resetTransform(o.uuid)}
            className="cursor-pointer rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-ink-400 transition hover:bg-fg/6 hover:text-stone-100 disabled:opacity-40"
          >
            {t("studio.props.resetTransform")}
          </button>
        }
      >
        {locked && (
          <p className="mb-2 flex items-center gap-1.5 text-[11px] text-warning">
            <Lock size={12} /> {t("studio.props.locked")}
          </p>
        )}
        {(
          [
            ["position", trs.p, setP, 0.1, 2, "m"],
            ["rotation", rot, setR, 1, 1, "°"],
            ["scale", trs.s, setSc, 0.01, 3, ""],
          ] as const
        ).map(([key, vals, set, step, dec, suf]) => (
          <div key={key} className="mb-2.5 last:mb-0">
            <div className="mb-1 text-[11px] text-ink-300">{t(`studio.props.${key}`)}</div>
            <div className="grid grid-cols-3 gap-1.5">
              {axes.map((a, i) => (
                <NumField
                  key={a}
                  axis={a}
                  value={vals[i]!}
                  step={step}
                  decimals={dec}
                  suffix={suf || undefined}
                  disabled={locked}
                  ariaLabel={`${t(`studio.props.${key}`)} ${a.toUpperCase()}`}
                  onCommit={(v) => set(i, v)}
                />
              ))}
            </div>
          </div>
        ))}
      </Section>

      <Section title={t("studio.props.dimensions")} icon={Ruler}>
        <div className="grid grid-cols-3 gap-1.5">
          <MiniStat label="X" value={fmtNum(size.x, 2)} sub="m" />
          <MiniStat label="Y" value={fmtNum(size.y, 2)} sub="m" />
          <MiniStat label="Z" value={fmtNum(size.z, 2)} sub="m" />
        </div>
        <Row label={t("studio.props.elevation")} className="mt-2">
          {box.isEmpty() ? "—" : `${fmtNum(box.min.y, 2)} … ${fmtNum(box.max.y, 2)} m`}
        </Row>
        <Row label={t("studio.scene.footprint")}>{fmtM2(size.x * size.z)}</Row>
      </Section>

      <Section title={t("studio.props.geometry")} icon={Data}>
        <Row label={t("studio.props.meshes")}>{fmtInt(meshes.length)}</Row>
        <Row label={t("studio.props.triangles")}>{fmtInt(tris)}</Row>
        <Row label={t("studio.props.vertices")}>{fmtInt(verts)}</Row>
        <Row label={t("studio.props.children")}>{fmtInt(o.children.length)}</Row>
      </Section>

      <Section title={t("studio.props.materials")} icon={Brush}>
        <div className="flex flex-wrap gap-1.5">
          {[...mats].slice(0, 40).map((m) => (
            <button
              key={m.uuid}
              type="button"
              onClick={() => {
                store.set({ tab: "material" });
                engine.focusMaterial = m.uuid;
              }}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-ink-850 px-2 py-1 text-[11px] text-ink-200 transition hover:border-gold-500/50 hover:text-stone-100"
            >
              <span className="size-3 rounded-full border border-line-strong" style={{ background: String(engine.readMat(m, "color")) }} />
              {m.name || m.type}
            </button>
          ))}
          {!mats.size && <span className="text-xs text-ink-400">—</span>}
        </div>
      </Section>
    </div>
  );
}

function NameInput({ value, onCommit, label, disabled }: { value: string; onCommit: (v: string) => void; label: string; disabled?: boolean }) {
  const [v, setV] = React.useState(value);
  return (
    <input
      aria-label={label}
      value={v}
      disabled={disabled}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() && v !== value && onCommit(v)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setV(value);
          e.currentTarget.blur();
        }
      }}
      className="h-8 w-full truncate rounded-lg border border-transparent bg-transparent px-1.5 -ml-1.5 text-[15px] font-semibold text-stone-100 outline-none transition hover:border-line focus:border-gold-500/60 focus:bg-ink-850 disabled:opacity-100"
    />
  );
}

// ───────────────────────────── material ─────────────────────────────

const PRESETS: { id: string; color: string; metalness: number; roughness: number; opacity?: number; transmission?: number; emissive?: string; emissiveIntensity?: number }[] = [
  { id: "gold", color: "#c9a464", metalness: 1, roughness: 0.32 },
  { id: "glass", color: "#cfe0ea", metalness: 0.1, roughness: 0.04, opacity: 0.35, transmission: 0.92 },
  { id: "glassDark", color: "#3b4752", metalness: 0.25, roughness: 0.06, opacity: 0.6, transmission: 0.55 },
  { id: "stone", color: "#d9d1c1", metalness: 0, roughness: 0.82 },
  { id: "concrete", color: "#a19d95", metalness: 0, roughness: 0.95 },
  { id: "graphite", color: "#2b2c31", metalness: 0.7, roughness: 0.38 },
  { id: "alu", color: "#c3c8cf", metalness: 1, roughness: 0.26 },
  { id: "wood", color: "#8b5a34", metalness: 0, roughness: 0.66 },
  { id: "paint", color: "#efebe3", metalness: 0, roughness: 0.6 },
  { id: "brick", color: "#a4532f", metalness: 0, roughness: 0.9 },
  { id: "light", color: "#fff2d0", metalness: 0, roughness: 0.5, emissive: "#ffd89a", emissiveIntensity: 2.2 },
  { id: "water", color: "#2f6f86", metalness: 0.1, roughness: 0.05, opacity: 0.82 },
];

type AnyMat = THREE.Material & { isMeshStandardMaterial?: boolean; isMeshPhysicalMaterial?: boolean; color?: THREE.Color; emissive?: THREE.Color };

export function MaterialPanel() {
  const { engine } = useStudio();
  const { t } = useI18n();
  const selection = useS((s) => s.selection);
  useS((s) => s.version);
  const o = engine.get(selection);
  const list = React.useMemo(() => {
    if (!o) return engine.materials;
    const set = new Set<THREE.Material>();
    renderablesUnder(o, false).forEach((m) => materialsOf(m).forEach((x) => set.add(x)));
    return [...set];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o, engine.materials]);
  const [cur, setCur] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (engine.focusMaterial && list.some((m) => m.uuid === engine.focusMaterial)) {
      setCur(engine.focusMaterial);
      engine.focusMaterial = null;
    } else if (!cur || !list.some((m) => m.uuid === cur)) setCur(list[0]?.uuid ?? null);
  }, [list, cur, engine]);
  const m = list.find((x) => x.uuid === cur) as AnyMat | undefined;
  if (!list.length || !m) return <PanelEmpty icon={Brush} title={t("studio.material.none")} hint={t("studio.material.noneHint")} />;

  const users = engine.meshesUsing(m);
  const inSel = o ? renderablesUnder(o, false).filter((x) => materialsOf(x).includes(m)) : [];
  const pbr = Boolean(m.isMeshStandardMaterial);
  const phys = Boolean(m.isMeshPhysicalMaterial);
  const edit = (patch: MatPatch, label = t("studio.history.material")) => engine.editMaterial(m, patch, label);
  const num = (k: MatKey) => Number(engine.readMat(m, k));
  const tex = texturesOf(m);
  const texKeys = Object.entries(m).filter(([, v]) => v && (v as THREE.Texture).isTexture).map(([k]) => k);

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    const patch: MatPatch = { color: p.color, metalness: p.metalness, roughness: p.roughness };
    if (m.emissive) {
      patch.emissive = p.emissive ?? "#000000";
      patch.emissiveIntensity = p.emissiveIntensity ?? 1;
    }
    if (phys) {
      patch.transmission = p.transmission ?? 0;
      patch.opacity = p.transmission ? 1 : (p.opacity ?? 1);
    } else patch.opacity = p.opacity ?? 1;
    engine.editMaterial(m, patch, t("studio.history.preset"));
  };

  return (
    <div>
      <Section title={o ? t("studio.material.list") : t("studio.scene.materials")} icon={Brush}>
        <div className="-mx-1 flex max-h-40 flex-col overflow-auto">
          {list.map((x) => (
            <button
              key={x.uuid}
              type="button"
              onClick={() => setCur(x.uuid)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition",
                x.uuid === m.uuid ? "bg-gold-500/12 text-stone-100" : "text-ink-200 hover:bg-fg/5",
              )}
            >
              <span className="size-4 shrink-0 rounded-md border border-line-strong shadow-card" style={{ background: String(engine.readMat(x, "color")) }} />
              <span className="min-w-0 flex-1 truncate">{x.name || x.type}</span>
              <span className="font-mono text-[10px] text-ink-400">{engine.meshesUsing(x).length}</span>
            </button>
          ))}
        </div>
      </Section>

      <div className="border-b border-line px-4 py-3">
        <NameInput key={m.uuid + m.name} value={m.name} label={t("studio.material.name")} onCommit={(v) => edit({ name: v })} />
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge tone="gold">{m.type.replace(/^Mesh|Material$/g, "")}</Badge>
          <Badge tone="neutral">{t("studio.material.usedBy", { n: users.length })}</Badge>
        </div>
        {users.length > 1 && (
          <div className="mt-3 rounded-xl border border-warning/25 bg-warning/6 p-2.5 text-[11px] leading-relaxed text-ink-200">
            <div className="flex gap-2">
              <InfoCircle size={14} className="mt-0.5 shrink-0 text-warning" />
              <span>{t("studio.material.shared", { n: users.length })}</span>
            </div>
            {inSel.length > 0 && inSel.length < users.length && (
              <button
                type="button"
                onClick={() => {
                  const copy = engine.makeUnique(m, inSel);
                  if (copy) setCur(copy.uuid);
                }}
                className="mt-2 w-full cursor-pointer rounded-lg border border-line-strong bg-ink-850 py-1.5 text-[11px] font-semibold text-stone-100 transition hover:border-gold-500/50"
              >
                {t("studio.material.makeUnique")} ({inSel.length})
              </button>
            )}
          </div>
        )}
      </div>

      {pbr ? (
        <>
          <Section title={t("studio.material.presets")}>
            <div className="grid grid-cols-6 gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={t(`studio.material.presetNames.${p.id}` as "studio.material.presetNames.gold")}
                  aria-label={t(`studio.material.presetNames.${p.id}` as "studio.material.presetNames.gold")}
                  onClick={() => applyPreset(p)}
                  className="group/sw relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-line-strong shadow-card transition hover:scale-105 hover:border-gold-400"
                  style={{
                    background:
                      p.metalness > 0.5
                        ? `radial-gradient(circle at 30% 25%, #ffffffcc 0%, ${p.color} 35%, #00000080 120%)`
                        : p.opacity && p.opacity < 1
                          ? `linear-gradient(135deg, ${p.color}cc, ${p.color}55)`
                          : `radial-gradient(circle at 30% 25%, #ffffff55 0%, ${p.color} 45%, ${p.color} 100%)`,
                  }}
                >
                  {p.emissive && <span className="absolute inset-0 shadow-[inset_0_0_12px_#ffd89a]" />}
                </button>
              ))}
            </div>
          </Section>
          <Section title={t("studio.tabs.material")}>
            <ColorField label={t("studio.material.color")} value={String(engine.readMat(m, "color"))} onChange={(v) => edit({ color: v })} />
            <Slider label={t("studio.material.metalness")} value={num("metalness")} onChange={(v) => edit({ metalness: v })} />
            <Slider label={t("studio.material.roughness")} value={num("roughness")} onChange={(v) => edit({ roughness: v })} />
            <Slider label={t("studio.material.opacity")} value={num("opacity")} onChange={(v) => edit({ opacity: v })} />
            {phys && (
              <>
                <Slider label={t("studio.material.transmission")} value={num("transmission")} onChange={(v) => edit({ transmission: v })} />
                <Slider label={t("studio.material.ior")} value={num("ior")} min={1} max={2.333} onChange={(v) => edit({ ior: v })} />
                <Slider label={t("studio.material.thickness")} value={num("thickness")} min={0} max={5} onChange={(v) => edit({ thickness: v })} />
              </>
            )}
            <Slider label={t("studio.material.envIntensity")} value={num("envMapIntensity")} min={0} max={3} onChange={(v) => edit({ envMapIntensity: v })} />
          </Section>
          <Section title={t("studio.material.emissive")} defaultOpen={false}>
            <ColorField label={t("studio.material.emissive")} value={String(engine.readMat(m, "emissive"))} onChange={(v) => edit({ emissive: v })} />
            <Slider label={t("studio.material.emissiveIntensity")} value={num("emissiveIntensity")} min={0} max={10} step={0.05} onChange={(v) => edit({ emissiveIntensity: v })} />
          </Section>
        </>
      ) : (
        <Section title={t("studio.tabs.material")}>
          {m.color && <ColorField label={t("studio.material.color")} value={String(engine.readMat(m, "color"))} onChange={(v) => edit({ color: v })} />}
          <Slider label={t("studio.material.opacity")} value={num("opacity")} onChange={(v) => edit({ opacity: v })} />
          <p className="mt-2 text-[11px] text-ink-400">{t("studio.material.pbrOnly")}</p>
        </Section>
      )}
      <Section title={t("studio.material.side")} defaultOpen={false}>
        <Segmented
          value={String(m.side) as "0" | "1" | "2"}
          onChange={(v) => edit({ side: Number(v) })}
          options={[
            { value: "0", label: t("studio.material.sides.front") },
            { value: "1", label: t("studio.material.sides.back") },
            { value: "2", label: t("studio.material.sides.double") },
          ]}
        />
        {pbr && (
          <div className="mt-2">
            <Toggle label={t("studio.material.flat")} checked={Boolean(engine.readMat(m, "flatShading"))} onChange={(v) => edit({ flatShading: v })} />
          </div>
        )}
      </Section>
      <Section title={t("studio.material.textures")} defaultOpen={tex.length > 0}>
        {tex.length ? (
          texKeys.map((k) => {
            const tx = (m as unknown as Record<string, THREE.Texture>)[k]!;
            const img = tx.image as { width?: number; height?: number } | undefined;
            return (
              <Row key={k} label={k}>
                {img?.width ? `${img.width}×${img.height}` : "—"}
              </Row>
            );
          })
        ) : (
          <p className="text-xs text-ink-400">{t("studio.material.noTextures")}</p>
        )}
      </Section>
    </div>
  );
}

// ───────────────────────────── floors ─────────────────────────────

export function FloorsPanel() {
  const { engine } = useStudio();
  const { t } = useI18n();
  useS((s) => s.version);
  const selection = useS((s) => s.selection);
  const isolated = useS((s) => s.isolated);
  const explode = useS((s) => s.explode);
  const floors = engine.floors();
  const { podium, roof, site } = engine.parts;
  if (!floors.length)
    return <PanelEmpty icon={Buildings} title={t("studio.floors.none")} hint={t("studio.floors.noneHint")} />;
  const stats = engine.stats();
  const height = stats ? stats.maxY - Math.max(stats.minY, 0) : 0;
  const others = [
    podium && { o: podium, label: t("studio.floors.podium") },
    roof && { o: roof, label: t("studio.floors.roof") },
    site && { o: site, label: t("studio.floors.site") },
  ].filter(Boolean) as { o: THREE.Object3D; label: string }[];
  const anyHidden = floors.some((f) => !f.visible) || others.some((x) => !x.o.visible);
  return (
    <div>
      <div className="grid grid-cols-3 gap-1.5 border-b border-line p-4">
        <MiniStat label={t("studio.floors.count")} value={floors.length} />
        <MiniStat label={t("studio.floors.height")} value={fmtNum(height, 1)} sub="m" />
        <MiniStat label={t("studio.floors.typical")} value={stats?.typicalFloorHeight ? fmtNum(stats.typicalFloorHeight, 2) : "—"} sub="m" />
      </div>
      <div className="border-b border-line px-4 py-3">
        <Slider
          label={t("studio.floors.explode")}
          value={explode}
          onChange={(v) => engine.setExplode(v)}
          format={(v) => t("studio.floors.gap", { m: fmtM(v * engine.explodeGap(), 1) })}
        />
      </div>
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-300">{t("studio.tabs.floors")}</span>
        {anyHidden && (
          <button
            type="button"
            onClick={() => engine.setVisible([...floors.map((f) => f.uuid), ...others.map((x) => x.o.uuid)], true, t("studio.history.showAll"))}
            className="cursor-pointer rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-gold-300 hover:bg-gold-500/10"
          >
            {t("studio.floors.showAll")}
          </button>
        )}
      </div>
      <ul className="px-2 pb-2">
        {[...floors].reverse().map((f) => (
          <FloorRow
            key={f.uuid}
            uuid={f.uuid}
            title={t("studio.floors.floor", { n: f.n })}
            sub={f.name}
            elevation={f.elevation}
            height={f.step ?? f.height}
            heightLabel={f.step ? t("studio.floors.step") : t("studio.floors.floorHeight")}
            tris={f.triangles}
            visible={f.visible}
            selected={selection === f.uuid}
            isolated={isolated === f.uuid}
          />
        ))}
      </ul>
      {others.length > 0 && (
        <>
          <div className="px-4 pt-2 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-300">{t("studio.floors.other")}</div>
          <ul className="px-2 pb-4">
            {others.map(({ o, label }) => {
              const b = worldBox(o, false);
              return (
                <FloorRow
                  key={o.uuid}
                  uuid={o.uuid}
                  title={label}
                  sub={displayName(o)}
                  elevation={b.isEmpty() ? 0 : b.min.y - ((o.userData.__xow as number | undefined) ?? 0)}
                  height={b.isEmpty() ? 0 : b.max.y - b.min.y}
                  heightLabel={t("studio.floors.floorHeight")}
                  tris={renderablesUnder(o, false).reduce((s, m) => s + trianglesOf(m), 0)}
                  visible={o.visible}
                  selected={selection === o.uuid}
                  isolated={isolated === o.uuid}
                />
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function FloorRow(props: {
  uuid: string;
  title: string;
  sub: string;
  elevation: number;
  height: number;
  heightLabel: string;
  tris: number;
  visible: boolean;
  selected: boolean;
  isolated: boolean;
}) {
  const { engine } = useStudio();
  const { t } = useI18n();
  return (
    <li
      onClick={() => engine.select(props.uuid)}
      onDoubleClick={() => {
        const o = engine.get(props.uuid);
        if (o) engine.cam?.fit(worldBox(o, true, engine.root));
      }}
      className={cn(
        "group/floor flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 transition",
        props.selected ? "bg-gold-500/12" : "hover:bg-fg/5",
        !props.visible && "opacity-55",
      )}
    >
      <button
        type="button"
        aria-label={props.visible ? t("studio.outliner.hide") : t("studio.outliner.show")}
        onClick={(e) => {
          e.stopPropagation();
          engine.toggleVisible(props.uuid);
        }}
        className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-300 hover:bg-fg/8 hover:text-stone-100"
      >
        {props.visible ? <Eye size={15} /> : <EyeSlash size={15} />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-[13px] font-semibold", props.selected ? "text-gold-200" : "text-stone-100")}>{props.title}</div>
        <div className="truncate font-mono text-[10.5px] text-ink-400">
          {props.sub} · {t("studio.floors.tris", { n: fmtInt(props.tris) })}
        </div>
      </div>
      <div className="shrink-0 text-right font-mono text-[11px] leading-tight">
        <div className="text-stone-100">{(props.elevation >= 0 ? "+" : "") + fmtNum(props.elevation, 2)}</div>
        <div className="text-ink-400" title={props.heightLabel}>
          ↕ {fmtNum(props.height, 2)}
        </div>
      </div>
      <button
        type="button"
        aria-label={props.isolated ? t("studio.outliner.unisolate") : t("studio.floors.isolate")}
        title={props.isolated ? t("studio.outliner.unisolate") : t("studio.floors.isolate")}
        onClick={(e) => {
          e.stopPropagation();
          engine.isolate(props.uuid);
        }}
        className={cn(
          "grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg transition",
          props.isolated ? "bg-gold-500/15 text-gold-200" : "text-ink-400 opacity-0 hover:bg-fg/8 hover:text-stone-100 group-hover/floor:opacity-100",
        )}
      >
        <Gps size={15} variant={props.isolated ? "Bold" : "Linear"} />
      </button>
    </li>
  );
}

// ───────────────────────────── scene ─────────────────────────────

export function ScenePanel() {
  const { engine } = useStudio();
  const { t } = useI18n();
  useS((s) => s.version);
  useS((s) => s.explode);
  const info = engine.info;
  const st = engine.stats();
  if (!info || !st) return null;
  const rows = statsRows(engine, t).slice(0, -1);
  const csv = () => downloadStatsCsv(engine, t);
  return (
    <div>
      <div className="grid grid-cols-2 gap-1.5 border-b border-line p-4">
        <MiniStat label={t("studio.scene.triangles")} value={fmtInt(st.triangles)} />
        <MiniStat label={t("studio.scene.meshes")} value={fmtInt(st.meshes)} />
        <MiniStat label={t("studio.scene.materials")} value={fmtInt(st.materials)} />
        <MiniStat label={t("studio.scene.size")} value={formatBytes(info.fileSize)} />
        <MiniStat label={t("studio.scene.sizeY")} value={fmtNum(st.size[1], 1)} sub="m" />
        <MiniStat label={t("studio.scene.footprint")} value={fmtNum(st.buildingFootprint ?? st.footprint, 0)} sub="m²" />
      </div>
      {(engine.recentered || info.notes.length > 0) && (
        <div className="space-y-2 border-b border-line p-4">
          {engine.recentered && <Note text={t("studio.scene.recentered")} />}
          {info.notes.includes("mm") && <Note text={t("studio.scene.mm")} />}
          {info.notes.includes("zup") && <Note text={t("studio.scene.zup")} />}
        </div>
      )}
      <Section title={t("studio.scene.extensions")} icon={Layer}>
        {info.extensions.length ? (
          <div className="flex flex-wrap gap-1.5">
            {info.extensions.map((x) => (
              <Badge key={x} tone={info.extensionsRequired.includes(x) ? "gold" : "neutral"} className="font-mono">
                {x}
                {info.extensionsRequired.includes(x) && <span className="opacity-70">· {t("studio.scene.required")}</span>}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-400">{t("studio.scene.noExtensions")}</p>
        )}
      </Section>
      <Section title={t("studio.scene.file")} icon={Data}>
        {rows.map(([k, v]) => (
          <Row key={k} label={k}>
            <span title={v}>{v}</span>
          </Row>
        ))}
      </Section>
      <Section title={t("studio.scene.tools")}>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={csv} className={btnCls}>
            <DocumentDownload size={15} /> {t("studio.scene.csv")}
          </button>
          <button type="button" onClick={() => engine.fixUpAxis()} className={btnCls}>
            <RotateRight size={15} /> {t("studio.scene.fixUp")}
          </button>
        </div>
      </Section>
    </div>
  );
}

const btnCls =
  "flex h-9 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-ink-850 px-2 text-xs font-semibold text-ink-100 transition hover:border-gold-500/50 hover:text-stone-100 active:scale-[0.98] [&_svg]:shrink-0 [&_svg]:text-gold-400";

function Note({ text }: { text: string }) {
  return (
    <p className="flex gap-2 rounded-xl border border-info/25 bg-info/6 p-2.5 text-[11px] leading-relaxed text-ink-200">
      <InfoCircle size={14} className="mt-0.5 shrink-0 text-info" /> {text}
    </p>
  );
}

// ───────────────────────────── notes ─────────────────────────────

export function NotesPanel() {
  const { engine, store } = useStudio();
  const { t } = useI18n();
  const measures = useS((s) => s.measures);
  const areas = useS((s) => s.areas);
  const pins = useS((s) => s.pins);
  const active = useS((s) => s.activePin);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const v = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);
  const totalArea = areas.reduce((s, a) => s + a.area, 0);

  const exportJson = () => downloadNotesJson(engine);
  const importJson = async (f: File) => {
    try {
      const d = JSON.parse(await f.text()) as { measures?: { a: number[]; b: number[] }[]; areas?: { area: number; point: number[]; normal: number[]; orientation?: string }[]; pins?: { n?: number; text?: string; position: number[]; normal?: number[] }[] };
      const ok = (a: unknown): a is [number, number, number] => Array.isArray(a) && a.length === 3 && a.every((x) => typeof x === "number");
      const ms = (d.measures ?? []).filter((m) => ok(m.a) && ok(m.b)).map((m) => ({ id: uid(), a: m.a as [number, number, number], b: m.b as [number, number, number], createdAt: Date.now() }));
      const as = (d.areas ?? []).filter((a) => typeof a.area === "number" && ok(a.point)).map((a) => ({ id: uid(), area: a.area, point: a.point as [number, number, number], normal: (ok(a.normal) ? a.normal : [0, 1, 0]) as [number, number, number], label: a.orientation === "vertical" ? "v" : "h", createdAt: Date.now() }));
      let n = pins.reduce((m, p) => Math.max(m, p.n), 0);
      const ps: Pin[] = (d.pins ?? []).filter((p) => ok(p.position)).map((p) => ({ id: uid(), n: ++n, text: String(p.text ?? ""), position: p.position as [number, number, number], normal: (ok(p.normal) ? p.normal : [0, 1, 0]) as [number, number, number], target: null, createdAt: Date.now() }));
      store.set((s) => ({ measures: [...s.measures, ...ms], areas: [...s.areas, ...as], pins: [...s.pins, ...ps] }));
      toast.success(t("studio.notes.imported", { n: ms.length + as.length + ps.length }));
      engine.invalidate();
    } catch {
      toast.error(t("studio.notes.importError"));
    }
  };
  const focus = (p: number[]) => engine.cam?.focus(v(p), Math.max(6, engine.bounds.radius * 0.3));
  const empty = !measures.length && !areas.length && !pins.length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <button type="button" onClick={exportJson} disabled={empty} className={cn(btnCls, "flex-1 disabled:opacity-40")}>
          <DocumentDownload size={15} /> {t("studio.notes.exportJson")}
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className={cn(btnCls, "flex-1")}>
          <DocumentUpload size={15} /> {t("studio.notes.importJson")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importJson(f);
            e.target.value = "";
          }}
        />
        <p className="w-full text-[11px] text-ink-400">{t("studio.notes.saved")}</p>
      </div>

      <Section
        title={`${t("studio.notes.pins")} · ${pins.length}`}
        icon={MessageText}
        action={pins.length > 0 && <ClearBtn onClick={() => store.set({ pins: [], activePin: null })} label={t("studio.notes.clearAll")} />}
      >
        {!pins.length ? (
          <p className="text-xs leading-relaxed text-ink-400">{t("studio.notes.pinsEmpty")}</p>
        ) : (
          <ul className="space-y-2">
            {pins.map((p) => (
              <li
                key={p.id}
                className={cn("rounded-xl border p-2.5 transition", active === p.id ? "border-gold-500/50 bg-gold-500/6" : "border-line bg-ink-850/50")}
                onClick={() => store.set({ activePin: p.id })}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-full rounded-bl-none bg-gold-gradient font-mono text-[11px] font-bold text-onyx">{p.n}</span>
                  <span className="flex-1 truncate text-xs font-semibold text-stone-100">{t("studio.notes.pin", { n: p.n })}</span>
                  <IconBtn size="sm" icon={SearchZoomIn} label={t("studio.notes.focus")} onClick={() => focus(p.position)} />
                  <IconBtn
                    size="sm"
                    icon={Trash}
                    tone="danger"
                    label={t("studio.notes.delete")}
                    onClick={() => store.set((s) => ({ pins: s.pins.filter((x) => x.id !== p.id), activePin: s.activePin === p.id ? null : s.activePin }))}
                  />
                </div>
                <PinText pin={p} autoFocus={active === p.id && !p.text} placeholder={t("studio.notes.pinPlaceholder")} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title={`${t("studio.notes.measures")} · ${measures.length}`}
        icon={Ruler}
        action={measures.length > 0 && <ClearBtn onClick={() => store.set({ measures: [] })} label={t("studio.notes.clearAll")} />}
      >
        {!measures.length ? (
          <p className="text-xs leading-relaxed text-ink-400">{t("studio.notes.measuresEmpty")}</p>
        ) : (
          <ul className="space-y-1">
            {measures.map((m, i) => {
              const a = v(m.a),
                b = v(m.b);
              const d = b.clone().sub(a);
              return (
                <li key={m.id} className="group/m flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-fg/5">
                  <span className="w-5 font-mono text-[10px] text-ink-500">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[13px] font-semibold text-stone-100">{fmtM(a.distanceTo(b))}</div>
                    <div className="truncate font-mono text-[10px] text-ink-400">
                      <span className="text-danger">Δx</span> {fmtNum(Math.abs(d.x), 2)} · <span className="text-success">Δy</span> {fmtNum(Math.abs(d.y), 2)} ·{" "}
                      <span className="text-info">Δz</span> {fmtNum(Math.abs(d.z), 2)}
                    </div>
                  </div>
                  <IconBtn size="sm" icon={SearchZoomIn} label={t("studio.notes.focus")} onClick={() => focus(a.clone().lerp(b, 0.5).toArray())} />
                  <IconBtn size="sm" icon={Trash} tone="danger" label={t("studio.notes.delete")} onClick={() => store.set((s) => ({ measures: s.measures.filter((x) => x.id !== m.id) }))} />
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section
        title={`${t("studio.notes.areas")} · ${areas.length}`}
        icon={Grid1}
        action={areas.length > 0 && <ClearBtn onClick={() => store.set({ areas: [] })} label={t("studio.notes.clearAll")} />}
      >
        {!areas.length ? (
          <p className="text-xs leading-relaxed text-ink-400">{t("studio.notes.areasEmpty")}</p>
        ) : (
          <>
            <ul className="space-y-1">
              {areas.map((a, i) => (
                <li key={a.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-fg/5">
                  <span className="w-5 font-mono text-[10px] text-ink-500">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[13px] font-semibold text-stone-100">{fmtM2(a.area, 2)}</div>
                    <div className="text-[10.5px] text-ink-400">{a.label === "h" ? t("studio.notes.horizontal") : t("studio.notes.vertical")}</div>
                  </div>
                  <IconBtn size="sm" icon={SearchZoomIn} label={t("studio.notes.focus")} onClick={() => focus(a.point)} />
                  <IconBtn size="sm" icon={Trash} tone="danger" label={t("studio.notes.delete")} onClick={() => store.set((s) => ({ areas: s.areas.filter((x) => x.id !== a.id) }))} />
                </li>
              ))}
            </ul>
            {areas.length > 1 && <div className="mt-2 text-right font-mono text-xs text-gold-200">{t("studio.notes.total", { v: fmtM2(totalArea, 2) })}</div>}
          </>
        )}
      </Section>
    </div>
  );
}

function ClearBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="cursor-pointer rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-ink-400 transition hover:bg-danger/10 hover:text-danger">
      {label}
    </button>
  );
}

function PinText({ pin, autoFocus, placeholder }: { pin: Pin; autoFocus: boolean; placeholder: string }) {
  const { store, engine } = useStudio();
  const [v, setV] = React.useState(pin.text);
  React.useEffect(() => setV(pin.text), [pin.text]);
  return (
    <textarea
      autoFocus={autoFocus}
      value={v}
      rows={2}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v !== pin.text) {
          store.set((s) => ({ pins: s.pins.map((p) => (p.id === pin.id ? { ...p, text: v } : p)) }));
          engine.invalidate();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.blur();
      }}
      className="w-full resize-y rounded-lg border border-line bg-ink-850 px-2.5 py-1.5 text-xs leading-relaxed text-stone-100 outline-none placeholder:text-ink-400 focus:border-gold-500/60"
    />
  );
}

// ───────────────────────────── view ─────────────────────────────

const ENV_SWATCH: Record<EnvPreset, string> = {
  city: "linear-gradient(160deg,#a9bed3 0%,#d9d4c8 55%,#6f6a60 100%)",
  sunset: "linear-gradient(160deg,#f0a05a 0%,#c2607a 50%,#3b2f4f 100%)",
  night: "linear-gradient(160deg,#2b3756 0%,#141a2e 60%,#07080c 100%)",
  studio: "radial-gradient(circle at 50% 30%,#ffffff 0%,#c9c9c9 50%,#7d7d7d 100%)",
  dawn: "linear-gradient(160deg,#f6c7a1 0%,#d9c6c8 45%,#a9c1e0 100%)",
  park: "linear-gradient(160deg,#cfe0f0 0%,#a8c49a 55%,#4f6b3f 100%)",
  none: "repeating-conic-gradient(var(--color-ink-700) 0 25%, var(--color-ink-850) 0 50%) 50% / 10px 10px",
};

export function ViewPanel() {
  const { engine, store } = useStudio();
  const { t } = useI18n();
  const s = useS((x) => x);
  const floors = engine.parts.floors.length;
  const set = store.set;
  const sec = (patch: Partial<typeof s.section>) => set((st) => ({ section: { ...st.section, ...patch } }));
  return (
    <div>
      <Section title={t("studio.view.environment")} icon={Sun1}>
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.keys(ENV_SWATCH) as EnvPreset[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => set({ env: k })}
              aria-pressed={s.env === k}
              className={cn(
                "group/env flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-1 transition",
                s.env === k ? "border-gold-400 bg-gold-500/8" : "border-line hover:border-line-strong",
              )}
            >
              <span className="h-9 w-full rounded-lg shadow-card" style={{ background: ENV_SWATCH[k] }} />
              <span className={cn("text-[10.5px] font-semibold", s.env === k ? "text-gold-200" : "text-ink-300")}>{t(`studio.view.envs.${k}`)}</span>
            </button>
          ))}
        </div>
        <div className="mt-2">
          <Slider label={t("studio.view.intensity")} value={s.envIntensity} min={0} max={3} disabled={s.env === "none"} onChange={(v) => set({ envIntensity: v })} />
          <Toggle label={t("studio.view.background")} checked={s.envBackground} disabled={s.env === "none"} onChange={(v) => set({ envBackground: v })} />
        </div>
      </Section>
      <Section title={t("studio.view.sun")} icon={Sun1}>
        <Slider label={t("studio.view.azimuth")} value={s.sunAzimuth} min={0} max={360} step={1} format={(v) => `${Math.round(v)}°`} onChange={(v) => set({ sunAzimuth: v })} />
        <Slider label={t("studio.view.elevation")} value={s.sunElevation} min={2} max={90} step={1} format={(v) => `${Math.round(v)}°`} onChange={(v) => set({ sunElevation: v })} />
        <Slider label={t("studio.view.sunIntensity")} value={s.sunIntensity} min={0} max={6} step={0.05} onChange={(v) => set({ sunIntensity: v })} />
        <Toggle label={t("studio.view.shadows")} checked={s.shadows} onChange={(v) => set({ shadows: v })} />
      </Section>
      <Section title={t("studio.view.display")} icon={Scanning}>
        <Toggle label={<span className="flex items-center gap-2">{t("studio.view.xray")}</span>} checked={s.xray} onChange={(v) => set({ xray: v })} />
        <Toggle label={t("studio.view.wireframe")} checked={s.wireframe} onChange={(v) => set({ wireframe: v })} />
        <Toggle label={t("studio.view.grid")} checked={s.grid} onChange={(v) => set({ grid: v })} />
        <div className="mt-2">
          <div className="mb-1.5 text-xs text-ink-200">{t("studio.view.projection")}</div>
          <Segmented
            value={s.projection}
            onChange={(v) => set({ projection: v })}
            options={[
              { value: "perspective", label: t("studio.toolbar.perspective") },
              { value: "orthographic", label: t("studio.toolbar.orthographic") },
            ]}
          />
        </div>
      </Section>
      <Section title={t("studio.view.section")} icon={Scissor}>
        <Toggle label={t("studio.view.sectionOn")} checked={s.section.enabled} onChange={(v) => sec({ enabled: v })} />
        <div className={cn("mt-2 space-y-2", !s.section.enabled && "pointer-events-none opacity-45")}>
          <div className="flex items-center gap-3">
            <span className="w-16 text-xs text-ink-200">{t("studio.view.axis")}</span>
            <Segmented
              className="flex-1"
              value={s.section.axis}
              onChange={(v) => sec({ axis: v })}
              options={[
                { value: "x", label: <span className="font-mono text-danger">X</span> },
                { value: "y", label: <span className="font-mono text-success">Y</span> },
                { value: "z", label: <span className="font-mono text-info">Z</span> },
              ]}
            />
          </div>
          <Slider
            label={t("studio.view.offset")}
            value={s.section.offset}
            min={0}
            max={1}
            step={0.002}
            format={() => fmtM(engine.sectionPosition(), 2)}
            onChange={(v) => sec({ offset: v })}
          />
          <Toggle label={t("studio.view.flip")} checked={s.section.flip} onChange={(v) => sec({ flip: v })} />
          <Toggle label={t("studio.view.showPlane")} checked={s.section.showPlane} onChange={(v) => sec({ showPlane: v })} />
          <Toggle label={t("studio.view.fill")} checked={s.section.fill} onChange={(v) => sec({ fill: v })} />
        </div>
      </Section>
      {floors > 0 && (
        <Section title={t("studio.view.explode")} icon={Layer}>
          <Slider
            label={t("studio.floors.explode")}
            value={s.explode}
            onChange={(v) => engine.setExplode(v)}
            format={(v) => t("studio.floors.gap", { m: fmtM(v * engine.explodeGap(), 1) })}
          />
        </Section>
      )}
      <div className="flex items-center gap-2 px-4 py-3 text-[11px] text-ink-400">
        <Warning2 size={13} className="shrink-0" />
        <span>{t("studio.hints.orbit")}</span>
      </div>
    </div>
  );
}
