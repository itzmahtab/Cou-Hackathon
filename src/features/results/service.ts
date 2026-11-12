import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Ctx } from "@/lib/ctx";
import { activityRow } from "@/lib/auth/session";
import { adminActivityLogs, finalResults, ideaSubmissions, leaderboardPublications, participants, POSITIONS, teams, type Admin } from "@/lib/db/schema";
import { AppError } from "@/lib/http";
import { uuid } from "@/lib/ids";
import { PRIZES } from "@/lib/settings";
import { enqueue } from "../email/outbox";

export const resultSchema = z.object({
  totalScore: z.coerce.number({ error: "Score is required." }).min(0, "Score cannot be negative.").max(1000, "Score is too large."),
  rank: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.number().int().min(1).max(500).nullable()),
  position: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.enum(POSITIONS).nullable()),
  judgeFeedback: z.string().max(4000).optional().default(""),
});

export type ResultInput = z.infer<typeof resultSchema>;

export interface PublicRow {
  rank: number | null;
  position: (typeof POSITIONS)[number] | null;
  teamName: string;
  universities: string[];
  projectTitle: string;
  totalScore: number;
  prizeBdt: number | null;
}

const prizeFor = (position: string | null) => PRIZES.find((p) => p.position === position)?.amountBdt ?? null;

export async function saveResult(ctx: Ctx, admin: Admin, teamId: string, input: ResultInput) {
  const team = (await ctx.db.select({ status: teams.status }).from(teams).where(eq(teams.id, teamId)).limit(1))[0];
  if (!team) throw new AppError(404, "NOT_FOUND", "Team not found.");
  if (team.status !== "CONFIRMED") throw new AppError(409, "INVALID_TRANSITION", "Only confirmed teams can receive a final result.");
  const now = ctx.now();
  const values = {
    totalScore: input.totalScore,
    rank: input.rank,
    position: input.position,
    prizeBdt: prizeFor(input.position),
    judgeFeedback: input.judgeFeedback?.trim() || null,
    updatedBy: admin.id,
    updatedAt: now,
  };
  try {
    await ctx.db.batch([
      ctx.db.insert(finalResults).values({ id: uuid(), teamId, createdAt: now, ...values }).onConflictDoUpdate({ target: finalResults.teamId, set: values }),
      ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "result.save", entityType: "team", entityId: teamId, detail: { totalScore: input.totalScore, rank: input.rank, position: input.position } })),
    ]);
  } catch (err) {
    const message = String((err as Error)?.message ?? err);
    if (/final_results\.rank|results_rank_uq/i.test(message)) throw new AppError(409, "DUPLICATE", "Another team already has that rank.", { rank: "Rank already used." });
    if (/final_results\.position|results_position_uq/i.test(message)) throw new AppError(409, "DUPLICATE", "Another team already holds that position.", { position: "Position already assigned." });
    throw err;
  }
}

/** Ranks every scored team by score, highest first, and assigns the three prize positions. */
export async function autoRank(ctx: Ctx, admin: Admin) {
  const rows = await ctx.db.select({ id: finalResults.id }).from(finalResults).orderBy(desc(finalResults.totalScore), asc(finalResults.createdAt));
  if (rows.length === 0) throw new AppError(400, "VALIDATION_ERROR", "Enter at least one score first.");
  const now = ctx.now();
  await ctx.db.batch([
    // Clear first so the unique indexes are never violated mid-way.
    ctx.db.update(finalResults).set({ rank: null, position: null, prizeBdt: null }),
    ...rows.map((r, i) => {
      const position = POSITIONS[i] ?? null;
      return ctx.db.update(finalResults).set({ rank: i + 1, position, prizeBdt: prizeFor(position), updatedBy: admin.id, updatedAt: now }).where(eq(finalResults.id, r.id));
    }),
    ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "result.auto_rank", detail: { teams: rows.length } })),
  ]);
  return rows.length;
}

/** Builds the public rows from an explicit column list. Feedback and contact details are never selected. */
export async function buildPublicRows(ctx: Ctx): Promise<PublicRow[]> {
  const rows = await ctx.db
    .select({
      teamId: teams.id,
      rank: finalResults.rank,
      position: finalResults.position,
      teamName: teams.name,
      projectTitle: ideaSubmissions.title,
      totalScore: finalResults.totalScore,
      prizeBdt: finalResults.prizeBdt,
    })
    .from(finalResults)
    .innerJoin(teams, eq(teams.id, finalResults.teamId))
    .innerJoin(ideaSubmissions, eq(ideaSubmissions.teamId, teams.id))
    .orderBy(sql`${finalResults.rank} is null`, asc(finalResults.rank), desc(finalResults.totalScore));
  const unis = await ctx.db.select({ teamId: participants.teamId, university: participants.university }).from(participants);
  const byTeam = new Map<string, string[]>();
  for (const u of unis) {
    const list = byTeam.get(u.teamId) ?? [];
    if (!list.some((x) => x.toLowerCase() === u.university.toLowerCase())) list.push(u.university);
    byTeam.set(u.teamId, list);
  }
  return rows.map(({ teamId, ...r }) => ({ ...r, universities: byTeam.get(teamId) ?? [] }));
}

export async function isPublished(ctx: Ctx): Promise<boolean> {
  const latest = (await ctx.db.select({ action: leaderboardPublications.action }).from(leaderboardPublications).orderBy(desc(leaderboardPublications.createdAt)).limit(1))[0];
  return latest?.action === "PUBLISH";
}

export async function publishResults(ctx: Ctx, admin: Admin, opts: { notify?: boolean } = {}) {
  const rows = await buildPublicRows(ctx);
  for (const position of POSITIONS) {
    if (rows.filter((r) => r.position === position).length !== 1) {
      throw new AppError(400, "VALIDATION_ERROR", "Assign Champion, First Runner-up and Second Runner-up to exactly one team each before publishing.");
    }
  }
  if (rows.some((r) => r.rank === null)) throw new AppError(400, "VALIDATION_ERROR", "Every scored team needs a rank before publishing.");
  const now = ctx.now();
  await ctx.db.batch([
    ctx.db.insert(leaderboardPublications).values({ id: uuid(), action: "PUBLISH", adminId: admin.id, snapshotJson: JSON.stringify(rows), createdAt: now }),
    ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "result.publish", detail: { teams: rows.length } })),
  ]);
  if (opts.notify) {
    const people = await ctx.db
      .select({ id: participants.id, name: participants.fullName, email: participants.email, teamId: participants.teamId })
      .from(participants)
      .innerJoin(teams, eq(teams.id, participants.teamId))
      .where(eq(teams.status, "CONFIRMED"));
    await enqueue(
      ctx,
      people.map((p) => ({ template: "results" as const, to: p.email, dedupe: p.id, teamId: p.teamId, participantId: p.id, payload: { name: p.name, leaderboardUrl: `${ctx.env.APP_URL}/leaderboard` } })),
    );
  }
  return rows.length;
}

export async function unpublishResults(ctx: Ctx, admin: Admin) {
  await ctx.db.batch([
    ctx.db.insert(leaderboardPublications).values({ id: uuid(), action: "UNPUBLISH", adminId: admin.id, snapshotJson: null, createdAt: ctx.now() }),
    ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "result.unpublish" })),
  ]);
}

/**
 * The public leaderboard is served from the snapshot taken at publish time, so
 * later edits stay private until an admin publishes again.
 */
export async function getPublicLeaderboard(ctx: Ctx): Promise<{ published: false } | { published: true; publishedAt: number; rows: PublicRow[] }> {
  const latest = (await ctx.db.select().from(leaderboardPublications).orderBy(desc(leaderboardPublications.createdAt)).limit(1))[0];
  if (!latest || latest.action !== "PUBLISH" || !latest.snapshotJson) return { published: false };
  return { published: true, publishedAt: latest.createdAt, rows: JSON.parse(latest.snapshotJson) as PublicRow[] };
}
