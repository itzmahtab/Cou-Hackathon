import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Ctx } from "@/lib/ctx";
import { adminActivityLogs, ideaReviews, teams, type Admin } from "@/lib/db/schema";
import { AppError } from "@/lib/http";
import { uuid } from "@/lib/ids";
import { activityRow } from "@/lib/auth/session";

export const CRITERIA = [
  { key: "scoreRelevance", label: "Problem relevance", max: 20 },
  { key: "scoreInnovation", label: "Innovation", max: 25 },
  { key: "scoreAi", label: "AI application", max: 25 },
  { key: "scoreFeasibility", label: "Feasibility", max: 15 },
  { key: "scoreImpact", label: "Potential impact", max: 15 },
] as const;

const score = (max: number, label: string) =>
  z.coerce.number({ error: `${label} is required.` }).int(`${label} must be a whole number.`).min(0, `${label} cannot be negative.`).max(max, `${label} is out of ${max}.`);

export const reviewSchema = z.object({
  scoreRelevance: score(20, "Problem relevance"),
  scoreInnovation: score(25, "Innovation"),
  scoreAi: score(25, "AI application"),
  scoreFeasibility: score(15, "Feasibility"),
  scoreImpact: score(15, "Potential impact"),
  notes: z.string().max(4000).optional().default(""),
});

export type ReviewInput = z.infer<typeof reviewSchema>;

export const totalScore = (r: Pick<ReviewInput, "scoreRelevance" | "scoreInnovation" | "scoreAi" | "scoreFeasibility" | "scoreImpact">) =>
  r.scoreRelevance + r.scoreInnovation + r.scoreAi + r.scoreFeasibility + r.scoreImpact;

export function meanScore(totals: number[]): number | null {
  if (totals.length === 0) return null;
  return Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 100) / 100;
}

/** One review per reviewer per team; saving again replaces it. Locked once the team leaves review. */
export async function saveReview(ctx: Ctx, admin: Admin, teamId: string, input: ReviewInput) {
  const team = (await ctx.db.select({ status: teams.status }).from(teams).where(eq(teams.id, teamId)).limit(1))[0];
  if (!team) throw new AppError(404, "NOT_FOUND", "Team not found.");
  if (team.status !== "SUBMITTED" && team.status !== "UNDER_REVIEW") {
    throw new AppError(409, "INVALID_TRANSITION", "Reviews are locked for this team because the shortlist has been finalised.");
  }
  const now = ctx.now();
  const total = totalScore(input);
  const values = {
    scoreRelevance: input.scoreRelevance,
    scoreInnovation: input.scoreInnovation,
    scoreAi: input.scoreAi,
    scoreFeasibility: input.scoreFeasibility,
    scoreImpact: input.scoreImpact,
    total,
    notes: input.notes?.trim() || null,
    updatedAt: now,
  };
  await ctx.db.batch([
    ctx.db
      .insert(ideaReviews)
      .values({ id: uuid(), teamId, reviewerId: admin.id, createdAt: now, ...values })
      .onConflictDoUpdate({ target: [ideaReviews.teamId, ideaReviews.reviewerId], set: values }),
    ctx.db
      .update(teams)
      .set({
        reviewScoreAvg: sql`(select round(avg(total), 2) from idea_reviews where team_id = ${teamId})`,
        reviewCount: sql`(select count(*) from idea_reviews where team_id = ${teamId})`,
        status: sql`case when ${teams.status} = 'SUBMITTED' then 'UNDER_REVIEW' else ${teams.status} end`,
        updatedAt: now,
      })
      .where(eq(teams.id, teamId)),
    ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "review.save", entityType: "team", entityId: teamId, detail: { total } })),
  ]);
  return { total };
}
