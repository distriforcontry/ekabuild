import type { Role } from "@eka/shared";

/** Where each role lands after login */
export function homeForRole(role: Role): string {
  switch (role) {
    case "ADMIN":
    case "SUPERADMIN":
      return "/admin";
    case "DEVELOPER":
      return "/app/developer";
    case "INSPECTOR":
      return "/app/inspector";
    default:
      return "/app";
  }
}

export const isAdmin = (role?: Role | null) => role === "ADMIN" || role === "SUPERADMIN";
export const isStaff = (role?: Role | null) => isAdmin(role) || role === "INSPECTOR";
