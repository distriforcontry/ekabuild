"use client";
// Scene tree (outliner): virtualised rows, search, visibility / lock / isolate, inline rename, keyboard navigation.
import * as React from "react";
import * as THREE from "three";
import {
  ArrowDown2,
  ArrowRight2,
  Box,
  Camera,
  CloseCircle,
  Copy,
  Edit2,
  Eye,
  EyeSlash,
  Gps,
  Hierarchy,
  Lamp,
  Layer,
  Lock,
  More,
  SearchNormal1,
  SearchZoomIn,
  Trash,
  Unlock,
  Element3,
} from "iconsax-reactjs";
import type { Icon } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { useStudio, useS } from "./context";
import { displayName, fmtInt, isAncestor, kindOf, trianglesOf, worldBox, type NodeKind } from "./scene-utils";
import { IconBtn } from "./ui";

const ROW = 28;

const KIND_ICON: Record<NodeKind, Icon> = {
  group: Layer,
  mesh: Box,
  instanced: Element3,
  points: Element3,
  line: Element3,
  light: Lamp,
  camera: Camera,
  bone: Hierarchy,
  object: Box,
};

type RowData = {
  o: THREE.Object3D;
  depth: number;
  hasChildren: boolean;
  open: boolean;
  name: string;
  kind: NodeKind;
  hidden: boolean;
  locked: boolean;
  dimmed: boolean;
};

export function Outliner() {
  const { engine, store } = useStudio();
  const { t } = useI18n();
  const version = useS((s) => s.version);
  const selection = useS((s) => s.selection);
  const hover = useS((s) => s.hover);
  const isolated = useS((s) => s.isolated);
  const root = engine.root;

  const [query, setQuery] = React.useState("");
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const [renaming, setRenaming] = React.useState<string | null>(null);
  const scroller = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewH, setViewH] = React.useState(600);

  // default expansion: path down to the "container" (e.g. Scene → building)
  React.useEffect(() => {
    if (!root) return;
    const s = new Set<string>([root.uuid]);
    let c: THREE.Object3D | null = engine.container;
    while (c) {
      s.add(c.uuid);
      c = c.parent;
    }
    setExpanded(s);
    setQuery("");
  }, [root, engine]);

  // reveal the selection
  React.useEffect(() => {
    const o = engine.get(selection);
    if (!o) return;
    setExpanded((prev) => {
      let changed = false;
      const next = new Set(prev);
      let p = o.parent;
      while (p && p !== engine.wrapper) {
        if (!next.has(p.uuid)) {
          next.add(p.uuid);
          changed = true;
        }
        p = p.parent;
      }
      return changed ? next : prev;
    });
  }, [selection, engine]);

  React.useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewH(el.clientHeight));
    ro.observe(el);
    setViewH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const rows = React.useMemo<RowData[]>(() => {
    if (!root) return [];
    const q = query.trim().toLowerCase();
    let keep: Set<THREE.Object3D> | null = null;
    if (q) {
      keep = new Set();
      root.traverse((o) => {
        if (displayName(o).toLowerCase().includes(q)) {
          let p: THREE.Object3D | null = o;
          while (p && p !== engine.wrapper) {
            keep!.add(p);
            p = p.parent;
          }
        }
      });
    }
    const iso = engine.get(isolated);
    const out: RowData[] = [];
    const walk = (o: THREE.Object3D, depth: number) => {
      if (keep && !keep.has(o)) return;
      const kids = o.children;
      const open = q ? true : expanded.has(o.uuid);
      const kind = kindOf(o);
      out.push({
        o,
        depth,
        hasChildren: kids.length > 0,
        open,
        name: o === root ? engine.info?.name || displayName(o) || "Scene" : displayName(o),
        kind,
        hidden: !o.visible,
        locked: Boolean(o.userData.__locked),
        dimmed: Boolean(iso && o !== iso && !isAncestor(iso, o) && !isAncestor(o, iso)),
      });
      if (open) for (const c of kids) walk(c, depth + 1);
    };
    walk(root, 0);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, version, expanded, query, isolated, engine]);

  // keep the selected row in view
  React.useEffect(() => {
    if (!selection) return;
    const i = rows.findIndex((r) => r.o.uuid === selection);
    const el = scroller.current;
    if (i < 0 || !el) return;
    const top = i * ROW;
    if (top < el.scrollTop) el.scrollTop = top - ROW;
    else if (top + ROW > el.scrollTop + el.clientHeight) el.scrollTop = top - el.clientHeight + ROW * 2;
  }, [selection, rows]);

  const toggleOpen = (uuid: string, open?: boolean) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      const want = open ?? !next.has(uuid);
      if (want) next.add(uuid);
      else next.delete(uuid);
      return next;
    });

  const expandAll = () => {
    const s = new Set<string>();
    root?.traverse((o) => o.children.length && s.add(o.uuid));
    setExpanded(s);
  };
  const collapseAll = () => setExpanded(new Set(root ? [root.uuid] : []));

  const start = Math.max(0, Math.floor(scrollTop / ROW) - 8);
  const end = Math.min(rows.length, Math.ceil((scrollTop + viewH) / ROW) + 8);
  const slice = rows.slice(start, end);
  const nodeCount = React.useMemo(() => {
    let n = 0;
    root?.traverse(() => n++);
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, version]);

  const onKey = (e: React.KeyboardEvent) => {
    if (renaming || (e.target as HTMLElement).tagName === "INPUT") return;
    const i = rows.findIndex((r) => r.o.uuid === selection);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      const n = Math.max(0, Math.min(rows.length - 1, (i < 0 ? -1 : i) + (e.key === "ArrowDown" ? 1 : -1)));
      const r = rows[n];
      if (r) engine.select(r.o.uuid);
    } else if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && i >= 0) {
      e.preventDefault();
      e.stopPropagation();
      const r = rows[i]!;
      if (e.key === "ArrowRight") {
        if (r.hasChildren && !r.open) toggleOpen(r.o.uuid, true);
        else if (r.open && r.o.children[0]) engine.select(r.o.children[0].uuid);
      } else if (r.open && r.hasChildren) toggleOpen(r.o.uuid, false);
      else if (r.o.parent && r.o !== root) engine.select(r.o.parent.uuid);
    } else if (e.key === "F2" && selection) {
      e.preventDefault();
      setRenaming(selection);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line pl-4 pr-2">
        <Hierarchy size={16} className="text-gold-400" variant="Bulk" />
        <span className="text-[13px] font-semibold text-stone-100">{t("studio.outliner.title")}</span>
        <span className="font-mono text-[10.5px] text-ink-400">{t("studio.outliner.nodes", { n: fmtInt(nodeCount) })}</span>
        <span className="flex-1" />
        <IconBtn icon={ArrowDown2} size="sm" label={t("studio.outliner.expandAll")} onClick={expandAll} />
        <IconBtn icon={ArrowRight2} size="sm" label={t("studio.outliner.collapseAll")} onClick={collapseAll} />
      </div>
      <div className="shrink-0 px-3 py-2">
        <div className="flex h-8 items-center gap-2 rounded-lg border border-line bg-ink-850 px-2.5 transition focus-within:border-gold-500/60 focus-within:ring-2 focus-within:ring-gold-500/15">
          <SearchNormal1 size={14} className="shrink-0 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("studio.outliner.search")}
            aria-label={t("studio.outliner.search")}
            className="h-full min-w-0 flex-1 bg-transparent text-xs text-stone-100 outline-none placeholder:text-ink-400"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="cursor-pointer text-ink-400 hover:text-stone-100" aria-label={t("studio.toolbar.clear")}>
              <CloseCircle size={14} />
            </button>
          )}
        </div>
        {isolated && (
          <button
            type="button"
            onClick={() => engine.isolate(null)}
            className="mt-2 flex w-full cursor-pointer items-center gap-2 rounded-lg border border-gold-500/30 bg-gold-500/8 px-2.5 py-1.5 text-left text-[11px] font-semibold text-gold-200 transition hover:bg-gold-500/15"
          >
            <Gps size={14} variant="Bold" />
            <span className="min-w-0 flex-1 truncate">
              {t("studio.outliner.isolated")}: {displayName(engine.get(isolated) ?? new THREE.Object3D())}
            </span>
            <CloseCircle size={14} />
          </button>
        )}
      </div>
      <div
        ref={scroller}
        role="tree"
        aria-label={t("studio.outliner.title")}
        tabIndex={0}
        onKeyDown={onKey}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        onMouseLeave={() => store.get().hover && store.set({ hover: null })}
        className="relative min-h-0 flex-1 overflow-auto pb-4 outline-none"
      >
        {!rows.length ? (
          <div className="px-4 py-8 text-center text-xs text-ink-400">{query ? t("studio.outliner.noMatch") : t("studio.outliner.empty")}</div>
        ) : (
          <div style={{ height: rows.length * ROW }} className="relative">
            <div style={{ transform: `translateY(${start * ROW}px)` }} className="absolute inset-x-0 top-0">
              {slice.map((r) => (
                <TreeRow
                  key={r.o.uuid}
                  r={r}
                  selected={selection === r.o.uuid}
                  hovered={hover === r.o.uuid}
                  isolated={isolated === r.o.uuid}
                  renaming={renaming === r.o.uuid}
                  query={query}
                  isRoot={r.o === root}
                  onToggle={() => toggleOpen(r.o.uuid)}
                  onRename={(name) => {
                    setRenaming(null);
                    if (name !== null) engine.rename(r.o.uuid, name);
                  }}
                  onStartRename={() => setRenaming(r.o.uuid)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-gold-500/30 text-stone-100">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

function TreeRow({
  r,
  selected,
  hovered,
  isolated,
  renaming,
  query,
  isRoot,
  onToggle,
  onRename,
  onStartRename,
}: {
  r: RowData;
  selected: boolean;
  hovered: boolean;
  isolated: boolean;
  renaming: boolean;
  query: string;
  isRoot: boolean;
  onToggle: () => void;
  onRename: (name: string | null) => void;
  onStartRename: () => void;
}) {
  const { engine, store } = useStudio();
  const { t } = useI18n();
  const I = KIND_ICON[r.kind];
  const uuid = r.o.uuid;
  const tris = r.kind === "mesh" || r.kind === "instanced" ? trianglesOf(r.o) : 0;
  return (
    <div
      role="treeitem"
      aria-selected={selected}
      aria-expanded={r.hasChildren ? r.open : undefined}
      aria-level={r.depth + 1}
      onClick={() => engine.select(uuid)}
      onDoubleClick={() => !isRoot && onStartRename()}
      onMouseEnter={() => store.get().hover !== uuid && store.set({ hover: uuid })}
      className={cn(
        "group/row relative flex cursor-pointer items-center gap-1 pr-1.5 text-xs transition-colors",
        selected ? "bg-gold-500/14 text-stone-100" : hovered ? "bg-fg/5 text-stone-100" : "text-ink-200",
        (r.hidden || r.dimmed) && !selected && "text-ink-400",
      )}
      style={{ height: ROW, paddingLeft: 8 + r.depth * 14 }}
    >
      {selected && <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-gold-400" />}
      <button
        type="button"
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={cn("grid size-4 shrink-0 cursor-pointer place-items-center rounded text-ink-400 hover:text-stone-100", !r.hasChildren && "invisible")}
        aria-label={r.open ? "−" : "+"}
      >
        <ArrowRight2 size={11} className={cn("transition-transform duration-150", r.open && "rotate-90")} />
      </button>
      <I size={14} variant={selected ? "Bold" : "Linear"} className={cn("shrink-0", selected ? "text-gold-300" : r.kind === "group" ? "text-gold-500/80" : "text-ink-400")} />
      {renaming ? (
        <input
          autoFocus
          defaultValue={r.name}
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => onRename(e.currentTarget.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") onRename(e.currentTarget.value);
            if (e.key === "Escape") onRename(null);
          }}
          className="h-6 min-w-0 flex-1 rounded border border-gold-500/60 bg-ink-850 px-1.5 text-xs text-stone-100 outline-none"
        />
      ) : (
        <span className={cn("min-w-0 flex-1 truncate", r.hidden && "line-through decoration-ink-500")} title={r.name}>
          <Highlight text={r.name || `(${t(`studio.outliner.kinds.${r.kind}`)})`} q={query} />
        </span>
      )}
      {tris > 0 && !renaming && (
        <span className="hidden shrink-0 font-mono text-[10px] text-ink-500 group-hover/row:inline">{fmtInt(tris)}</span>
      )}
      {!renaming && !isRoot && (
        <span className="flex shrink-0 items-center">
          <RowBtn
            label={isolated ? t("studio.outliner.unisolate") : t("studio.outliner.isolate")}
            onClick={() => engine.isolate(uuid)}
            show={isolated}
          >
            <Gps size={13} variant={isolated ? "Bold" : "Linear"} className={isolated ? "text-gold-300" : undefined} />
          </RowBtn>
          <RowBtn label={r.locked ? t("studio.outliner.unlock") : t("studio.outliner.lock")} onClick={() => engine.toggleLock(uuid)} show={r.locked}>
            {r.locked ? <Lock size={13} variant="Bold" className="text-gold-300" /> : <Unlock size={13} />}
          </RowBtn>
          <RowBtn label={r.hidden ? t("studio.outliner.show") : t("studio.outliner.hide")} onClick={() => engine.toggleVisible(uuid)} show={r.hidden}>
            {r.hidden ? <EyeSlash size={13} /> : <Eye size={13} />}
          </RowBtn>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
                aria-label={t("studio.outliner.actions")}
                className="grid size-6 cursor-pointer place-items-center rounded-md text-ink-400 opacity-0 transition hover:bg-fg/8 hover:text-stone-100 group-hover/row:opacity-100 data-[state=open]:opacity-100"
              >
                <More size={13} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem
                onSelect={() => {
                  engine.select(uuid);
                  engine.cam?.fit(worldBox(r.o, true, engine.root));
                }}
              >
                <SearchZoomIn /> {t("studio.outliner.focus")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => engine.isolate(uuid)}>
                <Gps /> {isolated ? t("studio.outliner.unisolate") : t("studio.outliner.isolate")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => engine.toggleVisible(uuid)}>
                {r.hidden ? <Eye /> : <EyeSlash />} {r.hidden ? t("studio.outliner.show") : t("studio.outliner.hide")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => engine.toggleLock(uuid)}>
                {r.locked ? <Unlock /> : <Lock />} {r.locked ? t("studio.outliner.unlock") : t("studio.outliner.lock")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setTimeout(onStartRename, 50)}>
                <Edit2 /> {t("studio.outliner.rename")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => engine.duplicate(uuid)}>
                <Copy /> {t("studio.outliner.duplicate")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => engine.remove(uuid)} className="text-danger data-[highlighted]:text-danger [&_svg]:!text-danger">
                <Trash /> {t("studio.outliner.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      )}
    </div>
  );
}

function RowBtn({ label, onClick, show, children }: { label: string; onClick: () => void; show?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "grid size-6 cursor-pointer place-items-center rounded-md text-ink-400 transition hover:bg-fg/8 hover:text-stone-100",
        show ? "opacity-100" : "opacity-0 group-hover/row:opacity-100",
      )}
    >
      {children}
    </button>
  );
}
