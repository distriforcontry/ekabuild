"use client";
import * as React from "react";
import type { ComboOption } from "@/components/ui/combobox";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/api";
import type { ProjectCard } from "@/lib/types";
import { asList } from "../hooks";

/** Server-side project search for Comboboxes (GET /projects?q=). Keeps the selected project in the options. */
export function useProjectSearch(selectedId: string | null) {
  const { tr, label } = useI18n();
  const [results, setResults] = React.useState<ProjectCard[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);
  const known = React.useRef(new Map<string, ProjectCard>());
  const seq = React.useRef(0);
  const last = React.useRef<{ q: string; at: number } | null>(null);

  const onSearch = React.useCallback(async (q: string, force = false) => {
    // the Combobox also fires onSearch("") on mount / close — skip identical back-to-back queries
    if (!force && last.current && last.current.q === q && Date.now() - last.current.at < 1500) return;
    last.current = { q, at: Date.now() };
    const id = ++seq.current;
    setLoading(true);
    try {
      const raw = await api.get<unknown>("/projects", { query: { q: q || undefined, pageSize: 20, sort: "trust", scope: "all" } });
      if (id !== seq.current) return;
      const list = asList<ProjectCard>(raw);
      list.forEach((p) => known.current.set(p.id, p));
      setResults(list);
      setError(null);
    } catch (e) {
      if (id === seq.current) setError(e);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void onSearch("");
  }, [onSearch]);

  const selected = selectedId ? known.current.get(selectedId) ?? null : null;
  const options: ComboOption[] = React.useMemo(() => {
    const list = selected && !results.some((p) => p.id === selected.id) ? [selected, ...results] : results;
    return list.map((p) => ({
      value: p.id,
      label: tr(p.name),
      description: `${tr(p.region)} · ${label("projectStatus", p.status)} · ${p.developer?.name ? tr(p.developer.name) : ""}`,
      keywords: `${p.address} ${p.slug}`,
    }));
  }, [results, selected, tr, label]);

  const search = React.useCallback((q: string) => void onSearch(q), [onSearch]);
  const retry = React.useCallback(() => void onSearch("", true), [onSearch]);
  return { options, loading, error, onSearch: search, selected, retry };
}
