"use client";
import * as React from "react";
import type { Engine } from "./engine";
import { useStoreValue, type StudioState, type StudioStore } from "./store";

export type StudioCtx = { engine: Engine; store: StudioStore };
export const StudioContext = React.createContext<StudioCtx | null>(null);

export function useStudio(): StudioCtx {
  const ctx = React.useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used inside <StudioContext.Provider>");
  return ctx;
}

/** subscribe to a slice of studio state (selectors must return primitives or stable references) */
export function useS<U>(selector: (s: StudioState) => U): U {
  const { store } = useStudio();
  return useStoreValue(store, selector);
}
