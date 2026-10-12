"use client";
// Tiny external store (no extra deps) for the studio UI state. Three.js objects live in the Engine;
// this store only holds serialisable view/tool state plus a `version` counter that panels subscribe to.
import * as React from "react";

export type Tool = "select" | "measure" | "area" | "pin";
export type TransformMode = "translate" | "rotate" | "scale";
export type ViewName = "front" | "back" | "top" | "right" | "left" | "iso";
export type EnvPreset = "city" | "sunset" | "night" | "studio" | "dawn" | "park" | "none";
export type InspectorTab = "props" | "material" | "floors" | "scene" | "notes" | "view";
export type PickMode = "object" | "group";

export type Vec3 = [number, number, number];

export interface Measure {
  id: string;
  a: Vec3;
  b: Vec3;
  createdAt: number;
}
export interface AreaMeasure {
  id: string;
  area: number;
  point: Vec3;
  normal: Vec3;
  /** world-space triangles of the highlighted region (session only, not persisted) */
  tris?: Float32Array;
  label: string;
  createdAt: number;
}
export interface Pin {
  id: string;
  n: number;
  position: Vec3;
  normal: Vec3;
  text: string;
  target: string | null;
  createdAt: number;
}

export interface SectionState {
  enabled: boolean;
  axis: "x" | "y" | "z";
  /** 0..1 within the model bounds */
  offset: number;
  flip: boolean;
  showPlane: boolean;
  fill: boolean;
}

export interface StudioState {
  /** bumps whenever the scene graph / names / visibility / transforms change */
  version: number;
  /** bumps on live transform drags (properties panel refresh) */
  tick: number;
  loaded: boolean;
  selection: string | null;
  hover: string | null;
  tool: Tool;
  transform: TransformMode | null;
  space: "world" | "local";
  snap: boolean;
  pickMode: PickMode;
  xray: boolean;
  wireframe: boolean;
  grid: boolean;
  shadows: boolean;
  env: EnvPreset;
  envIntensity: number;
  envBackground: boolean;
  sunAzimuth: number;
  sunElevation: number;
  sunIntensity: number;
  projection: "perspective" | "orthographic";
  section: SectionState;
  explode: number;
  isolated: string | null;
  measures: Measure[];
  areas: AreaMeasure[];
  pins: Pin[];
  activePin: string | null;
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  leftOpen: boolean;
  rightOpen: boolean;
  leftWidth: number;
  rightWidth: number;
  tab: InspectorTab;
  helpOpen: boolean;
  uploadOpen: boolean;
  /** bumps on Escape — the viewport cancels a half-made measurement first */
  esc: number;
}

export const DEFAULT_SECTION: SectionState = { enabled: false, axis: "y", offset: 0.5, flip: false, showPlane: true, fill: true };

export function initialState(): StudioState {
  return {
    version: 0,
    tick: 0,
    loaded: false,
    selection: null,
    hover: null,
    tool: "select",
    transform: null,
    space: "world",
    snap: true,
    pickMode: "group",
    xray: false,
    wireframe: false,
    grid: true,
    shadows: true,
    env: "city",
    envIntensity: 1,
    envBackground: false,
    sunAzimuth: 35,
    sunElevation: 48,
    sunIntensity: 2.4,
    projection: "perspective",
    section: { ...DEFAULT_SECTION },
    explode: 0,
    isolated: null,
    measures: [],
    areas: [],
    pins: [],
    activePin: null,
    canUndo: false,
    canRedo: false,
    dirty: false,
    undoLabel: null,
    redoLabel: null,
    leftOpen: true,
    rightOpen: true,
    leftWidth: 280,
    rightWidth: 340,
    tab: "props",
    helpOpen: false,
    uploadOpen: false,
    esc: 0,
  };
}

type Listener = () => void;

export class Store<T extends object> {
  private state: T;
  private listeners = new Set<Listener>();
  constructor(init: T) {
    this.state = init;
  }
  get = () => this.state;
  set = (patch: Partial<T> | ((s: T) => Partial<T>)) => {
    const p = typeof patch === "function" ? patch(this.state) : patch;
    let changed = false;
    for (const k in p) {
      if (!Object.is(this.state[k as keyof T], p[k as keyof T])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...p };
    this.listeners.forEach((l) => l());
  };
  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
}

export type StudioStore = Store<StudioState>;

export function useStoreValue<T extends object, U>(store: Store<T>, selector: (s: T) => U): U {
  const sel = React.useRef(selector);
  sel.current = selector;
  return React.useSyncExternalStore(
    store.subscribe,
    () => sel.current(store.get()),
    () => sel.current(store.get()),
  );
}
