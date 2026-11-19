import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Ctx } from "@/lib/ctx";
import { activityRow } from "@/lib/auth/session";
import { adminActivityLogs, eventSettings, ideaSubmissions, participants, shortlistSelections, teams, type Admin } from "@/lib/db/schema";
import { getSettings, type Settings } from "@/lib/settings";
import { formatDhaka, formatDhakaDate } from "@/lib/time";
import { DEFAULT_SELECTION_TEMPLATE, joinNames, renderSelectionEmail, safeUrl, type SelectionTemplate, type TemplateVars } from "./template";

const TEMPLATE_KEY = "selectionEmailTemplate";
/** Written on the shortlist history when a team is rejected in the final review. */
export const REJECTED_NOTE = "Final review: rejected";

const link = (label: string) => z.string().trim().max(300).refine((u) => safeUrl(u) !== null, `${label}: enter a full link starting with https://`);
const D = DEFAULT_SELECTION_TEMPLATE;
/** New fields default, so a template saved before they existed still loads. */
export const selectionTemplateSchema = z.object({
  subject: z.string().trim().min(1, "Enter a subject.").max(300),
  headline: z.string().trim().max(120).default(D.headline),
  subheadline: z.string().trim().max(160).default(D.subheadline),
  body: z.string().trim().min(1, "Enter the message.").max(8000),
  telegramNote: z.string().trim().max(1000).default(D.telegramNote),
  telegramLabel: z.string().trim().max(60).default(D.telegramLabel),
  websiteCaption: z.string().trim().max(160).default(D.websiteCaption),
  helplineEmail: z.string().trim().max(120).refine((v) => v === "" || /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(v), "Enter a valid helpline email.").default(D.helplineEmail),
  telegramLink: link("Telegram link"),
  websiteLink: link("Website link").default(D.websiteLink),
  rulebookLink: link("Rulebook link").default(D.rulebookLink),
});

export async function getSelectionTemplate(ctx: Ctx): Promise<SelectionTemplate> {
  const row = (await ctx.db.select().from(eventSettings).where(eq(eventSettings.key, TEMPLATE_KEY)).limit(1))[0];
  if (!row) return DEFAULT_SELECTION_TEMPLATE;
  try {
    const parsed = selectionTemplateSchema.safeParse(JSON.parse(row.valueJson));
    return parsed.success ? parsed.data : DEFAULT_SELECTION_TEMPLATE;
  } catch {
    return DEFAULT_SELECTION_TEMPLATE;
  }
}

export async function saveSelectionTemplate(ctx: Ctx, admin: Admin, input: z.input<typeof selectionTemplateSchema>) {
  const value = selectionTemplateSchema.parse(input);
  const now = ctx.now();
  await ctx.db.batch([
    ctx.db
      .insert(eventSettings)
      .values({ key: TEMPLATE_KEY, valueJson: JSON.stringify(value), updatedBy: admin.id, updatedAt: now })
      .onConflictDoUpdate({ target: eventSettings.key, set: { valueJson: JSON.stringify(value), updatedBy: admin.id, updatedAt: now } }),
    ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "settings.selection_template" })),
  ]);
  return value;
}

export interface SelectionMember {
  position: number;
  fullName: string;
  email: string;
  phone: string;
  whatsapp: string;
  university: string;
}

export interface SelectionTeam {
  id: string;
  registrationId: string;
  name: string;
  status: string;
  score: number | null;
  title: string;
  waitlist: number | null;
  members: SelectionMember[];
}

/** Values every team shares (from Settings) plus the team's own. */
export function templateVars(team: SelectionTeam, settings: Settings, tpl: SelectionTemplate): TemplateVars {
  const names = team.members.map((m) => m.fullName);
  return {
    teamName: team.name,
    registrationId: team.registrationId,
    ideaTitle: team.title,
    leaderName: team.members.find((m) => m.position === 1)?.fullName ?? names[0] ?? "",
    memberNames: joinNames(names),
    telegramLink: tpl.telegramLink,
    rulebookLink: tpl.rulebookLink,
    websiteLink: tpl.websiteLink,
    feeBdt: String(settings.feeBdt),
    paymentDeadline: formatDhaka(settings.phase2CloseAt),
    eventDate: formatDhakaDate(settings.eventStartAt),
    venue: settings.venue,
  };
}

/**
 * The final selection as it stands on the Shortlist page: selected teams, the waitlist
 * in queue order, and teams rejected in the final review, each with every member's contacts.
 */
export async function finalSelection(ctx: Ctx) {
  // A fresh builder per query: Drizzle builders are mutable, so one cannot be reused.
  const base = () =>
    ctx.db
      .select({ id: teams.id, registrationId: teams.registrationId, name: teams.name, status: teams.status, score: teams.reviewScoreAvg, title: ideaSubmissions.title, waitlist: teams.waitlistPosition })
      .from(teams)
      .innerJoin(ideaSubmissions, eq(ideaSubmissions.teamId, teams.id));
  const [selectedRows, waitingRows, rejectedIds, all] = await Promise.all([
    base().where(eq(teams.isShortlistCandidate, true)).orderBy(asc(teams.registrationId)),
    base().where(isNotNull(teams.waitlistPosition)).orderBy(asc(teams.waitlistPosition)),
    ctx.db.selectDistinct({ id: shortlistSelections.teamId }).from(shortlistSelections).where(eq(shortlistSelections.justification, REJECTED_NOTE)),
    ctx.db.select({ id: teams.id, status: teams.status }).from(teams),
  ]);
  const rejectedSet = [...new Set(rejectedIds.map((r) => r.id).filter((id): id is string => !!id))];
  const rejectedRows = rejectedSet.length
    ? await base()
        .where(and(inArray(teams.id, rejectedSet), eq(teams.isShortlistCandidate, false), isNull(teams.waitlistPosition)))
        .orderBy(asc(teams.registrationId))
    : [];
  // Best score first, so the list reads like the shortlist sheet.
  selectedRows.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.registrationId.localeCompare(b.registrationId));

  const ids = [...selectedRows, ...waitingRows, ...rejectedRows].map((r) => r.id);
  const people = ids.length
    ? await ctx.db
        .select({ teamId: participants.teamId, position: participants.position, fullName: participants.fullName, email: participants.email, phone: participants.phone, whatsapp: participants.whatsapp, university: participants.university })
        .from(participants)
        .where(inArray(participants.teamId, ids))
        .orderBy(asc(participants.position))
    : [];
  const byTeam = new Map<string, SelectionMember[]>();
  for (const { teamId, ...m } of people) byTeam.set(teamId, [...(byTeam.get(teamId) ?? []), m]);
  const shape = (r: (typeof selectedRows)[number]): SelectionTeam => ({ ...r, members: byTeam.get(r.id) ?? [] });

  const shown = new Set(ids);
  const others = all.filter((t) => !shown.has(t.id) && t.status !== "DISQUALIFIED").length;
  return { selected: selectedRows.map(shape), waiting: waitingRows.map(shape), rejected: rejectedRows.map(shape), others };
}

export async function selectionContext(ctx: Ctx) {
  const [data, settings, tpl] = await Promise.all([finalSelection(ctx), getSettings(ctx), getSelectionTemplate(ctx)]);
  return { ...data, settings, tpl };
}

/** The filled-in email for one team. */
export function renderForTeam(team: SelectionTeam, settings: Settings, tpl: SelectionTemplate) {
  return renderSelectionEmail(tpl, templateVars(team, settings, tpl), { members: team.members.map((m) => m.fullName) });
}
