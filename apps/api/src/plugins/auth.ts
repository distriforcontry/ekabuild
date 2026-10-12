import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@prisma/client";
import { ACCESS_COOKIE, verifyAccessToken } from "../lib/auth";
import { forbidden, unauthorized } from "../lib/errors";

export type AuthUser = { id: string; role: Role; orgId: string | null };

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser | null;
  }
}

/** Resolves the session (cookie or Bearer) into request.user — never rejects by itself. */
export default fp(async (app) => {
  app.decorateRequest("user", null);
  app.addHook("onRequest", async (req) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : req.cookies?.[ACCESS_COOKIE];
    if (!token) return;
    const claims = await verifyAccessToken(token);
    if (claims) req.user = { id: claims.sub, role: claims.role, orgId: claims.org ?? null };
  });
});

export function requireUser(req: FastifyRequest): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

export function requireRole(req: FastifyRequest, ...roles: Role[]): AuthUser {
  const u = requireUser(req);
  if (u.role === "SUPERADMIN") return u;
  if (!roles.includes(u.role)) throw forbidden();
  return u;
}

export const isAdminRole = (r?: Role | null) => r === "ADMIN" || r === "SUPERADMIN";
export const isStaffRole = (r?: Role | null) => isAdminRole(r) || r === "INSPECTOR";

/** preHandler factories for route options */
export const authed = async (req: FastifyRequest, _reply: FastifyReply) => void requireUser(req);
export const roles =
  (...r: Role[]) =>
  async (req: FastifyRequest, _reply: FastifyReply) =>
    void requireRole(req, ...r);
