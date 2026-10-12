import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { publish } from "./bus";
import { cadastreProvider, evaluateCadastre } from "./cadastre";
import { badRequest, notFound } from "./errors";
import { notifyOrgMembers } from "./notify";

/** Runs a cadastre check and stores the result (also used by the worker). */
export async function runCadastreCheck(projectId: string, checkedById: string | null) {
  const p = await prisma.project.findUnique({ where: { id: projectId }, include: { developer: { select: { name: true, legalName: true } } } });
  if (!p) throw notFound("Obyekt topilmadi");
  if (!p.cadastreNumber) throw badRequest("Obyektda kadastr raqami ko'rsatilmagan", "NO_CADASTRE");
  const developerName = p.developer.legalName ?? p.developer.name;
  const rec = await cadastreProvider.lookup(p.cadastreNumber, { lat: p.lat, lng: p.lng, address: p.address, landArea: p.landArea, developerName });
  const ev = evaluateCadastre(rec, { lat: p.lat, lng: p.lng, landArea: p.landArea, developerName });
  const check = await prisma.cadastreCheck.create({
    data: {
      projectId: p.id,
      cadastreNumber: p.cadastreNumber,
      provider: cadastreProvider.name,
      result: ev.result,
      distanceM: ev.distanceM,
      checkedById,
      details: {
        registryAddress: rec.address,
        registryArea: rec.area,
        registryLat: rec.lat,
        registryLng: rec.lng,
        owner: rec.owner,
        purpose: rec.purpose,
        messages: ev.messages,
      } as Prisma.InputJsonValue,
    },
  });
  void publish("cadastre.checked", { projectId: p.id, result: ev.result });
  if (ev.result === "MISMATCH" || ev.result === "NOT_FOUND") {
    void notifyOrgMembers(p.developerId, {
      type: "DANGER",
      title: "Kadastr tekshiruvida nomuvofiqlik",
      body: `${p.name}: ${ev.messages.join("; ")}`,
      link: `/app/developer/projects/${p.id}`,
    });
  }
  return check;
}

