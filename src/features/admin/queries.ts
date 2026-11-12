import { and, asc, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import type { Ctx } from "@/lib/ctx";
import { attendance, emailOutbox, ideaReviews, ideaSubmissions, participants, payments, teams, type TeamStatus } from "@/lib/db/schema";

export const PAGE_SIZE = 25;

export async function dashboardStats(ctx: Ctx) {
  const [byStatus, bySize, people, unis, trend, pays, mail, present] = await Promise.all([
    ctx.db.select({ status: teams.status, n: sql<number>`count(*)` }).from(teams).groupBy(teams.status),
    ctx.db.select({ size: teams.size, n: sql<number>`count(*)` }).from(teams).groupBy(teams.size),
    ctx.db.select({ n: sql<number>`count(*)` }).from(participants),
    ctx.db.select({ university: sql<string>`min(${participants.university})`, n: sql<number>`count(*)` }).from(participants).groupBy(participants.universityNorm).orderBy(desc(sql`count(*)`)).limit(12),
    ctx.db
      .select({ day: sql<string>`strftime('%Y-%m-%d', ${teams.createdAt} / 1000 + 6 * 3600, 'unixepoch')`, n: sql<number>`count(*)` })
      .from(teams)
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    ctx.db.select({ status: payments.status, n: sql<number>`count(*)` }).from(payments).groupBy(payments.status),
    ctx.db.select({ status: emailOutbox.status, n: sql<number>`count(*)` }).from(emailOutbox).groupBy(emailOutbox.status),
    ctx.db.select({ n: sql<number>`count(*)` }).from(attendance),
  ]);
  const count = <T extends { n: number }>(rows: T[], pick: (r: T) => boolean) => rows.filter(pick).reduce((a, r) => a + r.n, 0);
  return {
    teams: count(byStatus, () => true),
    participants: people[0]?.n ?? 0,
    solo: count(bySize, (r) => r.size === 1),
    duo: count(bySize, (r) => r.size === 2),
    trio: count(bySize, (r) => r.size === 3),
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.n])) as Partial<Record<TeamStatus, number>>,
    universities: unis,
    trend,
    payments: Object.fromEntries(pays.map((r) => [r.status, r.n])) as Record<string, number>,
    email: Object.fromEntries(mail.map((r) => [r.status, r.n])) as Record<string, number>,
    checkedIn: present[0]?.n ?? 0,
  };
}

export interface TeamFilters {
  q?: string;
  university?: string;
  size?: string;
  status?: string;
  page?: number;
  sort?: string;
}

function teamWhere(f: TeamFilters): SQL | undefined {
  const parts: (SQL | undefined)[] = [];
  const q = f.q?.trim();
  if (q) {
    const pattern = `%${q.replace(/[%_]/g, "")}%`;
    parts.push(
      or(
        like(teams.name, pattern),
        like(teams.registrationId, pattern.toUpperCase()),
        sql`exists (select 1 from participants p where p.team_id = ${teams.id} and (p.full_name like ${pattern} or p.email like ${pattern.toLowerCase()} or p.student_id like ${pattern}))`,
        sql`exists (select 1 from idea_submissions i where i.team_id = ${teams.id} and i.title like ${pattern})`,
      ),
    );
  }
  if (f.university) parts.push(sql`exists (select 1 from participants p where p.team_id = ${teams.id} and p.university_norm = ${f.university})`);
  if (f.size && ["1", "2", "3"].includes(f.size)) parts.push(eq(teams.size, Number(f.size)));
  if (f.status) parts.push(eq(teams.status, f.status as TeamStatus));
  return parts.length ? and(...parts) : undefined;
}

export async function listTeams(ctx: Ctx, f: TeamFilters) {
  const where = teamWhere(f);
  const page = Math.max(1, f.page ?? 1);
  const order =
    f.sort === "score" ? [sql`${teams.reviewScoreAvg} is null`, desc(teams.reviewScoreAvg), asc(teams.createdAt)] : f.sort === "name" ? [asc(teams.nameNorm)] : f.sort === "oldest" ? [asc(teams.createdAt)] : [desc(teams.createdAt)];
  const [rows, total] = await Promise.all([
    ctx.db
      .select({
        id: teams.id,
        registrationId: teams.registrationId,
        name: teams.name,
        size: teams.size,
        status: teams.status,
        isCandidate: teams.isShortlistCandidate,
        score: teams.reviewScoreAvg,
        reviewCount: teams.reviewCount,
        createdAt: teams.createdAt,
        ideaTitle: ideaSubmissions.title,
        universities: sql<string>`(select group_concat(distinct university) from participants p where p.team_id = ${teams.id})`,
      })
      .from(teams)
      .leftJoin(ideaSubmissions, eq(ideaSubmissions.teamId, teams.id))
      .where(where)
      .orderBy(...order)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    ctx.db.select({ n: sql<number>`count(*)` }).from(teams).where(where),
  ]);
  return { rows, total: total[0]?.n ?? 0, page, pageSize: PAGE_SIZE };
}

export async function universityOptions(ctx: Ctx) {
  return ctx.db
    .select({ value: participants.universityNorm, label: sql<string>`min(${participants.university})`, n: sql<number>`count(*)` })
    .from(participants)
    .groupBy(participants.universityNorm)
    .orderBy(asc(participants.universityNorm));
}

export async function teamDetail(ctx: Ctx, teamId: string) {
  const team = (await ctx.db.select().from(teams).where(eq(teams.id, teamId)).limit(1))[0];
  if (!team) return null;
  const [members, idea, reviews, pays, mail, present] = await Promise.all([
    ctx.db.select().from(participants).where(eq(participants.teamId, teamId)).orderBy(asc(participants.position)),
    ctx.db.select().from(ideaSubmissions).where(eq(ideaSubmissions.teamId, teamId)).limit(1),
    ctx.db.select().from(ideaReviews).where(eq(ideaReviews.teamId, teamId)),
    ctx.db.select().from(payments).where(eq(payments.teamId, teamId)).orderBy(desc(payments.createdAt)),
    ctx.db.select().from(emailOutbox).where(eq(emailOutbox.teamId, teamId)).orderBy(desc(emailOutbox.createdAt)),
    ctx.db.select().from(attendance).where(eq(attendance.teamId, teamId)),
  ]);
  return { team, members, idea: idea[0] ?? null, reviews, payments: pays, emails: mail, attendance: present };
}

/** All rows for CSV export, ordered by registration time. */
export async function exportRows(ctx: Ctx, statuses?: TeamStatus[]) {
  return ctx.db
    .select({
      registrationId: teams.registrationId,
      teamName: teams.name,
      teamSize: teams.size,
      status: teams.status,
      reviewScore: teams.reviewScoreAvg,
      registeredAt: teams.createdAt,
      ideaTitle: ideaSubmissions.title,
      position: participants.position,
      fullName: participants.fullName,
      email: participants.email,
      phone: participants.phone,
      whatsapp: participants.whatsapp,
      university: participants.university,
      studentId: participants.studentId,
      tshirtSize: participants.tshirtSize,
    })
    .from(teams)
    .innerJoin(participants, eq(participants.teamId, teams.id))
    .leftJoin(ideaSubmissions, eq(ideaSubmissions.teamId, teams.id))
    .where(statuses ? inArray(teams.status, statuses) : undefined)
    .orderBy(asc(teams.createdAt), asc(participants.position));
}
