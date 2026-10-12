import type { Icon as IconType } from "iconsax-reactjs";
import {
  Box,
  Chart2,
  Code1,
  Cpu,
  Data,
  DocumentText,
  Flash,
  FingerScan,
  Global,
  Layer,
  Mobile,
  Monitor,
  People,
  Profile2User,
  Routing2,
  Sms,
  TrendUp,
  ShieldTick,
  Repeat,
  UserTick,
  Messages2,
  Driver,
} from "iconsax-reactjs";

/* ───────────────────────────── Architecture diagram ───────────────────────────── */

export type InfoKey =
  | "internet"
  | "nginx"
  | "web"
  | "api"
  | "mysql"
  | "redis"
  | "rabbitmq"
  | "worker"
  | "storage"
  | "eimzo"
  | "sms"
  | "ingress"
  | "hpa"
  | "keda"
  | "pdb"
  | "monitoring";

export type HealthKey = "edge" | "web" | "api" | "db" | "redis" | "rabbitmq";
export type EdgeKind = "http" | "data" | "event" | "external" | "metrics";
export type ViewKey = "compose" | "k8s";

export type MapNode = {
  id: string;
  info: InfoKey;
  x: number;
  y: number;
  w: number;
  h: number;
  /** pool = dashed group frame; chip = small attachment badge (HPA, PDB…) */
  kind?: "node" | "pool" | "chip";
  icon?: IconType;
  /** literal title (replica names); defaults to the translated node title */
  title?: string;
  /** literal subtitle; defaults to the translated node subtitle */
  subtitle?: string;
  /** translated label key for pools */
  poolLabel?: "web" | "api" | "worker" | "webK8s" | "apiK8s" | "workerK8s";
  health?: HealthKey;
  external?: boolean;
  /** replica name matched against /health → instance */
  replica?: string;
};

export type MapEdge = { from: string; to: string; kind: EdgeKind; label?: "api" | "ssr" | "publish" | "consume" | "verify" | "sms" | "scrape" };

export const CANVAS = { w: 1200, h: 650 };

const N = (n: MapNode) => n;

const shared = {
  // map cards carry short literal subtitles; the side panel shows the full translated ones
  internet: N({ id: "internet", info: "internet", x: 4, y: 252, w: 200, h: 116, icon: Global, subtitle: "ekabuild.uz" }),
  redis: N({ id: "redis", info: "redis", x: 736, y: 250, w: 192, h: 62, icon: Flash, health: "redis", subtitle: "cache · pub/sub" }),
  mysql: N({ id: "mysql", info: "mysql", x: 736, y: 330, w: 192, h: 62, icon: Data, health: "db", subtitle: "Prisma · InnoDB" }),
  rabbitmq: N({ id: "rabbitmq", info: "rabbitmq", x: 736, y: 410, w: 192, h: 62, icon: Layer, health: "rabbitmq", subtitle: "eka.events · DLQ" }),
  storage: N({ id: "storage", info: "storage", x: 736, y: 490, w: 192, h: 62, icon: Box, subtitle: "volume · S3" }),
  eimzo: N({ id: "eimzo", info: "eimzo", x: 736, y: 570, w: 192, h: 62, icon: FingerScan, external: true, title: "E-IMZO", subtitle: "PKCS#7 verify" }),
  sms: N({ id: "sms", info: "sms", x: 994, y: 250, w: 176, h: 62, icon: Sms, external: true, title: "Eskiz.uz", subtitle: "OTP · SMS" }),
};

export const VIEWS: Record<ViewKey, { nodes: MapNode[]; edges: MapEdge[] }> = {
  compose: {
    nodes: [
      shared.internet,
      N({ id: "nginx", info: "nginx", x: 236, y: 236, w: 178, h: 148, icon: Routing2, health: "edge", subtitle: "LB · :443" }),
      N({ id: "webPool", info: "web", kind: "pool", poolLabel: "web", x: 462, y: 34, w: 204, h: 196 }),
      N({ id: "web1", info: "web", x: 474, y: 76, w: 178, h: 62, icon: Monitor, title: "web-1", subtitle: "Next.js :3000", health: "web", replica: "web-1" }),
      N({ id: "web2", info: "web", x: 474, y: 150, w: 178, h: 62, icon: Monitor, title: "web-2", subtitle: "Next.js :3000", health: "web", replica: "web-2" }),
      N({ id: "apiPool", info: "api", kind: "pool", poolLabel: "api", x: 462, y: 330, w: 204, h: 196 }),
      N({ id: "api1", info: "api", x: 474, y: 372, w: 178, h: 62, icon: Code1, title: "api-1", subtitle: "Fastify :4000", health: "api", replica: "api-1" }),
      N({ id: "api2", info: "api", x: 474, y: 446, w: 178, h: 62, icon: Code1, title: "api-2", subtitle: "Fastify :4000", health: "api", replica: "api-2" }),
      shared.redis,
      shared.mysql,
      shared.rabbitmq,
      shared.storage,
      shared.eimzo,
      shared.sms,
      N({ id: "workerPool", info: "worker", kind: "pool", poolLabel: "worker", x: 976, y: 352, w: 210, h: 196 }),
      N({ id: "worker1", info: "worker", x: 994, y: 394, w: 176, h: 62, icon: Cpu, title: "worker-1", subtitle: "eka.* consumer" }),
      N({ id: "worker2", info: "worker", x: 994, y: 468, w: 176, h: 62, icon: Cpu, title: "worker-2", subtitle: "eka.* consumer" }),
    ],
    edges: [
      { from: "internet", to: "nginx", kind: "http" },
      { from: "nginx", to: "webPool", kind: "http" },
      { from: "nginx", to: "apiPool", kind: "http", label: "api" },
      { from: "webPool", to: "apiPool", kind: "http", label: "ssr" },
      { from: "apiPool", to: "redis", kind: "data" },
      { from: "apiPool", to: "mysql", kind: "data" },
      { from: "apiPool", to: "rabbitmq", kind: "event", label: "publish" },
      { from: "apiPool", to: "storage", kind: "data" },
      { from: "apiPool", to: "eimzo", kind: "external", label: "verify" },
      { from: "rabbitmq", to: "workerPool", kind: "event", label: "consume" },
      { from: "workerPool", to: "mysql", kind: "data" },
      { from: "workerPool", to: "sms", kind: "external", label: "sms" },
    ],
  },
  k8s: {
    nodes: [
      shared.internet,
      N({ id: "ingress", info: "ingress", x: 236, y: 236, w: 178, h: 148, icon: Routing2, health: "edge", subtitle: "ingress-nginx" }),
      N({ id: "webPool", info: "web", kind: "pool", poolLabel: "webK8s", x: 462, y: 34, w: 204, h: 196 }),
      N({ id: "web1", info: "web", x: 474, y: 76, w: 178, h: 62, icon: Monitor, title: "web-q4x", subtitle: "Pod · Ready", health: "web" }),
      N({ id: "web2", info: "web", x: 474, y: 150, w: 178, h: 62, icon: Monitor, title: "web-m2z", subtitle: "Pod · Ready", health: "web" }),
      N({ id: "hpaWeb", info: "hpa", kind: "chip", x: 590, y: 22, w: 88, h: 26, title: "HPA 2–8", icon: TrendUp }),
      N({ id: "apiPool", info: "api", kind: "pool", poolLabel: "apiK8s", x: 462, y: 330, w: 204, h: 196 }),
      N({ id: "api1", info: "api", x: 474, y: 372, w: 178, h: 62, icon: Code1, title: "api-h7k", subtitle: "Pod · Ready", health: "api" }),
      N({ id: "api2", info: "api", x: 474, y: 446, w: 178, h: 62, icon: Code1, title: "api-r9d", subtitle: "Pod · Ready", health: "api" }),
      N({ id: "hpaApi", info: "hpa", kind: "chip", x: 584, y: 318, w: 94, h: 26, title: "HPA 2–10", icon: TrendUp }),
      N({ id: "pdb", info: "pdb", kind: "chip", x: 472, y: 513, w: 92, h: 26, title: "PDB ≥ 1", icon: ShieldTick }),
      N({ ...shared.redis, subtitle: "StatefulSet" }),
      N({ ...shared.mysql, subtitle: "StatefulSet" }),
      N({ ...shared.rabbitmq, subtitle: "StatefulSet" }),
      N({ ...shared.storage, subtitle: "PVC RWX · S3" }),
      shared.eimzo,
      shared.sms,
      N({ id: "monitoring", info: "monitoring", x: 736, y: 70, w: 192, h: 120, icon: Chart2, subtitle: "ns: monitoring" }),
      N({ id: "workerPool", info: "worker", kind: "pool", poolLabel: "workerK8s", x: 976, y: 352, w: 210, h: 196 }),
      N({ id: "worker1", info: "worker", x: 994, y: 394, w: 176, h: 62, icon: Cpu, title: "worker-t2p", subtitle: "Pod · Ready" }),
      N({ id: "worker2", info: "worker", x: 994, y: 468, w: 176, h: 62, icon: Cpu, title: "worker-v8n", subtitle: "Pod · Ready" }),
      N({ id: "keda", info: "keda", kind: "chip", x: 1080, y: 340, w: 112, h: 26, title: "KEDA 2→12", icon: Repeat }),
    ],
    edges: [
      { from: "internet", to: "ingress", kind: "http" },
      { from: "ingress", to: "webPool", kind: "http" },
      { from: "ingress", to: "apiPool", kind: "http", label: "api" },
      { from: "webPool", to: "apiPool", kind: "http", label: "ssr" },
      { from: "apiPool", to: "redis", kind: "data" },
      { from: "apiPool", to: "mysql", kind: "data" },
      { from: "apiPool", to: "rabbitmq", kind: "event", label: "publish" },
      { from: "apiPool", to: "storage", kind: "data" },
      { from: "apiPool", to: "eimzo", kind: "external", label: "verify" },
      { from: "rabbitmq", to: "workerPool", kind: "event", label: "consume" },
      { from: "workerPool", to: "mysql", kind: "data" },
      { from: "workerPool", to: "sms", kind: "external", label: "sms" },
      { from: "monitoring", to: "apiPool", kind: "metrics", label: "scrape" },
      { from: "monitoring", to: "workerPool", kind: "metrics" },
    ],
  },
};

/** Non-translatable technical facts shown as chips in the side panel. */
export const FACTS: Record<InfoKey, string[]> = {
  internet: ["ekabuild.uz", "app.ekabuild.uz", "admin.ekabuild.uz", "api.ekabuild.uz"],
  nginx: ["TLS · Let's Encrypt", "HTTP/2", "gzip", "least_conn", "max_fails=3", "proxy_next_upstream", "WebSocket", "x-served-by"],
  web: ["Next.js 15", "React 19", "RSC", ":3000", "rolling deploy"],
  api: ["Fastify 5", "Prisma 6", "Zod", ":4000", "/health", "/metrics"],
  mysql: ["MySQL 8.4", "InnoDB", "UNIQUE activeUnitLock", "backup.sh 03:30"],
  redis: ["rate-limit store", "cache 60 s", "pub/sub eka:support", "trust:debounce"],
  rabbitmq: ["eka.events (topic)", "eka.notifications", "eka.sms", "eka.trust", "eka.cadastre", "eka.audit", "*.retry", "*.dlq"],
  worker: ["prefetch 10", "exponential retry", "DLQ", "/metrics"],
  storage: ["SHA-256", "WebP ?w=320…2400", "STORAGE_DRIVER=s3"],
  eimzo: ["PKCS#7 attached", "timeout 15 s", "PINFL / TIN"],
  sms: ["Eskiz.uz", "OTP TTL 120 s", "retry → DLQ"],
  ingress: ["ingress-nginx", "cert-manager", "Let's Encrypt", "preStop 5 s"],
  hpa: ["CPU 65%", "RAM 80%", "web 2–8", "api 2–10", "worker 2–6"],
  keda: ["ScaledObject", "rabbitmq queueLength", "2 → 12"],
  pdb: ["minAvailable: 1", "maxUnavailable: 0", "topologySpread"],
  monitoring: ["Prometheus", "Alertmanager → Telegram", "Grafana", "Loki", "Alloy"],
};

/* ───────────────────────────── Sequence flows ───────────────────────────── */

export type ActorKey =
  | "buyer"
  | "api"
  | "mysql"
  | "redis"
  | "rabbitmq"
  | "worker"
  | "plugin"
  | "eimzo"
  | "phone"
  | "web"
  | "user"
  | "eskiz"
  | "inspector"
  | "api1"
  | "api2"
  | "agent";

export const ACTOR_ICONS: Record<ActorKey, IconType> = {
  buyer: Profile2User,
  api: Code1,
  mysql: Data,
  redis: Flash,
  rabbitmq: Layer,
  worker: Cpu,
  plugin: FingerScan,
  eimzo: ShieldTick,
  phone: Mobile,
  web: Monitor,
  user: People,
  eskiz: Sms,
  inspector: UserTick,
  api1: Driver,
  api2: Driver,
  agent: Messages2,
};

export type FlowKey = "purchase" | "eimzo" | "verify" | "otp" | "trust" | "chat";
/** [from, to, variant] — "async" = queued message, "error" = rejection path */
export type FlowStep = [ActorKey, ActorKey, ("async" | "error")?];

export const FLOWS: Record<FlowKey, { icon: IconType; actors: ActorKey[]; steps: FlowStep[] }> = {
  purchase: {
    icon: DocumentText,
    actors: ["buyer", "api", "mysql", "rabbitmq", "worker"],
    steps: [
      ["buyer", "api"],
      ["api", "mysql"],
      ["api", "mysql"],
      ["mysql", "api", "error"],
      ["api", "mysql"],
      ["api", "rabbitmq", "async"],
      ["rabbitmq", "worker", "async"],
      ["api", "buyer"],
    ],
  },
  eimzo: {
    icon: FingerScan,
    actors: ["buyer", "plugin", "api", "eimzo", "mysql"],
    steps: [
      ["buyer", "api"],
      ["buyer", "plugin"],
      ["plugin", "buyer"],
      ["buyer", "api"],
      ["api", "eimzo"],
      ["eimzo", "api"],
      ["api", "mysql"],
    ],
  },
  verify: {
    icon: ShieldTick,
    actors: ["phone", "web", "api", "redis", "mysql"],
    steps: [
      ["phone", "web"],
      ["web", "api"],
      ["api", "redis"],
      ["api", "mysql"],
      ["api", "mysql", "async"],
      ["web", "phone"],
      ["phone", "api"],
    ],
  },
  otp: {
    icon: Sms,
    actors: ["user", "api", "mysql", "rabbitmq", "worker", "eskiz"],
    steps: [
      ["user", "api"],
      ["api", "mysql"],
      ["api", "mysql"],
      ["api", "rabbitmq", "async"],
      ["rabbitmq", "worker", "async"],
      ["worker", "eskiz"],
      ["user", "api"],
    ],
  },
  trust: {
    icon: TrendUp,
    actors: ["inspector", "api", "rabbitmq", "worker", "redis", "mysql", "buyer"],
    steps: [
      ["inspector", "api"],
      ["api", "mysql"],
      ["api", "rabbitmq", "async"],
      ["rabbitmq", "worker", "async"],
      ["worker", "redis"],
      ["worker", "mysql"],
      ["buyer", "api"],
    ],
  },
  chat: {
    icon: Messages2,
    actors: ["user", "api1", "mysql", "redis", "api2", "agent"],
    steps: [
      ["user", "api1"],
      ["user", "api1"],
      ["api1", "mysql"],
      ["api1", "redis", "async"],
      ["redis", "api2", "async"],
      ["api2", "agent"],
      ["agent", "api2"],
    ],
  },
};

export const FLOW_KEYS = Object.keys(FLOWS) as FlowKey[];
