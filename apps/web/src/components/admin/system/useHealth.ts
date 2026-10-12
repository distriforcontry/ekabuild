"use client";
import * as React from "react";
import { api, API_BASE } from "@/lib/api";
import type { SystemHealth } from "@/lib/types";
import type { HealthKey } from "./data";

export type Health = { status: string; instance: string | null; uptime: number | null; db: string | null; redis: string | null; rabbitmq: string | null };
export type HealthSample = { at: number; ok: boolean; ms: number; instance: string | null };
export type NodeStatus = "up" | "down" | "unknown" | "mock";
/** integrations that report a demo/mock mode */
const INTEGRATIONS = new Set<HealthKey>(["sms", "eimzo", "cadastre"]);

const HISTORY = 24;

/**
 * Polls GET /api/v1/health (every 10 s while the tab is visible) and keeps a short history of which
 * replica answered — with two api replicas behind least_conn you can watch the balancer alternate.
 */
export function useHealth(intervalMs = 10_000) {
  const [health, setHealth] = React.useState<Health | null>(null);
  const [reachable, setReachable] = React.useState<boolean | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [history, setHistory] = React.useState<HealthSample[]>([]);
  const [lastAt, setLastAt] = React.useState<number | null>(null);
  /** deep checks (GET /admin/system/health); null + deepFailed → fall back to the basic probe */
  const [deep, setDeep] = React.useState<SystemHealth | null>(null);
  const [deepFailed, setDeepFailed] = React.useState(false);
  const busy = React.useRef(false);

  const check = React.useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    const t0 = performance.now();
    let sample: HealthSample;
    const deepReq = api
      .get<SystemHealth>("/admin/system/health")
      .then((d) => {
        setDeep(d && typeof d === "object" && d.checks ? d : null);
        setDeepFailed(!(d && d.checks));
      })
      .catch(() => {
        setDeep(null);
        setDeepFailed(true);
      });
    try {
      const res = await fetch(`${API_BASE}/health`, { cache: "no-store", credentials: "include" });
      const ms = Math.round(performance.now() - t0);
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const instance = (typeof j.instance === "string" && j.instance) || res.headers.get("x-served-by");
      const h: Health = {
        status: typeof j.status === "string" ? j.status : res.ok ? "ok" : "down",
        instance: instance || null,
        uptime: typeof j.uptime === "number" ? j.uptime : null,
        db: typeof j.db === "string" ? j.db : null,
        redis: typeof j.redis === "string" ? j.redis : null,
        rabbitmq: typeof j.rabbitmq === "string" ? j.rabbitmq : null,
      };
      setHealth(h);
      setReachable(res.ok || res.status === 503);
      sample = { at: Date.now(), ok: res.ok && h.status === "ok", ms, instance: h.instance };
    } catch {
      setReachable(false);
      setHealth(null);
      sample = { at: Date.now(), ok: false, ms: Math.round(performance.now() - t0), instance: null };
    } finally {
      await deepReq;
      busy.current = false;
      setChecking(false);
    }
    setLastAt(Date.now());
    setHistory((h) => [...h.slice(-(HISTORY - 1)), sample]);
  }, []);

  React.useEffect(() => {
    check();
    const id = window.setInterval(() => document.visibilityState === "visible" && check(), intervalMs);
    const onVis = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [check, intervalMs]);

  const statusOf = React.useCallback(
    (key: HealthKey | undefined): NodeStatus => {
      if (!key) return "unknown";
      if (key === "web") return "up"; // this page was served by a web replica
      if (reachable === null) return "unknown";
      if (key === "edge") return reachable ? "up" : "unknown";
      if (key === "api") return reachable && health ? "up" : "down";
      if (deep) {
        const c = deep.checks;
        switch (key) {
          case "db":
            return c.mysql?.ok ? "up" : "down";
          case "redis":
            return c.redis?.ok ? "up" : "down";
          case "rabbitmq":
            return c.rabbitmq?.ok ? "up" : "down";
          case "workers":
            return (c.workers?.count ?? 0) > 0 ? "up" : "down";
          case "storage":
            return c.storage?.ok ? "up" : "down";
          case "sms":
          case "eimzo":
          case "cadastre": {
            const i = c[key];
            if (!i) return "unknown";
            return !i.ok ? "down" : i.mock ? "mock" : "up";
          }
        }
      }
      if (!health) return "unknown";
      const v = key === "db" ? health.db : key === "redis" ? health.redis : key === "rabbitmq" ? health.rabbitmq : null;
      if (!v || v === "disabled") return "unknown";
      return v === "up" || v === "ready" ? "up" : "down";
    },
    [health, reachable, deep],
  );

  /** probe latency for a node, ms (deep checks; the api node uses the /health round trip) */
  const latencyOf = React.useCallback(
    (key: HealthKey | undefined): number | null => {
      if (key === "api") return history[history.length - 1]?.ok ? history[history.length - 1]!.ms : null;
      if (!deep) return null;
      const ms = key === "db" ? deep.checks.mysql?.ms : key === "redis" ? deep.checks.redis?.ms : key === "rabbitmq" ? deep.checks.rabbitmq?.ms : undefined;
      return typeof ms === "number" ? ms : null;
    },
    [deep, history],
  );

  /** translation key suffix for a node's status ("up" integrations read as "connected") */
  const labelOf = React.useCallback(
    (key: HealthKey | undefined, status: NodeStatus): "up" | "down" | "unknown" | "mock" | "connected" =>
      status === "up" && key && INTEGRATIONS.has(key) ? "connected" : status,
    [],
  );

  // a failing deep core check (db, cache, bus, workers, disk) also degrades the overall state
  const deepDegraded = deep
    ? !deep.checks.mysql?.ok || !deep.checks.redis?.ok || !deep.checks.rabbitmq?.ok || !((deep.checks.workers?.count ?? 0) > 0) || deep.checks.storage?.ok === false
    : false;
  const overall: "ok" | "degraded" | "down" | null =
    reachable === null ? null : !reachable || !health ? "down" : health.status === "ok" && !deepDegraded ? "ok" : "degraded";

  return { health, reachable, checking, history, lastAt, check, statusOf, latencyOf, labelOf, overall, deep, deepFailed };
}
