import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { can, type Permission } from "./auth/permissions";
import { adminFromToken, sessionCookieName } from "./auth/session";
import { getCtx, type Ctx } from "./ctx";
import type { Admin } from "./db/schema";
import { AppError, zodFields } from "./http";

export async function currentAdmin(ctx: Ctx = getCtx()): Promise<Admin | null> {
  const store = await cookies();
  return adminFromToken(ctx, store.get(sessionCookieName(ctx))?.value);
}

/** For pages: sends anonymous visitors to the login page and the wrong role to a refusal page. */
export async function requireAdminPage(permission?: Permission): Promise<{ admin: Admin; ctx: Ctx }> {
  const ctx = getCtx();
  const admin = await currentAdmin(ctx);
  if (!admin) redirect("/admin/login");
  if (admin.mustChangePassword) redirect("/admin/account?first=1");
  if (permission && !can(admin.role, permission)) redirect("/admin/forbidden");
  return { admin, ctx };
}

/** For route handlers and server actions: throws instead of redirecting. */
export async function requireAdmin(permission?: Permission): Promise<{ admin: Admin; ctx: Ctx }> {
  const ctx = getCtx();
  const admin = await currentAdmin(ctx);
  if (!admin) throw new AppError(401, "UNAUTHENTICATED", "Please sign in.");
  // Same rule as the pages: a temporary password must be changed before anything else.
  if (admin.mustChangePassword) throw new AppError(403, "PASSWORD_CHANGE_REQUIRED", "Change your temporary password first.");
  if (permission && !can(admin.role, permission)) throw new AppError(403, "FORBIDDEN", "Your role does not allow this action.");
  return { admin, ctx };
}

export async function requestIp(): Promise<string> {
  const h = await headers();
  return h.get("cf-connecting-ip") ?? h.get("x-real-ip") ?? "local";
}

export type ActionResult<T = undefined> = { ok: true; message?: string; data?: T } | { ok: false; error: string; fields?: Record<string, string> };

/** Runs a server action body and converts thrown errors into a serialisable result. */
export async function runAction<T = undefined>(fn: () => Promise<{ message?: string; data?: T } | void>): Promise<ActionResult<T>> {
  try {
    const out = await fn();
    return { ok: true, message: out?.message, data: out?.data };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message, fields: err.fields };
    if (err instanceof ZodError) return { ok: false, error: "Please check the highlighted fields.", fields: zodFields(err) };
    // Next.js control-flow errors (redirect, notFound) must propagate.
    if (err && typeof err === "object" && "digest" in err) throw err;
    console.error("action failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
