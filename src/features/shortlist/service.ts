import { and, eq, inArray, sql } from "drizzle-orm";
import type { Ctx } from "@/lib/ctx";
import { can } from "@/lib/auth/permissions";
import { activityRow } from "@/lib/auth/session";
import { adminActivityLogs, participants, shortlistSelections, teams, type Admin } from "@/lib/db/schema";
import { AppError } from "@/lib/http";
import { uuid } from "@/lib/ids";
import { getSettings } from "@/lib/settings";
import { formatDhaka, formatDhakaDate } from "@/lib/time";
import { enqueue, statusLink, type OutboxEntry } from "../email/outbox";

const IN_REVIEW = ["SUBMITTED", "UNDER_REVIEW"] as const;

export async function finalisedAt(ctx: Ctx): Promise<number | null> {
  const row = (await ctx.db.select({ at: shortlistSelections.createdAt }).from(shortlistSelections).where(eq(shortlistSelections.action, "FINALISE")).limit(1))[0];
  return row?.at ?? null;
}

export async function candidateCount(ctx: Ctx): Promise<number> {
  const row = (await ctx.db.select({ n: sql<number>`count(*)` }).from(teams).where(eq(teams.isShortlistCandidate, true)))[0];
  return row?.n ?? 0;
}

/**
 * Marks or unmarks a shortlist candidate. The capacity check lives inside the
 * UPDATE, so two admins adding at the same time cannot exceed it.
 */
export async function setCandidate(ctx: Ctx, admin: Admin, teamId: string, selected: boolean, justification?: string) {
  if (await finalisedAt(ctx)) throw new AppError(409, "ALREADY_FINALISED", "The shortlist has been finalised and can no longer be changed.");
  const { shortlistCapacity } = await getSettings(ctx);
  const now = ctx.now();
  const log = (action: "ADD" | "REMOVE" | "OVERRIDE_ADD", why?: string) =>
    ctx.db.batch([
      ctx.db.insert(shortlistSelections).values({ id: uuid(), teamId, action, justification: why ?? null, adminId: admin.id, createdAt: now }),
      ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: `shortlist.${action.toLowerCase()}`, entityType: "team", entityId: teamId, detail: why ? { justification: why } : undefined })),
    ]);

  if (!selected) {
    const changed = await ctx.db
      .update(teams)
      .set({ isShortlistCandidate: false, updatedAt: now })
      .where(and(eq(teams.id, teamId), eq(teams.isShortlistCandidate, true)))
      .returning({ id: teams.id });
    if (changed.length) await log("REMOVE");
    return { selected: false };
  }

  const eligible = and(eq(teams.id, teamId), eq(teams.isShortlistCandidate, false), inArray(teams.status, [...IN_REVIEW]));
  const added = await ctx.db
    .update(teams)
    .set({ isShortlistCandidate: true, updatedAt: now })
    .where(and(eligible, sql`(select count(*) from teams where is_shortlist_candidate = 1) < ${shortlistCapacity}`))
    .returning({ id: teams.id });
  if (added.length) {
    await log("ADD");
    return { selected: true };
  }

  const team = (await ctx.db.select({ status: teams.status, isCandidate: teams.isShortlistCandidate }).from(teams).where(eq(teams.id, teamId)).limit(1))[0];
  if (!team) throw new AppError(404, "NOT_FOUND", "Team not found.");
  if (team.isCandidate) return { selected: true };
  if (!IN_REVIEW.includes(team.status as (typeof IN_REVIEW)[number])) throw new AppError(409, "INVALID_TRANSITION", "This team is not eligible for the shortlist.");

  // The shortlist is full. Only an authorised admin with a written reason may exceed it.
  const reason = justification?.trim() ?? "";
  if (!reason) throw new AppError(409, "SHORTLIST_FULL", `The shortlist already has ${shortlistCapacity} teams. Remove one first.`);
  if (!can(admin.role, "shortlist.override")) throw new AppError(403, "FORBIDDEN", "Only a super admin can exceed the shortlist limit.");
  if (reason.length < 20) throw new AppError(400, "VALIDATION_ERROR", "Give a justification of at least 20 characters.", { justification: "At least 20 characters." });
  const forced = await ctx.db.update(teams).set({ isShortlistCandidate: true, updatedAt: now }).where(eligible).returning({ id: teams.id });
  if (forced.length) await log("OVERRIDE_ADD", reason);
  return { selected: true, override: true };
}

/**
 * One-shot. The unique index on the FINALISE row makes a second call fail
 * inside the batch, before any status changes.
 */
export async function finaliseShortlist(ctx: Ctx, admin: Admin) {
  const count = await candidateCount(ctx);
  if (count === 0) throw new AppError(400, "VALIDATION_ERROR", "Select at least one team before finalising.");
  const now = ctx.now();
  try {
    await ctx.db.batch([
      ctx.db.insert(shortlistSelections).values({ id: uuid(), teamId: null, action: "FINALISE", adminId: admin.id, createdAt: now }),
      ctx.db.update(teams).set({ status: "SHORTLISTED", updatedAt: now }).where(and(eq(teams.isShortlistCandidate, true), inArray(teams.status, [...IN_REVIEW]))),
      ctx.db.update(teams).set({ status: "NOT_SELECTED", updatedAt: now }).where(and(eq(teams.isShortlistCandidate, false), inArray(teams.status, [...IN_REVIEW]))),
      ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "shortlist.finalise", detail: { shortlisted: count } })),
    ]);
  } catch (err) {
    if (/UNIQUE constraint failed/i.test(String((err as Error)?.message ?? err))) {
      throw new AppError(409, "ALREADY_FINALISED", "The shortlist has already been finalised.");
    }
    throw err;
  }
  const queued = await queueSelectionEmails(ctx);
  return { shortlisted: count, emailsQueued: queued };
}

/** Idempotent: each participant gets at most one selection email, however often this runs. */
export async function queueSelectionEmails(ctx: Ctx): Promise<number> {
  if (!(await finalisedAt(ctx))) return 0;
  const settings = await getSettings(ctx);
  const rows = await ctx.db
    .select({ id: participants.id, name: participants.fullName, email: participants.email, teamId: teams.id, teamName: teams.name, registrationId: teams.registrationId, status: teams.status })
    .from(participants)
    .innerJoin(teams, eq(teams.id, participants.teamId))
    .where(inArray(teams.status, ["SHORTLISTED", "NOT_SELECTED", "CONFIRMED"]));
  const entries: OutboxEntry[] = await Promise.all(
    rows.map(async (r) =>
      r.status === "NOT_SELECTED"
        ? { template: "not_selected" as const, to: r.email, dedupe: r.id, teamId: r.teamId, participantId: r.id, payload: { name: r.name, teamName: r.teamName, registrationId: r.registrationId } }
        : {
            template: "shortlisted" as const,
            to: r.email,
            dedupe: r.id,
            teamId: r.teamId,
            participantId: r.id,
            payload: {
              name: r.name,
              teamName: r.teamName,
              registrationId: r.registrationId,
              feeBdt: settings.feeBdt,
              bkash: settings.bkashNumber,
              nagad: settings.nagadNumber,
              deadline: formatDhaka(settings.phase2CloseAt),
              eventDate: formatDhakaDate(settings.eventStartAt),
              venue: settings.venue,
              statusUrl: await statusLink(ctx, r.id),
            },
          },
    ),
  );
  await enqueue(ctx, entries);
  return entries.length;
}
