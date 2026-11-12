import { and, asc, eq, lte } from "drizzle-orm";
import type { Ctx } from "@/lib/ctx";
import { emailOutbox } from "@/lib/db/schema";
import { AppError } from "@/lib/http";
import { hmacHex, safeEqual, uuid } from "@/lib/ids";
import { getProvider, type EmailProvider } from "./providers";
import { renderEmail, type TemplateName } from "./templates";

export const MAX_ATTEMPTS = 5;
const BACKOFF_MIN = [1, 5, 30, 120];

export interface OutboxEntry {
  template: TemplateName;
  to: string;
  /** Unique per logical email. A second enqueue with the same value is ignored. */
  dedupe: string;
  payload: Record<string, unknown>;
  teamId?: string | null;
  participantId?: string | null;
  requestedBy?: string | null;
}

export function outboxRow(ctx: Ctx, e: OutboxEntry) {
  const now = ctx.now();
  return {
    id: uuid(),
    dedupeKey: `${e.template}:${e.dedupe}`,
    template: e.template,
    toEmail: e.to,
    teamId: e.teamId ?? null,
    participantId: e.participantId ?? null,
    payloadJson: JSON.stringify(e.payload),
    status: "QUEUED" as const,
    attempts: 0,
    nextAttemptAt: now,
    requestedBy: e.requestedBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Insert statements for use inside a db.batch. Rows are chunked to stay under D1's bound-parameter limit. */
export function enqueueStatements(ctx: Ctx, entries: OutboxEntry[]) {
  const rows = entries.map((e) => outboxRow(ctx, e));
  const stmts = [];
  for (let i = 0; i < rows.length; i += 6) {
    stmts.push(ctx.db.insert(emailOutbox).values(rows.slice(i, i + 6)).onConflictDoNothing({ target: emailOutbox.dedupeKey }));
  }
  return stmts;
}

export async function enqueue(ctx: Ctx, entries: OutboxEntry[]) {
  for (const stmt of enqueueStatements(ctx, entries)) await stmt;
}

/** Personal status link: verifiable without storing a token. */
export async function statusSignature(ctx: Ctx, participantId: string) {
  return (await hmacHex(ctx.env.SESSION_SECRET, `status:${participantId}`)).slice(0, 40);
}

export async function statusLink(ctx: Ctx, participantId: string) {
  return `${ctx.env.APP_URL}/status/open?p=${participantId}&s=${await statusSignature(ctx, participantId)}`;
}

export async function verifyStatusSignature(ctx: Ctx, participantId: string, signature: string) {
  return safeEqual(await statusSignature(ctx, participantId), signature);
}

/**
 * Sends due emails. Each row is claimed with a conditional update first, so the
 * cron run and an after-response kick can overlap without sending twice.
 */
export async function drainOutbox(ctx: Ctx, limit?: number): Promise<{ sent: number; failed: number }> {
  const batch = limit ?? Math.max(1, Number(ctx.env.EMAIL_BATCH_SIZE ?? 10) || 10);
  const due = await ctx.db
    .select()
    .from(emailOutbox)
    .where(and(eq(emailOutbox.status, "QUEUED"), lte(emailOutbox.nextAttemptAt, ctx.now())))
    .orderBy(asc(emailOutbox.nextAttemptAt))
    .limit(batch);

  let sent = 0;
  let failed = 0;
  // One provider (and, for SMTP, one connection) per batch. A configuration error is
  // recorded on each row below rather than thrown, so it shows in Admin -> Emails.
  if (due.length === 0) return { sent: 0, failed: 0 };
  let provider: EmailProvider;
  try {
    provider = getProvider(ctx.env);
  } catch (err) {
    // Missing configuration is not a delivery failure: keep every row queued, with its
    // retries intact, and show the reason in Admin -> Emails until it is fixed.
    const message = `Not sent yet: ${String((err as Error)?.message ?? err)}`.slice(0, 500);
    await ctx.db.update(emailOutbox).set({ lastError: message, updatedAt: ctx.now() }).where(and(eq(emailOutbox.status, "QUEUED"), lte(emailOutbox.nextAttemptAt, ctx.now())));
    return { sent: 0, failed: 0 };
  }
  try {
  for (const row of due) {
    const now = ctx.now();
    const claimed = await ctx.db
      .update(emailOutbox)
      .set({ attempts: row.attempts + 1, nextAttemptAt: now + 10 * 60_000, updatedAt: now })
      .where(and(eq(emailOutbox.id, row.id), eq(emailOutbox.status, "QUEUED"), eq(emailOutbox.attempts, row.attempts)))
      .returning({ id: emailOutbox.id });
    if (claimed.length === 0) continue;

    const attempts = row.attempts + 1;
    try {
      const email = renderEmail(row.template, JSON.parse(row.payloadJson));
      const result = await provider.send(row.toEmail, email);
      await ctx.db
        .update(emailOutbox)
        .set({ status: "SENT", sentAt: ctx.now(), providerMessageId: result.messageId, lastError: null, updatedAt: ctx.now() })
        .where(eq(emailOutbox.id, row.id));
      sent++;
    } catch (err) {
      failed++;
      const dead = attempts >= MAX_ATTEMPTS;
      const backoff = BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)] * 60_000;
      await ctx.db
        .update(emailOutbox)
        .set({
          status: dead ? "DEAD" : "QUEUED",
          nextAttemptAt: ctx.now() + backoff,
          lastError: String((err as Error)?.message ?? err).slice(0, 500),
          updatedAt: ctx.now(),
        })
        .where(eq(emailOutbox.id, row.id));
    }
  }
  } finally {
    provider.close?.();
  }
  return { sent, failed };
}

/** Admin resend: a new row, so the original delivery record is kept. */
export async function resendEmail(ctx: Ctx, outboxId: string, adminId: string) {
  const row = (await ctx.db.select().from(emailOutbox).where(eq(emailOutbox.id, outboxId)).limit(1))[0];
  if (!row) throw new AppError(404, "NOT_FOUND", "Email not found.");
  const now = ctx.now();
  const id = uuid();
  await ctx.db.insert(emailOutbox).values({
    id,
    dedupeKey: `${row.dedupeKey.replace(/:resend:\d+$/, "")}:resend:${now}`,
    template: row.template,
    toEmail: row.toEmail,
    teamId: row.teamId,
    participantId: row.participantId,
    payloadJson: row.payloadJson,
    status: "QUEUED",
    attempts: 0,
    nextAttemptAt: now,
    requestedBy: adminId,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}
