import crypto from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../db";
import { env } from "../env";
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  hashPassword,
  normalizePhone,
  randomToken,
  setAuthCookies,
  sha256,
  signAccessToken,
  signPhoneToken,
  verifyPassword,
  verifyPhoneToken,
} from "../lib/auth";
import { audit } from "../lib/audit";
import { publish } from "../lib/bus";
import { AppError, badRequest, conflict, forbidden, notFound, tooMany, unauthorized } from "../lib/errors";
import { userDto, userSelect } from "../lib/serializers";
import { requireUser } from "../plugins/auth";
import { businessEvents } from "../lib/metrics";

const OTP_TTL_SEC = 120;
const OTP_RESEND_SEC = 60;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_PER_HOUR = 6;

const phoneSchema = z.string().transform((v, ctx) => {
  const p = normalizePhone(v);
  if (!p) {
    ctx.addIssue({ code: "custom", message: "Telefon raqami noto'g'ri" });
    return z.NEVER;
  }
  return p;
});
const purposeSchema = z.enum(["REGISTER", "LOGIN", "RESET"]);
const passwordSchema = z.string().min(8, "Parol kamida 8 belgidan iborat bo'lishi kerak").max(128);

const otpHash = (phone: string, purpose: string, code: string) => sha256(`${phone}:${purpose}:${code}:${env.JWT_SECRET}`);

/** Issues a new session (access + rotating refresh token). */
export async function startSession(req: FastifyRequest, reply: FastifyReply, userId: string) {
  const user = await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() }, select: userSelect });
  if (user.status === "BLOCKED") throw forbidden("Hisob bloklangan", "BLOCKED");
  const refresh = randomToken(48);
  await prisma.session.create({
    data: {
      userId,
      refreshTokenHash: sha256(refresh),
      userAgent: req.headers["user-agent"]?.slice(0, 500),
      ip: req.ip,
      expiresAt: new Date(Date.now() + env.REFRESH_TTL_DAYS * 86400_000),
    },
  });
  const access = await signAccessToken({ sub: user.id, role: user.role, org: user.organization?.id });
  setAuthCookies(reply, access, refresh);
  return userDto(user);
}

export default async function authRoutes(app: FastifyInstance) {
  // ── OTP: send
  app.post("/auth/otp/send", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (req) => {
    const { phone, purpose } = z.object({ phone: phoneSchema, purpose: purposeSchema }).parse(req.body);

    const existing = await prisma.user.findUnique({ where: { phone }, select: { id: true, status: true } });
    if (purpose === "REGISTER" && existing) throw conflict("Bu raqam allaqachon ro'yxatdan o'tgan", "PHONE_TAKEN");
    if (purpose !== "REGISTER" && !existing) throw notFound("Bu raqam bilan foydalanuvchi topilmadi", "USER_NOT_FOUND");
    if (existing?.status === "BLOCKED") throw forbidden("Hisob bloklangan", "BLOCKED");

    const last = await prisma.phoneOtp.findFirst({ where: { phone, purpose }, orderBy: { createdAt: "desc" } });
    if (last && Date.now() - last.createdAt.getTime() < OTP_RESEND_SEC * 1000) {
      const wait = Math.ceil((OTP_RESEND_SEC * 1000 - (Date.now() - last.createdAt.getTime())) / 1000);
      throw tooMany(`Qayta yuborish uchun ${wait} soniya kuting`, { resendIn: wait });
    }
    const hourly = await prisma.phoneOtp.count({ where: { phone, createdAt: { gt: new Date(Date.now() - 3600_000) } } });
    if (hourly >= OTP_MAX_PER_HOUR) throw tooMany("Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring");

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    await prisma.phoneOtp.create({
      data: { phone, purpose, codeHash: otpHash(phone, purpose, code), expiresAt: new Date(Date.now() + OTP_TTL_SEC * 1000), ip: req.ip },
    });
    const message = `EKA BUILD: tasdiqlash kodi ${code}. Kodni hech kimga bermang. Muddati 2 daqiqa.`;
    await publish("sms.send", { phone, message, kind: "otp" });
    businessEvents.inc({ event: `otp_sent_${purpose.toLowerCase()}` });

    return {
      sent: true,
      expiresIn: OTP_TTL_SEC,
      resendIn: OTP_RESEND_SEC,
      // demo mode only: without a real SMS gateway the code is returned so the flow stays usable
      ...(env.SMS_PROVIDER === "mock" ? { devCode: code } : {}),
    };
  });

  // ── OTP: verify
  app.post("/auth/otp/verify", { config: { rateLimit: { max: 15, timeWindow: "1 minute" } } }, async (req, reply) => {
    const { phone, code, purpose } = z.object({ phone: phoneSchema, code: z.string().regex(/^\d{6}$/), purpose: purposeSchema }).parse(req.body);
    const otp = await prisma.phoneOtp.findFirst({ where: { phone, purpose, consumedAt: null }, orderBy: { createdAt: "desc" } });
    if (!otp) throw badRequest("Kod topilmadi, yangisini so'rang", "INVALID_CODE");
    if (otp.expiresAt < new Date()) throw badRequest("Kod muddati tugagan", "CODE_EXPIRED");
    if (otp.attempts >= OTP_MAX_ATTEMPTS) throw tooMany("Urinishlar soni tugadi, yangi kod so'rang");

    const ok = crypto.timingSafeEqual(Buffer.from(otp.codeHash), Buffer.from(otpHash(phone, purpose, code)));
    if (!ok) {
      await prisma.phoneOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw badRequest("Kod noto'g'ri", "INVALID_CODE", { attemptsLeft: OTP_MAX_ATTEMPTS - otp.attempts - 1 });
    }
    await prisma.phoneOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

    if (purpose === "LOGIN") {
      const user = await prisma.user.findUnique({ where: { phone } });
      if (!user) throw notFound("Foydalanuvchi topilmadi", "USER_NOT_FOUND");
      if (!user.phoneVerifiedAt) await prisma.user.update({ where: { id: user.id }, data: { phoneVerifiedAt: new Date() } });
      const dto = await startSession(req, reply, user.id);
      void audit({ actorId: user.id, action: "LOGIN_OTP", entity: "User", entityId: user.id, ip: req.ip });
      return { user: dto };
    }
    return { verificationToken: await signPhoneToken(phone, purpose) };
  });

  // ── Register (after phone verification)
  app.post("/auth/register", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    const body = z
      .object({
        verificationToken: z.string(),
        fullName: z.string().trim().min(3).max(191),
        password: passwordSchema,
        email: z.string().trim().email().max(191).optional().or(z.literal("").transform(() => undefined)),
        accountType: z.enum(["INDIVIDUAL", "COMPANY", "DEVELOPER"]),
        organization: z
          .object({
            name: z.string().trim().min(2).max(191),
            tin: z.string().regex(/^\d{9}$/, "STIR 9 ta raqamdan iborat"),
            director: z.string().trim().max(191).optional(),
            address: z.string().trim().max(512).optional(),
            region: z.string().trim().max(128).optional(),
          })
          .optional(),
      })
      .parse(req.body);

    const phone = await verifyPhoneToken(body.verificationToken, "REGISTER");
    if (!phone) throw badRequest("Telefon tasdiqlanmagan yoki muddati o'tgan", "PHONE_NOT_VERIFIED");
    if (await prisma.user.findUnique({ where: { phone } })) throw conflict("Bu raqam allaqachon ro'yxatdan o'tgan", "PHONE_TAKEN");
    if (body.email && (await prisma.user.findUnique({ where: { email: body.email } }))) throw conflict("Bu email band", "EMAIL_TAKEN");
    if (body.accountType !== "INDIVIDUAL" && !body.organization) throw badRequest("Tashkilot ma'lumotlari kerak");

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.$transaction(async (tx) => {
      let organizationId: string | undefined;
      if (body.organization && body.accountType !== "INDIVIDUAL") {
        const existingOrg = await tx.organization.findUnique({ where: { tin: body.organization.tin } });
        if (existingOrg) throw conflict("Bu STIR bilan tashkilot allaqachon ro'yxatdan o'tgan", "TIN_TAKEN");
        const org = await tx.organization.create({
          data: { ...body.organization, type: body.accountType === "DEVELOPER" ? "DEVELOPER" : "BUYER_COMPANY", phone },
        });
        organizationId = org.id;
      }
      return tx.user.create({
        data: {
          phone,
          phoneVerifiedAt: new Date(),
          email: body.email,
          fullName: body.fullName,
          passwordHash,
          role: body.accountType === "DEVELOPER" ? "DEVELOPER" : "BUYER",
          organizationId,
        },
      });
    });

    businessEvents.inc({ event: "register" });
    void audit({ actorId: user.id, action: "REGISTER", entity: "User", entityId: user.id, ip: req.ip, meta: { accountType: body.accountType } });
    void publish("notification.welcome", { userId: user.id });
    if (user.organizationId) void publish("project.org.pending", { organizationId: user.organizationId });
    return { user: await startSession(req, reply, user.id) };
  });

  // ── Login with phone (or email) + password
  app.post("/auth/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    const { login, password } = z.object({ login: z.string().trim().min(3), password: z.string().min(1) }).parse(req.body);
    const phone = normalizePhone(login);
    const user = await prisma.user.findFirst({ where: phone ? { phone } : { email: login.toLowerCase() } });
    // constant-ish time to avoid user enumeration
    const ok = user ? await verifyPassword(password, user.passwordHash) : await verifyPassword(password, "$2a$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
    if (!user || !ok) throw unauthorized("Telefon raqam yoki parol noto'g'ri", "INVALID_CREDENTIALS");
    if (user.status === "BLOCKED") throw forbidden("Hisob bloklangan", "BLOCKED");
    const dto = await startSession(req, reply, user.id);
    businessEvents.inc({ event: "login" });
    void audit({ actorId: user.id, action: "LOGIN", entity: "User", entityId: user.id, ip: req.ip });
    return { user: dto };
  });

  // ── Password reset (after OTP)
  app.post("/auth/password/reset", async (req) => {
    const { verificationToken, password } = z.object({ verificationToken: z.string(), password: passwordSchema }).parse(req.body);
    const phone = await verifyPhoneToken(verificationToken, "RESET");
    if (!phone) throw badRequest("Tasdiqlash muddati o'tgan", "PHONE_NOT_VERIFIED");
    const user = await prisma.user.update({ where: { phone }, data: { passwordHash: await hashPassword(password) } });
    await prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    void audit({ actorId: user.id, action: "PASSWORD_RESET", entity: "User", entityId: user.id, ip: req.ip });
    return { ok: true };
  });

  // ── Refresh (rotating refresh tokens; reuse of a revoked token revokes every session of the user)
  app.post("/auth/refresh", async (req, reply) => {
    const token = req.cookies[REFRESH_COOKIE];
    if (!token) throw unauthorized();
    const session = await prisma.session.findUnique({ where: { refreshTokenHash: sha256(token) } });
    if (!session || session.expiresAt < new Date()) {
      clearAuthCookies(reply);
      throw unauthorized("Sessiya tugagan", "SESSION_EXPIRED");
    }
    if (session.revokedAt) {
      // grace window for parallel refreshes (several tabs / middleware + client at once)
      if (Date.now() - session.revokedAt.getTime() > 30_000) {
        await prisma.session.updateMany({ where: { userId: session.userId, revokedAt: null }, data: { revokedAt: new Date() } });
        clearAuthCookies(reply);
        throw unauthorized("Sessiya bekor qilingan", "SESSION_REVOKED");
      }
    } else {
      await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    }
    return { user: await startSession(req, reply, session.userId) };
  });

  app.post("/auth/logout", async (req, reply) => {
    const token = req.cookies[REFRESH_COOKIE];
    if (token) await prisma.session.updateMany({ where: { refreshTokenHash: sha256(token) }, data: { revokedAt: new Date() } });
    clearAuthCookies(reply);
    return { ok: true };
  });

  app.get("/auth/me", async (req) => {
    const u = requireUser(req);
    const user = await prisma.user.findUnique({ where: { id: u.id }, select: userSelect });
    if (!user || user.status === "BLOCKED") throw unauthorized();
    return { user: userDto(user) };
  });

  app.patch("/auth/me", async (req) => {
    const u = requireUser(req);
    const body = z
      .object({
        fullName: z.string().trim().min(3).max(191).optional(),
        email: z.string().trim().email().max(191).nullable().optional(),
        pinfl: z.string().regex(/^\d{14}$/, "JShShIR 14 ta raqam").nullable().optional(),
        locale: z.enum(["uz", "oz", "ru"]).optional(),
      })
      .parse(req.body);
    if (body.email) {
      const other = await prisma.user.findFirst({ where: { email: body.email, NOT: { id: u.id } } });
      if (other) throw conflict("Bu email band", "EMAIL_TAKEN");
    }
    const user = await prisma.user.update({ where: { id: u.id }, data: body, select: userSelect });
    return { user: userDto(user) };
  });

  app.post("/auth/password", async (req) => {
    const u = requireUser(req);
    const { current, next } = z.object({ current: z.string(), next: passwordSchema }).parse(req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    if (!(await verifyPassword(current, user.passwordHash))) throw new AppError(400, "WRONG_PASSWORD", "Joriy parol noto'g'ri");
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(next) } });
    void audit({ actorId: u.id, action: "PASSWORD_CHANGE", entity: "User", entityId: u.id, ip: req.ip });
    return { ok: true };
  });
}
