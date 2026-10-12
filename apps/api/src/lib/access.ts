import type { AccessLevel } from "@prisma/client";
import { prisma } from "../db";
import type { AuthUser } from "../plugins/auth";
import { isStaffRole } from "../plugins/auth";

export type ProjectAccess = { isOwner: boolean; isStaff: boolean; hasPurchase: boolean };

/** What the current viewer may see for a project. */
export async function projectAccess(user: AuthUser | null, project: { id: string; developerId: string }): Promise<ProjectAccess> {
  if (!user) return { isOwner: false, isStaff: false, hasPurchase: false };
  const isOwner = !!user.orgId && user.orgId === project.developerId;
  const isStaff = isStaffRole(user.role);
  const hasPurchase =
    (await prisma.purchase.count({
      where: { projectId: project.id, status: { in: ["PAID", "COMPLETED"] }, OR: [{ buyerId: user.id }, ...(user.orgId ? [{ buyerOrgId: user.orgId }] : [])] },
    })) > 0;
  return { isOwner, isStaff, hasPurchase };
}

export function canSee(level: AccessLevel, a: ProjectAccess) {
  if (level === "PUBLIC") return true;
  if (a.isOwner || a.isStaff) return true;
  return level === "BUYERS" && a.hasPurchase;
}
