import { asc, desc, eq } from "drizzle-orm";
import type { Ctx } from "@/lib/ctx";
import { announcements, eventSchedules } from "@/lib/db/schema";
import { getSettings, type Settings } from "@/lib/settings";
import { windowState, type WindowState } from "@/lib/time";

/** Suggested running order from the brief. Times are set by the organisers in Admin -> Event. */
export const DEFAULT_SCHEDULE = [
  { title: "Registration and check-in", description: "Collect your team pass and T-shirts. Bring your student ID card." },
  { title: "Opening ceremony", description: "Welcome from the Faculty of Engineering and the sponsors." },
  { title: "Problem briefing", description: "Rules, judging criteria and how the six hours will run." },
  { title: "Hackathon starts", description: "The clock begins. Six hours to build." },
  { title: "Development and mentoring", description: "Mentors move between teams. Ask early." },
  { title: "Submission deadline", description: "Hands off keyboards. Late submissions are not judged." },
  { title: "Project presentations", description: "Each team demonstrates its solution to the judges." },
  { title: "Judging", description: "Judges score against the published criteria." },
  { title: "Award ceremony", description: "Champion, First Runner-up and Second Runner-up are announced." },
].map((item, i) => ({ id: `default-${i}`, timeLabel: "Time to be announced", sortOrder: i, ...item }));

export type ScheduleItem = { id: string; title: string; description: string | null; timeLabel: string; sortOrder: number };

export async function getSchedule(ctx: Ctx): Promise<ScheduleItem[]> {
  const rows = await ctx.db.select().from(eventSchedules).where(eq(eventSchedules.isPublished, true)).orderBy(asc(eventSchedules.sortOrder), asc(eventSchedules.createdAt));
  return rows.length ? rows : DEFAULT_SCHEDULE;
}

export async function getAnnouncements(ctx: Ctx, limit = 5) {
  return ctx.db
    .select({ id: announcements.id, title: announcements.title, body: announcements.body, publishedAt: announcements.publishedAt })
    .from(announcements)
    .where(eq(announcements.isPublished, true))
    .orderBy(desc(announcements.publishedAt))
    .limit(limit);
}

export interface Phases {
  phase1: WindowState;
  phase2: WindowState;
  /** Which of the four timeline steps is current: 0 registration, 1 review, 2 payment, 3 event day, 4 after. */
  step: number;
}

export function getPhases(settings: Settings, now: number): Phases {
  const phase1 = windowState(now, settings.phase1OpenAt, settings.phase1CloseAt);
  const phase2 = windowState(now, settings.phase2OpenAt, settings.phase2CloseAt);
  const eventStart = Date.parse(settings.eventStartAt);
  let step = 0;
  if (phase1 === "closed") step = 1;
  if (phase2 !== "before") step = 2;
  if (phase2 === "closed") step = 3;
  if (now > eventStart + 24 * 60 * 60 * 1000) step = 4;
  return { phase1, phase2, step };
}

export async function getPublicEvent(ctx: Ctx) {
  const settings = await getSettings(ctx);
  return { settings, phases: getPhases(settings, ctx.now()) };
}
