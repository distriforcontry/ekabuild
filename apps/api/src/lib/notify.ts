import type { NotificationType } from "@prisma/client";
import { prisma } from "../db";
import { publish } from "./bus";

/** Store an in-app notification and emit an event (the worker may fan it out to SMS / email). */
export async function notify(userId: string, n: { type?: NotificationType; title: string; body?: string; link?: string; sms?: boolean }) {
  const row = await prisma.notification.create({
    data: { userId, type: n.type ?? "INFO", title: n.title, body: n.body, link: n.link },
  });
  void publish("notification.created", { notificationId: row.id, userId, sms: n.sms ?? false });
  return row;
}

export async function notifyOrgMembers(organizationId: string, n: Parameters<typeof notify>[1]) {
  const members = await prisma.user.findMany({ where: { organizationId }, select: { id: true } });
  await Promise.all(members.map((m) => notify(m.id, n)));
}
