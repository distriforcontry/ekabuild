import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { sha256 } from "./auth";
import { publish } from "./bus";

const GENESIS = "0".repeat(64);

type AuditInput = {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: unknown;
  ip?: string | null;
};

/** Key-sorted JSON so the hash survives MySQL's JSON normalisation (which reorders keys). */
function canonical(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

function digest(prevHash: string, a: AuditInput, createdAt: Date) {
  return sha256(
    canonical([prevHash, a.actorId ?? null, a.action, a.entity, a.entityId ?? null, a.meta ?? null, a.ip ?? null, createdAt.toISOString()]),
  );
}

/**
 * Append to the tamper-evident audit log. Each row stores sha256(prevHash + content); the chain is serialised
 * across API replicas with a MySQL named lock inside one transaction/connection.
 */
export async function audit(input: AuditInput): Promise<void> {
  // normalise meta exactly as it will be read back from the JSON column
  const a: AuditInput = { ...input, meta: input.meta === undefined || input.meta === null ? null : JSON.parse(JSON.stringify(input.meta)) };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT GET_LOCK('eka_audit', 5)`;
      try {
        const last = await tx.auditLog.findFirst({ orderBy: { id: "desc" }, select: { hash: true } });
        const prevHash = last?.hash ?? GENESIS;
        const createdAt = new Date();
        createdAt.setMilliseconds(0); // MySQL DATETIME(3) keeps ms, but normalise for portability
        const hash = digest(prevHash, a, createdAt);
        await tx.auditLog.create({
          data: {
            actorId: a.actorId ?? null,
            action: a.action,
            entity: a.entity,
            entityId: a.entityId ?? null,
            meta: a.meta === null ? Prisma.DbNull : (a.meta as Prisma.InputJsonValue),
            ip: a.ip ?? null,
            prevHash,
            hash,
            createdAt,
          },
        });
      } finally {
        await tx.$queryRaw`SELECT RELEASE_LOCK('eka_audit')`;
      }
    });
    void publish(`audit.${a.entity.toLowerCase()}.${a.action.toLowerCase()}`, a);
  } catch (e) {
    console.error("[audit] failed", e);
  }
}

/** Re-computes the whole chain; returns the first broken row id, if any. */
export async function verifyAuditChain(): Promise<{ ok: boolean; checked: number; brokenAt: string | null }> {
  let prev = GENESIS;
  let checked = 0;
  let cursor: bigint | undefined;
  for (;;) {
    const rows = await prisma.auditLog.findMany({
      take: 1000,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
    });
    if (!rows.length) break;
    for (const r of rows) {
      const expected = digest(prev, { actorId: r.actorId, action: r.action, entity: r.entity, entityId: r.entityId, meta: r.meta ?? null, ip: r.ip }, r.createdAt);
      if (r.prevHash !== prev || r.hash !== expected) return { ok: false, checked, brokenAt: r.id.toString() };
      prev = r.hash;
      checked++;
    }
    cursor = rows[rows.length - 1]!.id;
  }
  return { ok: true, checked, brokenAt: null };
}
