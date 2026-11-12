import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Ctx } from "@/lib/ctx";
import { admins, ideaReviews, ideaSubmissions, shortlistSelections, teams } from "@/lib/db/schema";

export async function reviewQueue(ctx: Ctx, reviewerId: string, f: { status?: string; mine?: string; sort?: string }) {
  const where = [];
  if (f.status) where.push(eq(teams.status, f.status as never));
  else where.push(inArray(teams.status, ["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "NOT_SELECTED", "CONFIRMED"]));
  const mine = sql<number | null>`(select total from idea_reviews r where r.team_id = ${teams.id} and r.reviewer_id = ${reviewerId})`;
  if (f.mine === "todo") where.push(sql`${mine} is null`);
  if (f.mine === "done") where.push(sql`${mine} is not null`);
  const order = f.sort === "oldest" ? [asc(teams.createdAt)] : f.sort === "reviews" ? [asc(teams.reviewCount), asc(teams.createdAt)] : [sql`${teams.reviewScoreAvg} is null`, desc(teams.reviewScoreAvg), asc(teams.createdAt)];
  return ctx.db
    .select({ id: teams.id, name: teams.name, registrationId: teams.registrationId, status: teams.status, score: teams.reviewScoreAvg, count: teams.reviewCount, title: ideaSubmissions.title, mine })
    .from(teams)
    .innerJoin(ideaSubmissions, eq(ideaSubmissions.teamId, teams.id))
    .where(and(...where))
    .orderBy(...order);
}

export async function ideaForReview(ctx: Ctx, teamId: string) {
  const row = (await ctx.db.select({ team: teams, idea: ideaSubmissions }).from(teams).innerJoin(ideaSubmissions, eq(ideaSubmissions.teamId, teams.id)).where(eq(teams.id, teamId)).limit(1))[0];
  if (!row) return null;
  const reviews = await ctx.db
    .select({ review: ideaReviews, reviewer: admins.name })
    .from(ideaReviews)
    .innerJoin(admins, eq(admins.id, ideaReviews.reviewerId))
    .where(eq(ideaReviews.teamId, teamId))
    .orderBy(asc(ideaReviews.createdAt));
  return { ...row, reviews };
}

export async function shortlistBoard(ctx: Ctx) {
  const [rows, history] = await Promise.all([
    ctx.db
      .select({ id: teams.id, name: teams.name, registrationId: teams.registrationId, status: teams.status, isCandidate: teams.isShortlistCandidate, score: teams.reviewScoreAvg, count: teams.reviewCount, size: teams.size, title: ideaSubmissions.title })
      .from(teams)
      .innerJoin(ideaSubmissions, eq(ideaSubmissions.teamId, teams.id))
      .where(inArray(teams.status, ["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "NOT_SELECTED", "CONFIRMED"]))
      .orderBy(sql`${teams.reviewScoreAvg} is null`, desc(teams.reviewScoreAvg), asc(teams.createdAt)),
    ctx.db
      .select({ s: shortlistSelections, admin: admins.name, team: teams.name })
      .from(shortlistSelections)
      .innerJoin(admins, eq(admins.id, shortlistSelections.adminId))
      .leftJoin(teams, eq(teams.id, shortlistSelections.teamId))
      .orderBy(desc(shortlistSelections.createdAt))
      .limit(50),
  ]);
  return { rows, history };
}
