"use server";

import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { activityRow, createSession, login, logout, sessionCookieName, sessionCookieOptions } from "@/lib/auth/session";
import { getCtx } from "@/lib/ctx";
import { adminActivityLogs, admins, adminSessions } from "@/lib/db/schema";
import { AppError } from "@/lib/http";
import { rateLimit } from "@/lib/security/ratelimit";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { currentAdmin, requestIp, runAction, type ActionResult } from "@/lib/server";

export async function loginAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = getCtx();
  const result = await runAction(async () => {
    const ip = await requestIp();
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const password = String(fd.get("password") ?? "");
    if (!email || !password) throw new AppError(400, "VALIDATION_ERROR", "Enter your email and password.");
    await rateLimit(ctx, `login-ip:${ip}`, 5, 15 * 60);
    await rateLimit(ctx, `login-email:${email}`, 5, 15 * 60);
    await verifyTurnstile(ctx, String(fd.get("cf-turnstile-response") ?? "") || null, ip);
    const { token } = await login(ctx, email, password, ip, (await headers()).get("user-agent"));
    (await cookies()).set(sessionCookieName(ctx), token, sessionCookieOptions(ctx));
  });
  if (!result.ok) return result;
  redirect("/admin");
}

export async function logoutAction() {
  const ctx = getCtx();
  const store = await cookies();
  await logout(ctx, store.get(sessionCookieName(ctx))?.value);
  store.delete(sessionCookieName(ctx));
  redirect("/admin/login");
}

const passwordSchema = z.object({ current: z.string().min(1, "Enter your current password."), next: z.string(), repeat: z.string() });

export async function changePasswordAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = getCtx();
  const result = await runAction(async () => {
    const admin = await currentAdmin(ctx);
    if (!admin) throw new AppError(401, "UNAUTHENTICATED", "Please sign in again.");
    const input = passwordSchema.parse(Object.fromEntries(fd));
    await rateLimit(ctx, `password:${admin.id}`, 5, 15 * 60);
    if (!(await verifyPassword(input.current, admin.passwordHash))) throw new AppError(400, "VALIDATION_ERROR", "Your current password is wrong.", { current: "Wrong password." });
    const problem = passwordProblem(input.next);
    if (problem) throw new AppError(400, "VALIDATION_ERROR", problem, { next: problem });
    if (input.next !== input.repeat) throw new AppError(400, "VALIDATION_ERROR", "The new passwords do not match.", { repeat: "Does not match." });
    if (input.next === input.current) throw new AppError(400, "VALIDATION_ERROR", "Choose a password you have not used here before.");
    const now = ctx.now();
    await ctx.db.batch([
      ctx.db.update(admins).set({ passwordHash: await hashPassword(input.next), mustChangePassword: false, updatedAt: now }).where(eq(admins.id, admin.id)),
      // Signs out every other session for this account.
      ctx.db.delete(adminSessions).where(eq(adminSessions.adminId, admin.id)),
      ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "auth.password_change" })),
    ]);
    // The current session was removed too; open a fresh one directly (no second hash).
    const token = await createSession(ctx, { ...admin, mustChangePassword: false }, await requestIp(), (await headers()).get("user-agent"));
    (await cookies()).set(sessionCookieName(ctx), token, sessionCookieOptions(ctx));
    return { message: "Password changed. Other sessions have been signed out." };
  });
  return result;
}
