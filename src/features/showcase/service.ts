import { and, asc, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import type { Ctx } from "@/lib/ctx";
import { activityRow } from "@/lib/auth/session";
import { adminActivityLogs, idempotencyKeys, showcaseMembers, showcaseRegistrations, type Admin } from "@/lib/db/schema";
import { AppError } from "@/lib/http";
import { newShowcaseId, uuid } from "@/lib/ids";
import { windowState } from "@/lib/time";
import { SHOWCASE } from "@/config/showcase";
import { enqueue, enqueueStatements, type OutboxEntry } from "../email/outbox";
import { normaliseStudentId } from "../registration/schema";
import { SHOWCASE_FEE_PER_TEAM, type ShowcaseInput } from "./schema";

/** Registration window, Bangladesh time, both ends inclusive. */
export const SHOWCASE_OPEN_AT = "2026-11-13T00:00:00+06:00";
export const SHOWCASE_CLOSE_AT = "2026-11-22T23:59:59+06:00";

export interface ShowcaseResult {
  registrationId: string;
  projectTitle: string;
  teamSize: number;
  feeBdt: number;
}

const contactLine = () => `${SHOWCASE.contacts.map((c) => `${c.name} (${c.dept}) ${c.phone}`).join(", ")} or ${SHOWCASE.email}`;
const DUPLICATE = "Part of this registration already exists. Check the emails, student IDs and transaction ID.";

export function showcaseWindow(now: number) {
  return windowState(now, SHOWCASE_OPEN_AT, SHOWCASE_CLOSE_AT);
}

export async function registerShowcase(ctx: Ctx, input: ShowcaseInput, ip: string): Promise<ShowcaseResult> {
  const scopedKey = `showcase:${input.idempotencyKey}`;
  const replay = (await ctx.db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, scopedKey)).limit(1))[0];
  if (replay) return JSON.parse(replay.responseJson) as ShowcaseResult;

  const state = showcaseWindow(ctx.now());
  if (state === "before") throw new AppError(403, "WINDOW_CLOSED", "Showcase registration opens on 13 November 2026.");
  if (state === "closed") throw new AppError(403, "WINDOW_CLOSED", "Showcase registration closed on 22 November 2026.");

  const people = input.members.map((m) => ({ ...m, studentIdNorm: normaliseStudentId(m.studentId) }));
  const fields: Record<string, string> = {};
  const [emailTaken, idTaken, trxTaken] = await Promise.all([
    ctx.db.select({ email: showcaseMembers.email }).from(showcaseMembers).where(inArray(showcaseMembers.email, people.map((p) => p.email))),
    ctx.db.select({ s: showcaseMembers.studentIdNorm }).from(showcaseMembers).where(inArray(showcaseMembers.studentIdNorm, people.map((p) => p.studentIdNorm))),
    ctx.db.select({ id: showcaseRegistrations.id }).from(showcaseRegistrations).where(eq(showcaseRegistrations.transactionId, input.payment.transactionId)).limit(1),
  ]);
  people.forEach((p, i) => {
    if (emailTaken.some((r) => r.email === p.email)) fields[`members.${i}.email`] = "This email is already registered for the showcase.";
    if (idTaken.some((r) => r.s === p.studentIdNorm)) fields[`members.${i}.studentId`] = "This student ID is already registered for the showcase.";
  });
  if (trxTaken.length) fields["payment.transactionId"] = "This transaction ID has already been used.";
  if (Object.keys(fields).length) throw new AppError(409, "DUPLICATE", DUPLICATE, fields);

  const now = ctx.now();
  const id = uuid();
  const registrationId = newShowcaseId();
  const feeBdt = SHOWCASE_FEE_PER_TEAM;
  const result: ShowcaseResult = { registrationId, projectTitle: input.project.title, teamSize: people.length, feeBdt };
  const rows = people.map((p, i) => ({
    id: uuid(),
    registrationId: id,
    position: i + 1,
    fullName: p.fullName,
    studentId: p.studentId,
    studentIdNorm: p.studentIdNorm,
    department: p.department,
    session: p.session,
    email: p.email,
    phone: p.phone,
    createdAt: now,
  }));
  const emails: OutboxEntry[] = rows.map((m) => ({
    template: "showcase_received",
    to: m.email,
    dedupe: `showcase:${m.id}`,
    payload: {
      name: m.fullName,
      registrationId,
      projectTitle: input.project.title,
      category: input.project.category,
      members: rows.map((r) => r.fullName),
      feeBdt,
      transactionId: input.payment.transactionId,
      eventDate: SHOWCASE.eventDate,
      venue: SHOWCASE.venue,
      contact: contactLine(),
    },
  }));

  try {
    await ctx.db.batch([
      ctx.db.insert(idempotencyKeys).values({ key: scopedKey, scope: "showcase", responseJson: JSON.stringify(result), createdAt: now }),
      ctx.db.insert(showcaseRegistrations).values({
        id,
        registrationId,
        projectTitle: input.project.title,
        category: input.project.category,
        description: input.project.description,
        teamSize: people.length,
        feeBdt,
        senderPhone: input.payment.senderPhone,
        transactionId: input.payment.transactionId,
        status: "PENDING_VERIFICATION",
        submittedIp: ip,
        createdAt: now,
        updatedAt: now,
      }),
      ...rows.map((r) => ctx.db.insert(showcaseMembers).values(r)),
      ...enqueueStatements(ctx, emails),
    ]);
  } catch (err) {
    if (/UNIQUE constraint failed/i.test(String((err as Error)?.message ?? err))) {
      const again = (await ctx.db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, scopedKey)).limit(1))[0];
      if (again) return JSON.parse(again.responseJson) as ShowcaseResult;
      throw new AppError(409, "DUPLICATE", DUPLICATE);
    }
    throw err;
  }
  return result;
}

async function loadWithMembers(ctx: Ctx, id: string) {
  const reg = (await ctx.db.select().from(showcaseRegistrations).where(eq(showcaseRegistrations.id, id)).limit(1))[0];
  if (!reg) throw new AppError(404, "NOT_FOUND", "Showcase registration not found.");
  const members = await ctx.db.select().from(showcaseMembers).where(eq(showcaseMembers.registrationId, id)).orderBy(asc(showcaseMembers.position));
  return { reg, members };
}

export async function verifyShowcase(ctx: Ctx, admin: Admin, id: string, note?: string) {
  const { reg, members } = await loadWithMembers(ctx, id);
  const now = ctx.now();
  const changed = await ctx.db
    .update(showcaseRegistrations)
    .set({ status: "CONFIRMED", decidedBy: admin.id, decidedAt: now, internalNote: note?.trim() || reg.internalNote, updatedAt: now })
    .where(and(eq(showcaseRegistrations.id, id), eq(showcaseRegistrations.status, "PENDING_VERIFICATION")))
    .returning({ id: showcaseRegistrations.id });
  if (!changed.length) throw new AppError(409, "INVALID_TRANSITION", "This registration has already been decided.");
  await ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "showcase.verify", entityType: "showcase", entityId: id }));
  await enqueue(
    ctx,
    members.map((m) => ({
      template: "showcase_confirmed" as const,
      to: m.email,
      dedupe: `showcase:${m.id}`,
      payload: { name: m.fullName, registrationId: reg.registrationId, projectTitle: reg.projectTitle, eventDate: SHOWCASE.eventDate, venue: SHOWCASE.venue, contact: contactLine() },
    })),
  );
}

export async function rejectShowcase(ctx: Ctx, admin: Admin, id: string, reasonRaw: string, note?: string) {
  const reason = reasonRaw.trim();
  if (reason.length < 5) throw new AppError(400, "VALIDATION_ERROR", "Give the team a reason they can act on.", { reason: "A reason is required." });
  const { reg, members } = await loadWithMembers(ctx, id);
  const now = ctx.now();
  const changed = await ctx.db
    .update(showcaseRegistrations)
    .set({ status: "REJECTED", rejectionReason: reason, decidedBy: admin.id, decidedAt: now, internalNote: note?.trim() || reg.internalNote, updatedAt: now })
    .where(and(eq(showcaseRegistrations.id, id), eq(showcaseRegistrations.status, "PENDING_VERIFICATION")))
    .returning({ id: showcaseRegistrations.id });
  if (!changed.length) throw new AppError(409, "INVALID_TRANSITION", "This registration has already been decided.");
  await ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "showcase.reject", entityType: "showcase", entityId: id, detail: { reason } }));
  await enqueue(
    ctx,
    members.map((m) => ({
      template: "showcase_rejected" as const,
      to: m.email,
      dedupe: `showcase:${m.id}:${now}`,
      payload: { name: m.fullName, registrationId: reg.registrationId, projectTitle: reg.projectTitle, transactionId: reg.transactionId, reason, contact: contactLine() },
    })),
  );
}

/**
 * Removes a rejected registration so the same students can register again with a
 * correct payment. Confirmed or pending registrations cannot be deleted.
 */
export async function deleteShowcase(ctx: Ctx, admin: Admin, id: string) {
  const { reg } = await loadWithMembers(ctx, id);
  if (reg.status !== "REJECTED") throw new AppError(409, "INVALID_TRANSITION", "Only rejected registrations can be deleted.");
  await ctx.db.batch([
    ctx.db.delete(showcaseMembers).where(eq(showcaseMembers.registrationId, id)),
    ctx.db.delete(showcaseRegistrations).where(eq(showcaseRegistrations.id, id)),
    ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "showcase.delete", entityType: "showcase", entityId: id, detail: { registrationId: reg.registrationId } })),
  ]);
}

export interface ShowcaseFilters {
  q?: string;
  status?: string;
  category?: string;
}

export async function listShowcase(ctx: Ctx, f: ShowcaseFilters) {
  const where: (SQL | undefined)[] = [];
  if (f.status) where.push(eq(showcaseRegistrations.status, f.status as never));
  if (f.category) where.push(eq(showcaseRegistrations.category, f.category as never));
  const q = f.q?.trim();
  if (q) {
    const p = `%${q.replace(/[%_]/g, "")}%`;
    where.push(
      or(
        like(showcaseRegistrations.projectTitle, p),
        like(showcaseRegistrations.registrationId, p.toUpperCase()),
        like(showcaseRegistrations.transactionId, p.toUpperCase()),
        like(showcaseRegistrations.senderPhone, p),
        sql`exists (select 1 from showcase_members m where m.registration_id = ${showcaseRegistrations.id} and (m.full_name like ${p} or m.email like ${p.toLowerCase()} or m.student_id like ${p}))`,
      ),
    );
  }
  const regs = await ctx.db
    .select()
    .from(showcaseRegistrations)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(showcaseRegistrations.createdAt))
    .limit(500);
  const members = regs.length
    ? await ctx.db.select().from(showcaseMembers).where(inArray(showcaseMembers.registrationId, regs.map((r) => r.id))).orderBy(asc(showcaseMembers.position))
    : [];
  return regs.map((r) => ({ ...r, members: members.filter((m) => m.registrationId === r.id) }));
}

export async function showcaseStats(ctx: Ctx) {
  const rows = await ctx.db
    .select({ status: showcaseRegistrations.status, teams: sql<number>`count(*)`, people: sql<number>`sum(${showcaseRegistrations.teamSize})`, fees: sql<number>`sum(${showcaseRegistrations.feeBdt})` })
    .from(showcaseRegistrations)
    .groupBy(showcaseRegistrations.status);
  const by = (s: string) => rows.find((r) => r.status === s) ?? { teams: 0, people: 0, fees: 0 };
  return {
    teams: rows.reduce((a, r) => a + r.teams, 0),
    participants: rows.reduce((a, r) => a + (r.people ?? 0), 0),
    pending: by("PENDING_VERIFICATION").teams,
    confirmed: by("CONFIRMED").teams,
    confirmedParticipants: by("CONFIRMED").people ?? 0,
    rejected: by("REJECTED").teams,
    feesConfirmed: by("CONFIRMED").fees ?? 0,
  };
}
