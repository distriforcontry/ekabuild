import type { Prisma } from "@prisma/client";
import type { TrustBreakdownItem } from "@eka/shared";
import { prisma } from "../db";

/**
 * Trust score (0–100) — transparent, explainable, recalculated by the worker on every relevant event.
 *
 *   Developer verified ............ 15
 *   Building permit (valid) ....... 20
 *   State expertise ............... 10
 *   Other certificates ............ 10  (license, conformity, fire, ecology…)
 *   Cadastre match ................ 15  (partial = 7)
 *   Inspections ................... 15  (passed = full, issues = partial, failed = 0)
 *   Verified documents ............  5
 *   Schedule ...................... 10  (−2 per month of delay)
 *   Complaints .................... −0…−15 (open fraud / double-sale complaints weigh most)
 */
export async function computeTrust(projectId: string): Promise<{ score: number; breakdown: TrustBreakdownItem[] }> {
  const p = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      developer: { select: { status: true } },
      certificates: true,
      documents: { select: { status: true } },
      cadastreChecks: { orderBy: { createdAt: "desc" }, take: 1 },
      inspections: { orderBy: { date: "desc" }, take: 5 },
      complaints: { where: { status: { in: ["OPEN", "IN_REVIEW", "RESOLVED"] } }, select: { category: true, status: true } },
    },
  });
  const now = new Date();
  const valid = (c: (typeof p.certificates)[number]) => c.status === "VERIFIED" && (!c.validUntil || c.validUntil > now);
  const items: TrustBreakdownItem[] = [];

  items.push({
    key: "developer",
    label: "Quruvchi tasdiqlangan",
    score: p.developer.status === "VERIFIED" ? 15 : 0,
    max: 15,
    note: p.developer.status === "VERIFIED" ? "STIR va litsenziya tekshirilgan" : "Quruvchi hali tasdiqlanmagan",
  });

  const permit = p.certificates.find((c) => c.type === "BUILDING_PERMIT" && valid(c));
  items.push({ key: "permit", label: "Qurilish ruxsatnomasi", score: permit ? 20 : 0, max: 20, note: permit ? `№ ${permit.number}` : "Tasdiqlangan ruxsatnoma yo'q" });

  const expertise = p.certificates.find((c) => c.type === "STATE_EXPERTISE" && valid(c));
  items.push({ key: "expertise", label: "Davlat ekspertizasi", score: expertise ? 10 : 0, max: 10, note: expertise ? `№ ${expertise.number}` : "Xulosa yo'q" });

  const others = p.certificates.filter((c) => !["BUILDING_PERMIT", "STATE_EXPERTISE"].includes(c.type) && valid(c)).length;
  items.push({ key: "certificates", label: "Boshqa sertifikatlar", score: Math.min(10, others * 4), max: 10, note: `${others} ta amaldagi sertifikat` });

  const cad = p.cadastreChecks[0];
  const cadScore = cad?.result === "MATCH" ? 15 : cad?.result === "PARTIAL" ? 7 : 0;
  items.push({ key: "cadastre", label: "Kadastr mosligi", score: cadScore, max: 15, note: cad ? `Natija: ${cad.result}` : "Kadastr tekshiruvi o'tkazilmagan" });

  let insScore = 0;
  if (p.inspections.length) {
    const weights = { PASSED: 1, ISSUES: 0.5, FAILED: 0 } as const;
    const avg = p.inspections.reduce((s, i) => s + weights[i.result], 0) / p.inspections.length;
    const latestFailed = p.inspections[0]!.result === "FAILED";
    insScore = latestFailed ? 0 : Math.round(15 * avg);
  }
  items.push({ key: "inspections", label: "Nazorat tekshiruvlari", score: insScore, max: 15, note: `${p.inspections.length} ta tekshiruv` });

  const docsVerified = p.documents.filter((d) => d.status === "VERIFIED").length;
  const docScore = p.documents.length ? Math.round((5 * docsVerified) / p.documents.length) : 0;
  items.push({ key: "documents", label: "Tasdiqlangan hujjatlar", score: docScore, max: 5, note: `${docsVerified}/${p.documents.length}` });

  let schedule = 10;
  let scheduleNote = "Muddat buzilmagan";
  if (p.plannedEndDate) {
    const end = p.actualEndDate ?? (["COMPLETED", "COMMISSIONED"].includes(p.status) ? p.plannedEndDate : now);
    const months = Math.floor((end.getTime() - p.plannedEndDate.getTime()) / (30 * 86400_000));
    if (months > 0) {
      schedule = Math.max(0, 10 - months * 2);
      scheduleNote = `${months} oy kechikish`;
    }
  }
  if (p.status === "SUSPENDED") {
    schedule = 0;
    scheduleNote = "Qurilish to'xtatilgan";
  }
  items.push({ key: "schedule", label: "Muddatga rioya", score: schedule, max: 10, note: scheduleNote });

  const heavy = p.complaints.filter((c) => ["FRAUD", "DOUBLE_SALE", "FAKE_DOCUMENT"].includes(c.category) && c.status !== "RESOLVED").length;
  const light = p.complaints.length - heavy;
  const penalty = Math.min(15, heavy * 8 + light * 2);
  items.push({ key: "complaints", label: "Shikoyatlar", score: -penalty, max: 0, note: penalty ? `${p.complaints.length} ta shikoyat` : "Shikoyat yo'q" });

  const score = Math.max(0, Math.min(100, items.reduce((s, i) => s + i.score, 0)));
  return { score, breakdown: items };
}

export async function recalculateTrust(projectId: string) {
  const { score, breakdown } = await computeTrust(projectId);
  await prisma.project.update({
    where: { id: projectId },
    data: { trustScore: score, trustBreakdown: breakdown as unknown as Prisma.InputJsonValue },
  });
  return { trustScore: score, trustBreakdown: breakdown };
}
