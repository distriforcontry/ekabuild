import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { cached } from "../lib/redis";
import { requireRole } from "../plugins/auth";

// Admin analytics (docs/API.md → "Analytics"). Days/hours are bucketed in Tashkent time (UTC+5).
const TZ = "+05:00";
const num = (v: unknown) => (typeof v === "bigint" ? Number(v) : v == null ? 0 : Number(v));

async function totals(from: Date, to: Date) {
  const inRange = { gte: from, lt: to };
  const [views, lookups, fileChecks, registrations, logins, purchases, signed, paid, complaints, supportThreads, favorites] = await Promise.all([
    prisma.activityEvent.count({ where: { type: "project_view", createdAt: inRange } }),
    prisma.activityEvent.count({ where: { type: "certificate_lookup", createdAt: inRange } }),
    prisma.activityEvent.count({ where: { type: "file_check", createdAt: inRange } }),
    prisma.user.count({ where: { createdAt: inRange } }),
    // unique signed-in users (a session row is created on every login and on refresh rotation)
    prisma.session.groupBy({ by: ["userId"], where: { createdAt: inRange } }).then((g) => g.length),
    prisma.purchase.count({ where: { createdAt: inRange } }),
    prisma.contract.count({ where: { signedAt: inRange } }),
    prisma.purchase.aggregate({ where: { paidAt: inRange }, _count: true, _sum: { amount: true } }),
    prisma.complaint.count({ where: { createdAt: inRange } }),
    prisma.supportThread.count({ where: { createdAt: inRange } }),
    prisma.activityEvent.count({ where: { type: "favorite", createdAt: inRange } }),
  ]);
  return {
    views,
    certificateLookups: lookups,
    fileChecks,
    registrations,
    logins,
    purchases,
    signed,
    paid: paid._count,
    revenue: (paid._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
    complaints,
    supportThreads,
    favorites,
  };
}

export default async function analyticsRoutes(app: FastifyInstance) {
  app.get("/admin/analytics", async (req) => {
    requireRole(req, "ADMIN");
    const { days } = z.object({ days: z.coerce.number().refine((d) => [7, 30, 90, 365].includes(d)).default(30) }).parse(req.query);
    return cached(`analytics:${days}`, 60, async () => {
      const to = new Date();
      const from = new Date(to.getTime() - days * 86400_000);
      const prevFrom = new Date(from.getTime() - days * 86400_000);

      const [cur, prev, avgTrust] = await Promise.all([
        totals(from, to),
        totals(prevFrom, from),
        prisma.project.aggregate({ where: { published: true }, _avg: { trustScore: true } }),
      ]);

      // ── daily series
      const dailyRows = await prisma.$queryRaw<{ d: string; kind: string; c: bigint; amount: string | null }[]>`
        SELECT DATE_FORMAT(CONVERT_TZ(createdAt, '+00:00', ${TZ}), '%Y-%m-%d') AS d, type AS kind, COUNT(*) AS c, NULL AS amount
          FROM ActivityEvent WHERE createdAt >= ${from} AND createdAt < ${to} AND type IN ('project_view', 'certificate_lookup')
          GROUP BY d, kind
        UNION ALL
        SELECT DATE_FORMAT(CONVERT_TZ(createdAt, '+00:00', ${TZ}), '%Y-%m-%d'), 'registration', COUNT(*), NULL
          FROM User WHERE createdAt >= ${from} AND createdAt < ${to} GROUP BY 1
        UNION ALL
        SELECT DATE_FORMAT(CONVERT_TZ(createdAt, '+00:00', ${TZ}), '%Y-%m-%d'), 'purchase', COUNT(*), NULL
          FROM Purchase WHERE createdAt >= ${from} AND createdAt < ${to} GROUP BY 1
        UNION ALL
        SELECT DATE_FORMAT(CONVERT_TZ(paidAt, '+00:00', ${TZ}), '%Y-%m-%d'), 'paid', COUNT(*), SUM(amount)
          FROM Purchase WHERE paidAt >= ${from} AND paidAt < ${to} GROUP BY 1`;
      const byDay = new Map<string, { date: string; views: number; registrations: number; purchases: number; paid: number; revenue: number; lookups: number }>();
      for (let t = from.getTime(); t < to.getTime() + 86400_000; t += 86400_000) {
        const d = new Date(t + 5 * 3600_000).toISOString().slice(0, 10);
        if (!byDay.has(d)) byDay.set(d, { date: d, views: 0, registrations: 0, purchases: 0, paid: 0, revenue: 0, lookups: 0 });
      }
      for (const r of dailyRows) {
        const row = byDay.get(r.d);
        if (!row) continue;
        const c = num(r.c);
        if (r.kind === "project_view") row.views += c;
        else if (r.kind === "certificate_lookup") row.lookups += c;
        else if (r.kind === "registration") row.registrations += c;
        else if (r.kind === "purchase") row.purchases += c;
        else if (r.kind === "paid") {
          row.paid += c;
          row.revenue += num(r.amount);
        }
      }
      const daily = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-days);

      // ── hourly activity (Tashkent)
      const hourlyRows = await prisma.$queryRaw<{ h: number; kind: string; c: bigint }[]>`
        SELECT HOUR(CONVERT_TZ(createdAt, '+00:00', ${TZ})) AS h, 'views' AS kind, COUNT(*) AS c
          FROM ActivityEvent WHERE type = 'project_view' AND createdAt >= ${from} AND createdAt < ${to} GROUP BY h
        UNION ALL
        SELECT HOUR(CONVERT_TZ(createdAt, '+00:00', ${TZ})), 'purchases', COUNT(*)
          FROM Purchase WHERE createdAt >= ${from} AND createdAt < ${to} GROUP BY 1`;
      const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, views: 0, purchases: 0 }));
      for (const r of hourlyRows) hourly[num(r.h)]![r.kind as "views" | "purchases"] += num(r.c);

      // ── structural breakdowns (all-time, published projects)
      const projects = await prisma.project.findMany({
        where: { published: true },
        select: {
          id: true,
          slug: true,
          name: true,
          region: true,
          trustScore: true,
          unitsTotal: true,
          pricePerSqm: true,
          coverUrl: true,
          developer: { select: { id: true, name: true } },
          _count: { select: { complaints: true } },
        },
      });
      const unitGroups = await prisma.unit.groupBy({ by: ["projectId", "status"], _count: true });
      const revenueGroups = await prisma.purchase.groupBy({ by: ["projectId"], where: { status: { in: ["PAID", "COMPLETED"] } }, _sum: { amount: true } });
      const viewGroups = await prisma.activityEvent.groupBy({ by: ["projectId"], where: { type: "project_view", createdAt: { gte: from, lt: to } }, _count: true });
      const purchaseGroups = await prisma.purchase.groupBy({ by: ["projectId"], where: { createdAt: { gte: from, lt: to } }, _count: true });
      const units = new Map<string, { SOLD: number; RESERVED: number; AVAILABLE: number }>();
      for (const g of unitGroups) {
        const u = units.get(g.projectId) ?? { SOLD: 0, RESERVED: 0, AVAILABLE: 0 };
        u[g.status] = g._count;
        units.set(g.projectId, u);
      }
      const revenue = new Map(revenueGroups.map((g) => [g.projectId, Number(g._sum.amount ?? 0)]));
      const views = new Map(viewGroups.map((g) => [g.projectId, g._count]));
      const purch = new Map(purchaseGroups.map((g) => [g.projectId, g._count]));

      const regionMap = new Map<string, { region: string; projects: number; sold: number; available: number; revenue: number; trust: number[]; ppsqm: number[] }>();
      const devMap = new Map<string, { id: string; name: string; projects: number; sold: number; revenue: number; trust: number[]; complaints: number }>();
      for (const p of projects) {
        const u = units.get(p.id) ?? { SOLD: 0, RESERVED: 0, AVAILABLE: 0 };
        const r = regionMap.get(p.region) ?? { region: p.region, projects: 0, sold: 0, available: 0, revenue: 0, trust: [], ppsqm: [] };
        r.projects++;
        r.sold += u.SOLD;
        r.available += u.AVAILABLE;
        r.revenue += revenue.get(p.id) ?? 0;
        r.trust.push(p.trustScore);
        if (p.pricePerSqm) r.ppsqm.push(Number(p.pricePerSqm));
        regionMap.set(p.region, r);
        const d = devMap.get(p.developer.id) ?? { id: p.developer.id, name: p.developer.name, projects: 0, sold: 0, revenue: 0, trust: [], complaints: 0 };
        d.projects++;
        d.sold += u.SOLD;
        d.revenue += revenue.get(p.id) ?? 0;
        d.trust.push(p.trustScore);
        d.complaints += p._count.complaints;
        devMap.set(p.developer.id, d);
      }
      const avg = (a: number[]) => (a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : 0);

      const unitMixRows = await prisma.unit.groupBy({
        by: ["rooms", "status"],
        where: { project: { published: true } },
        _count: true,
        _avg: { area: true, price: true },
      });
      const mix = new Map<number, { rooms: number; sold: number; reserved: number; available: number; area: number[]; price: number[] }>();
      for (const g of unitMixRows) {
        const m = mix.get(g.rooms) ?? { rooms: g.rooms, sold: 0, reserved: 0, available: 0, area: [], price: [] };
        if (g.status === "SOLD") m.sold += g._count;
        if (g.status === "RESERVED") m.reserved += g._count;
        if (g.status === "AVAILABLE") m.available += g._count;
        if (g._avg.area) m.area.push(g._avg.area);
        if (g._avg.price) m.price.push(Number(g._avg.price));
        mix.set(g.rooms, m);
      }

      // ── purchase state flow for deals created in the period
      const flowRows = await prisma.purchase.groupBy({ by: ["status"], where: { createdAt: { gte: from, lt: to } }, _count: true });
      const f = Object.fromEntries(flowRows.map((r) => [r.status, r._count])) as Record<string, number>;
      const signedOrLater = (f.SIGNED ?? 0) + (f.PAID ?? 0) + (f.COMPLETED ?? 0);
      const statusFlow = [
        { from: "created", to: "signed", count: signedOrLater },
        { from: "created", to: "pending", count: (f.PENDING_SIGNATURES ?? 0) + (f.DRAFT ?? 0) },
        { from: "created", to: "cancelled", count: f.CANCELLED ?? 0 },
        { from: "signed", to: "paid", count: (f.PAID ?? 0) + (f.COMPLETED ?? 0) },
        { from: "signed", to: "awaiting_payment", count: f.SIGNED ?? 0 },
        { from: "paid", to: "completed", count: f.COMPLETED ?? 0 },
      ].filter((e) => e.count > 0);

      const [sigGroups, supportClosed, responded] = await Promise.all([
        prisma.signature.groupBy({ by: ["method"], where: { signedAt: { gte: from, lt: to } }, _count: true }),
        prisma.supportThread.count({ where: { createdAt: { gte: from, lt: to }, status: "CLOSED" } }),
        prisma.supportThread.findMany({ where: { createdAt: { gte: from, lt: to }, firstResponseAt: { not: null } }, select: { createdAt: true, firstResponseAt: true } }),
      ]);
      const sig = { EIMZO: 0, MOCK: 0 };
      for (const g of sigGroups) sig[g.method] = g._count;

      return {
        range: { from: from.toISOString(), to: to.toISOString(), days },
        totals: { ...cur, avgTrust: Math.round(avgTrust._avg.trustScore ?? 0) },
        previous: { ...prev, avgTrust: Math.round(avgTrust._avg.trustScore ?? 0) },
        funnel: [
          { step: "views", count: cur.views },
          { step: "favorites", count: cur.favorites },
          { step: "purchases", count: cur.purchases },
          { step: "signed", count: cur.signed },
          { step: "paid", count: cur.paid },
        ],
        daily,
        byRegion: [...regionMap.values()]
          .map(({ trust, ppsqm, ...r }) => ({ ...r, avgTrust: avg(trust), avgPricePerSqm: avg(ppsqm) }))
          .sort((a, b) => b.revenue - a.revenue),
        byDeveloper: [...devMap.values()].map(({ trust, ...d }) => ({ ...d, avgTrust: avg(trust) })).sort((a, b) => b.revenue - a.revenue),
        topProjects: projects
          .map((p) => {
            const v = views.get(p.id) ?? 0;
            const pc = purch.get(p.id) ?? 0;
            return { slug: p.slug, name: p.name, views: v, purchases: pc, conversion: v ? Math.round((pc / v) * 1000) / 10 : 0, trustScore: p.trustScore, coverUrl: p.coverUrl };
          })
          .sort((a, b) => b.views - a.views)
          .slice(0, 10),
        trustVsSales: projects.map((p) => {
          const u = units.get(p.id) ?? { SOLD: 0, RESERVED: 0, AVAILABLE: 0 };
          const total = u.SOLD + u.RESERVED + u.AVAILABLE;
          return { name: p.name, slug: p.slug, trustScore: p.trustScore, soldShare: total ? Math.round((u.SOLD / total) * 1000) / 1000 : 0, units: total };
        }),
        unitMix: [...mix.values()]
          .sort((a, b) => a.rooms - b.rooms)
          .map(({ area, price, ...m }) => ({ ...m, avgArea: Math.round((area.reduce((s, x) => s + x, 0) / Math.max(1, area.length)) * 10) / 10, avgPrice: avg(price) })),
        statusFlow,
        signatures: sig,
        support: {
          threads: cur.supportThreads,
          closed: supportClosed,
          avgFirstResponseMin: responded.length
            ? Math.round((responded.reduce((s, t) => s + Math.max(0, t.firstResponseAt!.getTime() - t.createdAt.getTime()), 0) / responded.length / 60000) * 10) / 10
            : 0,
        },
        hourly,
      };
    });
  });
}
