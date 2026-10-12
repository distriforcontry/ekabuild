import client from "prom-client";
import { env } from "../env";

/**
 * Prometheus metrics (scraped by Prometheus in compose / ServiceMonitor in Kubernetes).
 * API: GET /metrics (blocked at the public edge, reachable only inside the cluster network).
 * Worker: tiny HTTP server on WORKER_METRICS_PORT (default 9100).
 */
export const registry = new client.Registry();
registry.setDefaultLabels({ service: process.env.SERVICE_NAME ?? "api", instance_id: env.INSTANCE_ID });
client.collectDefaultMetrics({ register: registry, prefix: "eka_" });

export const httpDuration = new client.Histogram({
  name: "eka_http_request_duration_seconds",
  help: "HTTP request duration by route",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const wsConnections = new client.Gauge({
  name: "eka_support_ws_connections",
  help: "Open support-chat WebSocket connections on this replica",
  labelNames: ["kind"] as const,
  registers: [registry],
});

export const busPublished = new client.Counter({
  name: "eka_bus_published_total",
  help: "Events published to RabbitMQ",
  labelNames: ["routing_key", "result"] as const,
  registers: [registry],
});

export const jobsProcessed = new client.Counter({
  name: "eka_worker_jobs_total",
  help: "Worker jobs by queue and outcome",
  labelNames: ["queue", "outcome"] as const,
  registers: [registry],
});

export const jobDuration = new client.Histogram({
  name: "eka_worker_job_duration_seconds",
  help: "Worker job duration",
  labelNames: ["queue"] as const,
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 15, 60],
  registers: [registry],
});

export const businessEvents = new client.Counter({
  name: "eka_business_events_total",
  help: "Domain events (logins, OTP sent, purchases, signatures, complaints …)",
  labelNames: ["event"] as const,
  registers: [registry],
});

/** Collapse ids so route labels stay low-cardinality */
export function routeLabel(url: string, routerPath?: string) {
  if (routerPath) return routerPath;
  return url.split("?")[0]!.replace(/\/[a-z0-9]{20,}|\/\d+/gi, "/:id");
}
