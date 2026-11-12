"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { activityRow } from "@/lib/auth/session";
import { runAfter } from "@/lib/ctx";
import { adminActivityLogs, announcements, eventSchedules, participants, teams } from "@/lib/db/schema";
import { AppError } from "@/lib/http";
import { uuid } from "@/lib/ids";
import { requireAdmin, runAction, type ActionResult } from "@/lib/server";
import { drainOutbox, enqueue, statusLink } from "@/features/email/outbox";
import { DEFAULT_SCHEDULE } from "@/features/event/queries";

const itemSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(400).optional().default(""),
  timeLabel: z.string().trim().min(1, "Enter a time.").max(60),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

export async function saveScheduleItemAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("event.manage");
    const id = String(fd.get("id") ?? "");
    const input = itemSchema.parse(Object.fromEntries(fd));
    const now = ctx.now();
    if (id) await ctx.db.update(eventSchedules).set({ ...input, updatedAt: now }).where(eq(eventSchedules.id, id));
    else await ctx.db.insert(eventSchedules).values({ id: uuid(), ...input, isPublished: true, createdAt: now, updatedAt: now });
    await ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: id ? "schedule.update" : "schedule.create", entityType: "schedule", entityId: id || undefined, detail: { title: input.title } }));
    revalidatePath("/", "layout");
    return { message: "Schedule saved." };
  });
}

export async function deleteScheduleItemAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("event.manage");
    const id = z.string().uuid().parse(fd.get("id"));
    await ctx.db.delete(eventSchedules).where(eq(eventSchedules.id, id));
    await ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "schedule.delete", entityType: "schedule", entityId: id }));
    revalidatePath("/", "layout");
    return { message: "Removed." };
  });
}

/** Copies the suggested running order into the database so it can be edited. */
export async function seedScheduleAction(): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx } = await requireAdmin("event.manage");
    const now = ctx.now();
    const existing = await ctx.db.select({ id: eventSchedules.id }).from(eventSchedules).limit(1);
    if (existing.length) throw new AppError(409, "DUPLICATE", "The schedule already has items.");
    await ctx.db.batch(DEFAULT_SCHEDULE.map((d) => ctx.db.insert(eventSchedules).values({ id: uuid(), title: d.title, description: d.description, timeLabel: "TBA", sortOrder: d.sortOrder * 10, isPublished: true, createdAt: now, updatedAt: now })) as never);
    revalidatePath("/", "layout");
    return { message: "Suggested schedule added. Set the times below." };
  });
}

const announcementSchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(3).max(2000),
  publish: z.enum(["0", "1"]).default("1"),
  audience: z.enum(["none", "all", "shortlisted", "confirmed"]).default("none"),
});

/** Posts an announcement on the site and, optionally, emails it to a group of participants. */
export async function createAnnouncementAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const input = announcementSchema.parse(Object.fromEntries(fd));
    const { ctx, admin } = await requireAdmin(input.audience === "none" ? "event.manage" : "emails.broadcast");
    const now = ctx.now();
    const id = uuid();
    await ctx.db.insert(announcements).values({ id, title: input.title, body: input.body, isPublished: input.publish === "1", publishedAt: input.publish === "1" ? now : null, createdBy: admin.id, createdAt: now, updatedAt: now });
    let emailed = 0;
    if (input.audience !== "none") {
      const statuses = input.audience === "confirmed" ? ["CONFIRMED"] : input.audience === "shortlisted" ? ["SHORTLISTED", "CONFIRMED"] : ["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "NOT_SELECTED", "CONFIRMED"];
      const people = (await ctx.db.select({ id: participants.id, name: participants.fullName, email: participants.email, teamId: teams.id, status: teams.status }).from(participants).innerJoin(teams, eq(teams.id, participants.teamId))).filter((p) => statuses.includes(p.status));
      await enqueue(
        ctx,
        await Promise.all(
          people.map(async (p) => ({
            template: "announcement" as const,
            to: p.email,
            dedupe: `${id}:${p.id}`,
            teamId: p.teamId,
            participantId: p.id,
            requestedBy: admin.id,
            payload: { subject: input.title, body: input.body, name: p.name, statusUrl: await statusLink(ctx, p.id) },
          })),
        ),
      );
      emailed = people.length;
      runAfter(drainOutbox(ctx));
    }
    await ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "announcement.create", entityType: "announcement", entityId: id, detail: { audience: input.audience, emailed } }));
    revalidatePath("/", "layout");
    return { message: emailed ? `Announcement saved and ${emailed} email(s) queued.` : "Announcement saved." };
  });
}

export async function toggleAnnouncementAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx } = await requireAdmin("event.manage");
    const id = z.string().uuid().parse(fd.get("id"));
    const publish = fd.get("publish") === "1";
    await ctx.db.update(announcements).set({ isPublished: publish, publishedAt: publish ? ctx.now() : null, updatedAt: ctx.now() }).where(eq(announcements.id, id));
    revalidatePath("/", "layout");
    return { message: publish ? "Published." : "Hidden." };
  });
}
