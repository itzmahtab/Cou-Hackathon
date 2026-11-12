"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hashPassword, passwordProblem } from "@/lib/auth/password";
import { activityRow } from "@/lib/auth/session";
import { ADMIN_ROLES } from "@/lib/constants";
import { adminActivityLogs, admins, adminSessions, files } from "@/lib/db/schema";
import { AppError } from "@/lib/http";
import { uuid } from "@/lib/ids";
import { runAfter } from "@/lib/ctx";
import { requireAdmin, runAction, type ActionResult } from "@/lib/server";
import { settingsSchema, settingsUpserts, type Settings } from "@/lib/settings";

/** "Title | description" per line. */
const parseLines = (raw: string) =>
  raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [a, ...rest] = l.split("|");
      return [a.trim(), rest.join("|").trim()] as const;
    });

/** datetime-local inputs carry no zone; the form is in Bangladesh time. */
const dhaka = (v: FormDataEntryValue | null) => (v ? `${String(v).slice(0, 16)}:00+06:00` : "");

export async function saveSettingsAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("settings.manage");
    const closeOf = (k: string) => {
      const v = dhaka(fd.get(k));
      return v.replace(/T(\d\d:\d\d):00\+06:00$/, "T$1:59+06:00");
    };
    const candidate: Settings = settingsSchema.parse({
      phase1OpenAt: dhaka(fd.get("phase1OpenAt")),
      phase1CloseAt: closeOf("phase1CloseAt"),
      shortlistAnnouncement: String(fd.get("shortlistAnnouncement") ?? ""),
      phase2OpenAt: dhaka(fd.get("phase2OpenAt")),
      phase2CloseAt: closeOf("phase2CloseAt"),
      eventStartAt: dhaka(fd.get("eventStartAt")),
      venue: String(fd.get("venue") ?? ""),
      feeBdt: Number(fd.get("feeBdt")),
      bkashNumber: String(fd.get("bkashNumber") ?? "").trim(),
      nagadNumber: String(fd.get("nagadNumber") ?? "").trim(),
      screenshotRequired: fd.get("screenshotRequired") === "on",
      allowResubmission: fd.get("allowResubmission") === "on",
      shortlistCapacity: Number(fd.get("shortlistCapacity")),
      contactEmail: String(fd.get("contactEmail") ?? "").trim(),
      contactPhone: String(fd.get("contactPhone") ?? "").trim(),
      domains: parseLines(String(fd.get("domains") ?? "")).map(([title, description]) => ({ title, description })),
      organisers: parseLines(String(fd.get("organisers") ?? "")).map(([name, role]) => ({ name, role })),
    });
    if (Date.parse(candidate.phase1CloseAt) <= Date.parse(candidate.phase1OpenAt)) throw new AppError(400, "VALIDATION_ERROR", "Phase 1 must close after it opens.");
    if (Date.parse(candidate.phase2CloseAt) <= Date.parse(candidate.phase2OpenAt)) throw new AppError(400, "VALIDATION_ERROR", "Phase 2 must close after it opens.");
    await ctx.db.batch([
      ...settingsUpserts(ctx, candidate, admin.id),
      ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "settings.update" })),
    ] as never);
    revalidatePath("/", "layout");
    return { message: "Settings saved. The public site uses them immediately." };
  });
}

const newAdminSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(2).max(80),
  role: z.enum(ADMIN_ROLES),
  password: z.string(),
});

/** New accounts must change the temporary password at first sign-in. */
export async function createAdminAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("admins.manage");
    const input = newAdminSchema.parse(Object.fromEntries(fd));
    const problem = passwordProblem(input.password);
    if (problem) throw new AppError(400, "VALIDATION_ERROR", problem, { password: problem });
    const now = ctx.now();
    const id = uuid();
    try {
      await ctx.db.batch([
        ctx.db.insert(admins).values({ id, email: input.email, name: input.name, role: input.role, passwordHash: await hashPassword(input.password), isActive: true, mustChangePassword: true, createdAt: now, updatedAt: now }),
        ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "admin.create", entityType: "admin", entityId: id, detail: { email: input.email, role: input.role } })),
      ]);
    } catch (err) {
      if (/UNIQUE/i.test(String((err as Error)?.message))) throw new AppError(409, "DUPLICATE", "An admin with that email already exists.");
      throw err;
    }
    revalidatePath("/admin/settings");
    return { message: `Created ${input.email}. Share the temporary password privately; they must change it at first sign-in.` };
  });
}

export async function updateAdminAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("admins.manage");
    const id = z.string().uuid().parse(fd.get("id"));
    if (id === admin.id) throw new AppError(400, "VALIDATION_ERROR", "You cannot change your own role or access here.");
    const role = z.enum(ADMIN_ROLES).parse(fd.get("role"));
    const active = fd.get("active") === "on";
    const target = (await ctx.db.select().from(admins).where(eq(admins.id, id)).limit(1))[0];
    if (!target) throw new AppError(404, "NOT_FOUND", "Admin not found.");
    // Never leave the event without an active super admin.
    if (target.role === "SUPER_ADMIN" && (role !== "SUPER_ADMIN" || !active)) {
      const others = await ctx.db.select({ id: admins.id }).from(admins).where(and(eq(admins.role, "SUPER_ADMIN"), eq(admins.isActive, true), ne(admins.id, id)));
      if (others.length === 0) throw new AppError(400, "VALIDATION_ERROR", "This is the last active super admin.");
    }
    await ctx.db.batch([
      ctx.db.update(admins).set({ role, isActive: active, updatedAt: ctx.now() }).where(eq(admins.id, id)),
      // Role or access changes take effect at once: existing sessions are ended.
      ctx.db.delete(adminSessions).where(eq(adminSessions.adminId, id)),
      ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "admin.update", entityType: "admin", entityId: id, detail: { role, active } })),
    ]);
    revalidatePath("/admin/settings");
    return { message: "Updated. Their current sessions were signed out." };
  });
}

export async function resetAdminPasswordAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("admins.manage");
    const id = z.string().uuid().parse(fd.get("id"));
    const password = String(fd.get("password") ?? "");
    const problem = passwordProblem(password);
    if (problem) throw new AppError(400, "VALIDATION_ERROR", problem);
    await ctx.db.batch([
      ctx.db.update(admins).set({ passwordHash: await hashPassword(password), mustChangePassword: true, updatedAt: ctx.now() }).where(eq(admins.id, id)),
      ctx.db.delete(adminSessions).where(eq(adminSessions.adminId, id)),
      ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "admin.reset_password", entityType: "admin", entityId: id })),
    ]);
    return { message: "Temporary password set. They must change it at next sign-in." };
  });
}

/** Retention: deletes student ID images and payment screenshots. Irreversible and logged. */
export async function purgeIdentityFilesAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("admins.manage");
    if (fd.get("confirm") !== "PURGE") throw new AppError(400, "VALIDATION_ERROR", "Confirmation phrase missing.");
    const rows = await ctx.db.select({ id: files.id, key: files.r2Key }).from(files).where(and(inArray(files.category, ["STUDENT_ID", "PAYMENT_SCREENSHOT"]), ne(files.status, "DELETED")));
    for (let i = 0; i < rows.length; i += 500) await ctx.files.delete(rows.slice(i, i + 500).map((r) => r.key));
    for (let i = 0; i < rows.length; i += 50) {
      await ctx.db.update(files).set({ status: "DELETED" }).where(inArray(files.id, rows.slice(i, i + 50).map((r) => r.id)));
    }
    await ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "retention.purge_identity_files", detail: { files: rows.length } }));
    return { message: `Deleted ${rows.length} file(s).` };
  });
}

/** Saves the Gmail App Password (encrypted), then sends whatever is waiting in the queue. */
export async function saveSmtpPasswordAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("settings.manage");
    const { saveSmtpPassword, clearSmtpPassword } = await import("@/features/email/config");
    const { drainOutbox } = await import("@/features/email/outbox");
    if (fd.get("clear") === "1") {
      await clearSmtpPassword(ctx);
      await ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "settings.smtp_password_cleared" }));
      revalidatePath("/admin", "layout");
      return { message: "Email password removed." };
    }
    // Google shows app passwords in groups of four with spaces; the spaces are not part of it.
    const password = String(fd.get("smtpPassword") ?? "").replace(/\s+/g, "");
    if (password.length < 8 || password.length > 64) throw new AppError(400, "VALIDATION_ERROR", "Paste the 16-character Gmail App Password.", { smtpPassword: "16 characters expected." });
    await saveSmtpPassword(ctx, password, admin.id);
    await ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "settings.smtp_password_saved" }));
    runAfter(drainOutbox(ctx, 10));
    revalidatePath("/admin", "layout");
    return { message: "Saved. Queued emails are being sent now. Use Emails -> Send me a test email to confirm delivery." };
  });
}
