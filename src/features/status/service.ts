import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import type { Ctx } from "@/lib/ctx";
import { attendance, ideaSubmissions, participants, payments, statusOtps, teams } from "@/lib/db/schema";
import { AppError } from "@/lib/http";
import { hmacHex, newOtp, safeEqual, sha256Hex, uuid } from "@/lib/ids";
import { getSettings } from "@/lib/settings";
import { windowState } from "@/lib/time";
import { enqueue } from "../email/outbox";

export const STATUS_COOKIE = "cou_status";
export const STATUS_COOKIE_TTL_MS = 30 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

export type Stage = "SUBMITTED" | "UNDER_REVIEW" | "NOT_SELECTED" | "PAYMENT_PENDING" | "PAYMENT_VERIFICATION" | "CONFIRMED" | "DISQUALIFIED";

/** The participant-facing stage is derived from team status and the latest payment. */
export function deriveStage(teamStatus: string, latestPaymentStatus: string | null): Stage {
  switch (teamStatus) {
    case "SHORTLISTED":
      return latestPaymentStatus === "PENDING_VERIFICATION" ? "PAYMENT_VERIFICATION" : "PAYMENT_PENDING";
    case "SUBMITTED":
    case "UNDER_REVIEW":
    case "NOT_SELECTED":
    case "CONFIRMED":
    case "DISQUALIFIED":
      return teamStatus;
    default:
      return "SUBMITTED";
  }
}

export async function signStatusCookie(ctx: Ctx, teamId: string): Promise<string> {
  const exp = ctx.now() + STATUS_COOKIE_TTL_MS;
  const sig = await hmacHex(ctx.env.SESSION_SECRET, `status-cookie:${teamId}:${exp}`);
  return `${teamId}.${exp}.${sig}`;
}

export async function readStatusCookie(ctx: Ctx, value: string | undefined | null): Promise<string | null> {
  if (!value) return null;
  const [teamId, expRaw, sig] = value.split(".");
  const exp = Number(expRaw);
  if (!teamId || !sig || !Number.isFinite(exp) || exp < ctx.now()) return null;
  const expected = await hmacHex(ctx.env.SESSION_SECRET, `status-cookie:${teamId}:${exp}`);
  return safeEqual(expected, sig) ? teamId : null;
}

async function findParticipant(ctx: Ctx, registrationId: string, email: string) {
  return (
    await ctx.db
      .select({ id: participants.id, teamId: participants.teamId, email: participants.email })
      .from(participants)
      .innerJoin(teams, eq(teams.id, participants.teamId))
      .where(and(eq(teams.registrationId, registrationId.trim().toUpperCase()), eq(participants.email, email.trim().toLowerCase())))
      .limit(1)
  )[0];
}

/** Always resolves the same way, whether or not the pair matches a registration. */
export async function requestStatusOtp(ctx: Ctx, registrationId: string, email: string): Promise<void> {
  const participant = await findParticipant(ctx, registrationId, email);
  if (!participant) return;
  const code = newOtp();
  const id = uuid();
  const now = ctx.now();
  await ctx.db.insert(statusOtps).values({ id, participantId: participant.id, codeHash: await sha256Hex(`${id}:${code}`), expiresAt: now + OTP_TTL_MS, createdAt: now });
  await enqueue(ctx, [{ template: "status_otp", to: participant.email, dedupe: id, teamId: participant.teamId, participantId: participant.id, payload: { code } }]);
}

export async function verifyStatusOtp(ctx: Ctx, registrationId: string, email: string, code: string): Promise<string> {
  const fail = new AppError(401, "INVALID_CODE", "That code is not valid. Check it or request a new one.");
  const participant = await findParticipant(ctx, registrationId, email);
  if (!participant) throw fail;
  const otp = (
    await ctx.db
      .select()
      .from(statusOtps)
      .where(and(eq(statusOtps.participantId, participant.id), isNull(statusOtps.consumedAt)))
      .orderBy(desc(statusOtps.createdAt))
      .limit(1)
  )[0];
  if (!otp || otp.expiresAt < ctx.now() || otp.attempts >= OTP_MAX_ATTEMPTS) throw fail;
  // Count the attempt before checking it, in one conditional statement, so parallel
  // guesses cannot slip past the limit.
  const counted = await ctx.db
    .update(statusOtps)
    .set({ attempts: sql`${statusOtps.attempts} + 1` })
    .where(and(eq(statusOtps.id, otp.id), isNull(statusOtps.consumedAt), lt(statusOtps.attempts, OTP_MAX_ATTEMPTS)))
    .returning({ id: statusOtps.id });
  if (counted.length === 0) throw fail;
  const matches = safeEqual(await sha256Hex(`${otp.id}:${code.trim()}`), otp.codeHash);
  if (!matches) throw fail;
  // Single use: only the first correct submission consumes the code.
  const consumed = await ctx.db
    .update(statusOtps)
    .set({ consumedAt: ctx.now() })
    .where(and(eq(statusOtps.id, otp.id), isNull(statusOtps.consumedAt)))
    .returning({ id: statusOtps.id });
  if (consumed.length === 0) throw fail;
  return participant.teamId;
}

export async function teamIdForParticipant(ctx: Ctx, participantId: string): Promise<string | null> {
  const row = (await ctx.db.select({ teamId: participants.teamId }).from(participants).where(eq(participants.id, participantId)).limit(1))[0];
  return row?.teamId ?? null;
}

/** What a verified participant may see. No phones, student IDs, emails or documents. */
export async function getTeamStatus(ctx: Ctx, teamId: string) {
  const team = (await ctx.db.select().from(teams).where(eq(teams.id, teamId)).limit(1))[0];
  if (!team) return null;
  const [members, idea, pays, present, settings] = await Promise.all([
    ctx.db.select({ id: participants.id, fullName: participants.fullName, position: participants.position }).from(participants).where(eq(participants.teamId, teamId)).orderBy(participants.position),
    ctx.db.select({ title: ideaSubmissions.title }).from(ideaSubmissions).where(eq(ideaSubmissions.teamId, teamId)).limit(1),
    ctx.db.select().from(payments).where(eq(payments.teamId, teamId)).orderBy(desc(payments.createdAt)),
    ctx.db.select({ participantId: attendance.participantId }).from(attendance).where(eq(attendance.teamId, teamId)),
    getSettings(ctx),
  ]);
  const latest = pays[0] ?? null;
  const stage = deriveStage(team.status, latest?.status ?? null);
  const phase2 = windowState(ctx.now(), settings.phase2OpenAt, settings.phase2CloseAt);
  const canPay = stage === "PAYMENT_PENDING" && phase2 === "open" && (latest?.status !== "REJECTED" || settings.allowResubmission);
  return {
    teamId: team.id,
    registrationId: team.registrationId,
    teamName: team.name,
    teamSize: team.size,
    ideaTitle: idea[0]?.title ?? "",
    members: members.map((m) => m.fullName.split(" ")[0]),
    stage,
    phase2,
    canPay,
    checkedIn: present.length,
    payment: latest
      ? { status: latest.status, provider: latest.provider, transactionId: latest.transactionId, rejectionReason: latest.status === "REJECTED" ? latest.rejectionReason : null, submittedAt: latest.createdAt }
      : null,
    settings: {
      feeBdt: settings.feeBdt,
      bkashNumber: settings.bkashNumber,
      nagadNumber: settings.nagadNumber,
      phase2OpenAt: settings.phase2OpenAt,
      phase2CloseAt: settings.phase2CloseAt,
      shortlistAnnouncement: settings.shortlistAnnouncement,
      eventStartAt: settings.eventStartAt,
      venue: settings.venue,
      screenshotRequired: settings.screenshotRequired,
    },
  };
}

export type TeamStatusView = NonNullable<Awaited<ReturnType<typeof getTeamStatus>>>;
