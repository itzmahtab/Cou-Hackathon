import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Ctx } from "@/lib/ctx";
import { activityRow } from "@/lib/auth/session";
import { adminActivityLogs, attendance, files, participants, payments, PAYMENT_PROVIDERS, paymentVerificationLogs, teams, type Admin } from "@/lib/db/schema";
import { AppError } from "@/lib/http";
import { uuid } from "@/lib/ids";
import { getSettings } from "@/lib/settings";
import { formatDhaka, formatDhakaDate, windowState } from "@/lib/time";
import { enqueue, statusLink, type OutboxEntry } from "../email/outbox";
import { normalisePhone } from "../registration/schema";

export const normaliseTransactionId = (s: string) => s.replace(/\s+/g, "").toUpperCase();

export const paymentSchema = z
  .object({
    provider: z.enum(PAYMENT_PROVIDERS, { error: "Choose bKash or Nagad." }),
    senderPhone: z
      .string({ error: "Sender number is required." })
      .refine((v) => normalisePhone(v) !== null, "Enter the bKash or Nagad number the money was sent from (01XXXXXXXXX).")
      .transform((v) => normalisePhone(v)!),
    transactionId: z
      .string({ error: "Transaction ID is required." })
      .transform(normaliseTransactionId)
      .pipe(z.string().regex(/^[A-Z0-9]{6,30}$/, "Enter the transaction ID exactly as shown in the app (letters and digits only).")),
    amountBdt: z.coerce.number({ error: "Amount is required." }).int("Enter the amount in whole taka."),
    screenshotFileId: z.string().uuid().optional().nullable(),
    uploadSession: z.string().uuid().optional(),
  })
  .strict();

export type PaymentInput = z.infer<typeof paymentSchema>;

async function memberEmails(ctx: Ctx, teamId: string) {
  return ctx.db.select({ id: participants.id, name: participants.fullName, email: participants.email }).from(participants).where(eq(participants.teamId, teamId));
}

export async function submitPayment(ctx: Ctx, teamId: string, input: PaymentInput) {
  const team = (await ctx.db.select().from(teams).where(eq(teams.id, teamId)).limit(1))[0];
  if (!team) throw new AppError(404, "NOT_FOUND", "Team not found.");
  if (team.status === "CONFIRMED") throw new AppError(409, "INVALID_TRANSITION", "This team's payment is already verified.");
  if (team.status !== "SHORTLISTED") throw new AppError(403, "FORBIDDEN", "Only shortlisted teams can submit a payment.");

  const settings = await getSettings(ctx);
  const state = windowState(ctx.now(), settings.phase2OpenAt, settings.phase2CloseAt);
  if (state === "before") throw new AppError(403, "WINDOW_CLOSED", "The payment window has not opened yet.");
  if (state === "closed") throw new AppError(403, "WINDOW_CLOSED", "The payment window has closed.");
  if (input.amountBdt !== settings.feeBdt) {
    throw new AppError(400, "VALIDATION_ERROR", "The amount does not match the team fee.", { amountBdt: `The team fee is BDT ${settings.feeBdt}.` });
  }

  const existing = await ctx.db.select({ status: payments.status }).from(payments).where(eq(payments.teamId, teamId));
  if (existing.some((p) => p.status === "PENDING_VERIFICATION")) throw new AppError(409, "DUPLICATE", "A payment for this team is already waiting for verification.");
  if (existing.some((p) => p.status === "REJECTED") && !settings.allowResubmission) throw new AppError(403, "FORBIDDEN", "Resubmission is closed. Please contact the organisers.");

  if (settings.screenshotRequired && !input.screenshotFileId) {
    throw new AppError(400, "VALIDATION_ERROR", "A payment screenshot is required.", { screenshotFileId: "Upload a screenshot of the transaction." });
  }
  if (input.screenshotFileId) {
    const file = (
      await ctx.db
        .select({ id: files.id })
        .from(files)
        .where(and(eq(files.id, input.screenshotFileId), eq(files.status, "PENDING"), eq(files.category, "PAYMENT_SCREENSHOT"), eq(files.uploadSession, input.uploadSession ?? "")))
        .limit(1)
    )[0];
    if (!file) throw new AppError(400, "VALIDATION_ERROR", "Please upload the screenshot again.", { screenshotFileId: "Upload the screenshot again." });
  }

  const now = ctx.now();
  const paymentId = uuid();
  try {
    await ctx.db.batch([
      ctx.db.insert(payments).values({
        id: paymentId,
        teamId,
        provider: input.provider,
        senderPhone: input.senderPhone,
        transactionId: input.transactionId,
        amountBdt: input.amountBdt,
        screenshotFileId: input.screenshotFileId ?? null,
        status: "PENDING_VERIFICATION",
        createdAt: now,
        updatedAt: now,
      }),
      ...(input.screenshotFileId ? [ctx.db.update(files).set({ status: "ATTACHED" }).where(eq(files.id, input.screenshotFileId))] : []),
    ]);
  } catch (err) {
    const message = String((err as Error)?.message ?? err);
    if (/payments\.provider, payments\.transaction_id|payments_trx_uq/i.test(message)) {
      throw new AppError(409, "DUPLICATE", "This transaction ID has already been submitted.", { transactionId: "This transaction ID has already been used." });
    }
    if (/UNIQUE constraint failed/i.test(message)) throw new AppError(409, "DUPLICATE", "A payment for this team is already waiting for verification.");
    throw err;
  }

  const members = await memberEmails(ctx, teamId);
  const entries: OutboxEntry[] = await Promise.all(
    members.map(async (m) => ({
      template: "payment_received" as const,
      to: m.email,
      dedupe: `${paymentId}:${m.id}`,
      teamId,
      participantId: m.id,
      payload: { name: m.name, teamName: team.name, registrationId: team.registrationId, provider: input.provider, transactionId: input.transactionId, amountBdt: input.amountBdt, statusUrl: await statusLink(ctx, m.id) },
    })),
  );
  if (ctx.env.ADMIN_NOTIFY_EMAIL) {
    entries.push({
      template: "admin_payment_notice",
      to: ctx.env.ADMIN_NOTIFY_EMAIL,
      dedupe: paymentId,
      teamId,
      payload: { teamName: team.name, registrationId: team.registrationId, provider: input.provider, transactionId: input.transactionId, url: `${ctx.env.APP_URL}/admin/payments` },
    });
  }
  await enqueue(ctx, entries);
  return { paymentId, status: "PENDING_VERIFICATION" as const };
}

async function loadPayment(ctx: Ctx, paymentId: string) {
  const row = (await ctx.db.select({ payment: payments, team: teams }).from(payments).innerJoin(teams, eq(teams.id, payments.teamId)).where(eq(payments.id, paymentId)).limit(1))[0];
  if (!row) throw new AppError(404, "NOT_FOUND", "Payment not found.");
  return row;
}

/**
 * Verify: payment -> VERIFIED and team -> CONFIRMED in one batch. The team
 * update is guarded on this call's payment update having taken effect, so a
 * double click or two admins cannot confirm twice.
 */
export async function verifyPayment(ctx: Ctx, admin: Admin, paymentId: string, note?: string) {
  const { payment, team } = await loadPayment(ctx, paymentId);
  if (payment.status !== "PENDING_VERIFICATION") throw new AppError(409, "INVALID_TRANSITION", "This payment has already been decided.");
  const now = ctx.now();
  const mine = sql`exists (select 1 from payments where id = ${paymentId} and status = 'VERIFIED' and decided_by = ${admin.id} and decided_at = ${now})`;
  const members = await memberEmails(ctx, team.id);
  let results;
  try {
    results = await ctx.db.batch([
      ctx.db
        .update(payments)
        .set({ status: "VERIFIED", decidedBy: admin.id, decidedAt: now, internalNote: note?.trim() || payment.internalNote, updatedAt: now })
        .where(and(eq(payments.id, paymentId), eq(payments.status, "PENDING_VERIFICATION")))
        .returning({ id: payments.id }),
      ctx.db.update(teams).set({ status: "CONFIRMED", updatedAt: now }).where(and(eq(teams.id, team.id), eq(teams.status, "SHORTLISTED"), mine)),
    ]);
  } catch (err) {
    if (/UNIQUE constraint failed/i.test(String((err as Error)?.message ?? err))) throw new AppError(409, "DUPLICATE", "This team already has a verified payment.");
    throw err;
  }
  if ((results[0] as { id: string }[]).length === 0) throw new AppError(409, "INVALID_TRANSITION", "This payment has already been decided.");

  const settings = await getSettings(ctx);
  await ctx.db.batch([
    ctx.db.insert(paymentVerificationLogs).values({ id: uuid(), paymentId, adminId: admin.id, action: "VERIFY", reason: note?.trim() || null, createdAt: now }),
    ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "payment.verify", entityType: "payment", entityId: paymentId, detail: { teamId: team.id } })),
  ]);
  await enqueue(
    ctx,
    await Promise.all(
      members.map(async (m) => ({
        template: "payment_verified" as const,
        to: m.email,
        dedupe: `${paymentId}:${m.id}`,
        teamId: team.id,
        participantId: m.id,
        payload: { name: m.name, teamName: team.name, registrationId: team.registrationId, eventDate: formatDhakaDate(settings.eventStartAt), venue: settings.venue, statusUrl: await statusLink(ctx, m.id) },
      })),
    ),
  );
  return { teamId: team.id };
}

export async function rejectPayment(ctx: Ctx, admin: Admin, paymentId: string, reasonRaw: string, note?: string) {
  const reason = reasonRaw.trim();
  if (reason.length < 5) throw new AppError(400, "VALIDATION_ERROR", "Give the team a reason they can act on.", { reason: "A reason is required." });
  const { payment, team } = await loadPayment(ctx, paymentId);
  const now = ctx.now();
  const changed = await ctx.db
    .update(payments)
    .set({ status: "REJECTED", rejectionReason: reason, decidedBy: admin.id, decidedAt: now, internalNote: note?.trim() || payment.internalNote, updatedAt: now })
    .where(and(eq(payments.id, paymentId), eq(payments.status, "PENDING_VERIFICATION")))
    .returning({ id: payments.id });
  if (changed.length === 0) throw new AppError(409, "INVALID_TRANSITION", "This payment has already been decided.");

  const settings = await getSettings(ctx);
  const canResubmit = settings.allowResubmission && windowState(now, settings.phase2OpenAt, settings.phase2CloseAt) === "open";
  await ctx.db.batch([
    ctx.db.insert(paymentVerificationLogs).values({ id: uuid(), paymentId, adminId: admin.id, action: "REJECT", reason, createdAt: now }),
    ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "payment.reject", entityType: "payment", entityId: paymentId, detail: { reason } })),
  ]);
  const members = await memberEmails(ctx, team.id);
  await enqueue(
    ctx,
    await Promise.all(
      members.map(async (m) => ({
        template: "payment_rejected" as const,
        to: m.email,
        dedupe: `${paymentId}:${m.id}`,
        teamId: team.id,
        participantId: m.id,
        payload: { name: m.name, teamName: team.name, registrationId: team.registrationId, transactionId: payment.transactionId, reason, canResubmit, deadline: formatDhaka(settings.phase2CloseAt), statusUrl: await statusLink(ctx, m.id) },
      })),
    ),
  );
  return { teamId: team.id };
}

/** Check-in: one row per present participant. Only confirmed teams can be checked in. */
export async function setAttendance(ctx: Ctx, admin: Admin, participantId: string, present: boolean) {
  const row = (
    await ctx.db.select({ teamId: teams.id, status: teams.status }).from(participants).innerJoin(teams, eq(teams.id, participants.teamId)).where(eq(participants.id, participantId)).limit(1)
  )[0];
  if (!row) throw new AppError(404, "NOT_FOUND", "Participant not found.");
  if (row.status !== "CONFIRMED") throw new AppError(409, "INVALID_TRANSITION", "Only confirmed teams can be checked in.");
  if (present) {
    await ctx.db
      .insert(attendance)
      .values({ id: uuid(), participantId, teamId: row.teamId, checkedInAt: ctx.now(), checkedInBy: admin.id })
      .onConflictDoNothing({ target: attendance.participantId });
  } else {
    await ctx.db.delete(attendance).where(eq(attendance.participantId, participantId));
  }
  return { teamId: row.teamId };
}
