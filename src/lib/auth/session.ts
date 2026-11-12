import { and, eq, gt } from "drizzle-orm";
import type { Ctx } from "../ctx";
import { adminActivityLogs, admins, adminSessions, type Admin } from "../db/schema";
import { AppError } from "../http";
import { randomToken, sha256Hex, uuid } from "../ids";
import { can, type Permission } from "./permissions";
import { DUMMY_HASH, verifyPassword } from "./password";

export const IDLE_MS = 2 * 60 * 60 * 1000;
export const ABSOLUTE_MS = 12 * 60 * 60 * 1000;

export const sessionCookieName = (ctx: Ctx) => (ctx.env.APP_ENV === "production" ? "__Host-cou_admin" : "cou_admin");

export function sessionCookieOptions(ctx: Ctx) {
  return { httpOnly: true, secure: ctx.env.APP_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: ABSOLUTE_MS / 1000 };
}

export async function logActivity(
  ctx: Ctx,
  entry: { adminId: string | null; action: string; entityType?: string; entityId?: string; detail?: unknown; ip?: string },
) {
  await ctx.db.insert(adminActivityLogs).values(activityRow(ctx, entry));
}

export function activityRow(
  ctx: Ctx,
  entry: { adminId: string | null; action: string; entityType?: string; entityId?: string; detail?: unknown; ip?: string },
) {
  return {
    id: uuid(),
    adminId: entry.adminId,
    action: entry.action,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    detailJson: entry.detail === undefined ? null : JSON.stringify(entry.detail),
    ip: entry.ip ?? null,
    createdAt: ctx.now(),
  };
}

/** Returns a session token on success. Every failure looks identical to the caller. */
export async function login(ctx: Ctx, emailRaw: string, password: string, ip: string, userAgent: string | null): Promise<{ token: string; admin: Admin }> {
  const email = emailRaw.trim().toLowerCase();
  const admin = (await ctx.db.select().from(admins).where(eq(admins.email, email)).limit(1))[0];
  const valid = verifyPassword(password, admin?.passwordHash ?? DUMMY_HASH);
  if (!admin || !valid || !admin.isActive) {
    await logActivity(ctx, { adminId: admin?.id ?? null, action: "auth.login_failed", detail: { email }, ip });
    throw new AppError(401, "UNAUTHENTICATED", "Incorrect email or password.");
  }
  const token = randomToken(32);
  const now = ctx.now();
  await ctx.db.batch([
    ctx.db.insert(adminSessions).values({
      tokenHash: await sha256Hex(token),
      adminId: admin.id,
      ip,
      userAgent: userAgent?.slice(0, 300) ?? null,
      lastSeenAt: now,
      expiresAt: now + ABSOLUTE_MS,
      createdAt: now,
    }),
    ctx.db.update(admins).set({ lastLoginAt: now }).where(eq(admins.id, admin.id)),
    ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "auth.login", ip })),
  ]);
  return { token, admin };
}

export async function adminFromToken(ctx: Ctx, token: string | undefined | null): Promise<Admin | null> {
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const now = ctx.now();
  const row = (
    await ctx.db
      .select({ admin: admins, session: adminSessions })
      .from(adminSessions)
      .innerJoin(admins, eq(admins.id, adminSessions.adminId))
      .where(and(eq(adminSessions.tokenHash, tokenHash), gt(adminSessions.expiresAt, now)))
      .limit(1)
  )[0];
  if (!row || !row.admin.isActive) return null;
  if (now - row.session.lastSeenAt > IDLE_MS) {
    await ctx.db.delete(adminSessions).where(eq(adminSessions.tokenHash, tokenHash));
    return null;
  }
  if (now - row.session.lastSeenAt > 60_000) {
    await ctx.db.update(adminSessions).set({ lastSeenAt: now }).where(eq(adminSessions.tokenHash, tokenHash));
  }
  return row.admin;
}

export async function logout(ctx: Ctx, token: string | undefined | null) {
  if (!token) return;
  await ctx.db.delete(adminSessions).where(eq(adminSessions.tokenHash, await sha256Hex(token)));
}

export function assertCan(admin: Admin | null, permission?: Permission): asserts admin is Admin {
  if (!admin) throw new AppError(401, "UNAUTHENTICATED", "Please sign in.");
  if (permission && !can(admin.role, permission)) throw new AppError(403, "FORBIDDEN", "Your role does not allow this action.");
}
