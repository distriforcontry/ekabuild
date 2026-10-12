import type { Prisma } from "@prisma/client";
import { prisma } from "../db";

export type ActivityType = "project_view" | "certificate_lookup" | "file_check" | "favorite" | "search" | "model_open";

/** Fire-and-forget product analytics event (never blocks or fails a request). */
export function track(type: ActivityType, e: { projectId?: string | null; userId?: string | null; sessionId?: string | null; meta?: unknown } = {}) {
  void prisma.activityEvent
    .create({
      data: {
        type,
        projectId: e.projectId ?? null,
        userId: e.userId ?? null,
        sessionId: e.sessionId ?? null,
        meta: (e.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    })
    .catch(() => {});
}
