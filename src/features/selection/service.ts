import { and, asc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Ctx } from "@/lib/ctx";
import { activityRow } from "@/lib/auth/session";
import { adminActivityLogs, emailOutbox, eventSettings, ideaSubmissions, participants, shortlistSelections, teams, type Admin } from "@/lib/db/schema";
import { getSettings, type Settings } from "@/lib/settings";
import { formatDhaka, formatDhakaDate } from "@/lib/time";
import { AppError } from "@/lib/http";
import { enqueue, type OutboxEntry } from "../email/outbox";
import { promoteFromWaitlist, setCandidate, setWaitlistPosition } from "../shortlist/service";
import { DEFAULT_PAYMENT_TEMPLATE, DEFAULT_SELECTION_TEMPLATE, joinNames, renderSelectionEmail, safeUrl, type SelectionTemplate, type TemplateVars } from "./template";

/** The two editable emails and where each is stored. */
export type TemplateKind = "selection" | "payment";
const TEMPLATES: Record<TemplateKind, { key: string; defaults: SelectionTemplate; log: string }> = {
  selection: { key: "selectionEmailTemplate", defaults: DEFAULT_SELECTION_TEMPLATE, log: "settings.selection_template" },
  payment: { key: "paymentEmailTemplate", defaults: DEFAULT_PAYMENT_TEMPLATE, log: "settings.payment_template" },
};
/** Written on the shortlist history when a team is rejected in the final review. */
export const REJECTED_NOTE = "Final review: rejected";

const link = (label: string) => z.string().trim().max(300).refine((u) => safeUrl(u) !== null, `${label}: enter a full link starting with https://`);
/** New fields default (to that email's defaults), so a template saved before they existed still loads. */
export function templateSchema(D: SelectionTemplate) {
  return z.object({
    design: z.enum(["technova", "classic"]).default(D.design),
    emoji: z.string().trim().max(16).default(D.emoji),
    subject: z.string().trim().min(1, "Enter a subject.").max(300),
    headline: z.string().trim().max(120).default(D.headline),
    subheadline: z.string().trim().max(160).default(D.subheadline),
    body: z.string().trim().min(1, "Enter the message.").max(8000),
    telegramNote: z.string().trim().max(1000).default(D.telegramNote),
    telegramLabel: z.string().trim().max(60).default(D.telegramLabel),
    websiteCaption: z.string().trim().max(160).default(D.websiteCaption),
    classicSubject: z.string().trim().min(1, "Enter a subject.").max(300).default(D.classicSubject),
    classicHeading: z.string().trim().max(200).default(D.classicHeading),
    classicBody: z.string().trim().min(1, "Enter the message.").max(8000).default(D.classicBody),
    classicTelegramLabel: z.string().trim().max(60).default(D.classicTelegramLabel),
    classicRulebookLabel: z.string().trim().max(60).default(D.classicRulebookLabel),
    classicWebsiteLabel: z.string().trim().max(60).default(D.classicWebsiteLabel),
    helplineEmail: z.string().trim().max(120).refine((v) => v === "" || /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(v), "Enter a valid helpline email.").default(D.helplineEmail),
    telegramLink: link("Telegram link"),
    websiteLink: link("Website link").default(D.websiteLink),
    rulebookLink: link("Rulebook link").default(D.rulebookLink),
  });
}
export const selectionTemplateSchema = templateSchema(DEFAULT_SELECTION_TEMPLATE);
export type TemplateInput = z.input<typeof selectionTemplateSchema>;

export async function getTemplate(ctx: Ctx, kind: TemplateKind): Promise<SelectionTemplate> {
  const { key, defaults } = TEMPLATES[kind];
  const row = (await ctx.db.select().from(eventSettings).where(eq(eventSettings.key, key)).limit(1))[0];
  if (!row) return defaults;
  try {
    const parsed = templateSchema(defaults).safeParse(JSON.parse(row.valueJson));
    return parsed.success ? parsed.data : defaults;
  } catch {
    return defaults;
  }
}

export async function saveTemplate(ctx: Ctx, admin: Admin, kind: TemplateKind, input: TemplateInput) {
  const { key, defaults, log } = TEMPLATES[kind];
  const value = templateSchema(defaults).parse(input);
  const now = ctx.now();
  await ctx.db.batch([
    ctx.db
      .insert(eventSettings)
      .values({ key, valueJson: JSON.stringify(value), updatedBy: admin.id, updatedAt: now })
      .onConflictDoUpdate({ target: eventSettings.key, set: { valueJson: JSON.stringify(value), updatedBy: admin.id, updatedAt: now } }),
    ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: log })),
  ]);
  return value;
}

export const getSelectionTemplate = (ctx: Ctx) => getTemplate(ctx, "selection");
export const saveSelectionTemplate = (ctx: Ctx, admin: Admin, input: TemplateInput) => saveTemplate(ctx, admin, "selection", input);

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
  return { ...data, settings, tpl, assetBase: ctx.env.APP_URL };
}

/** The filled-in email for one team. */
export function renderForTeam(team: SelectionTeam, settings: Settings, tpl: SelectionTemplate, assetBase: string) {
  return renderSelectionEmail(tpl, templateVars(team, settings, tpl), { members: team.members.map((m) => m.fullName), assetBase });
}

/* ------------------------------------------------------------------ */
/* Sending to every selected team (only when an admin presses the button) */
/* ------------------------------------------------------------------ */

const SEND_TEMPLATE = "final_selection" as const;

/** How many selection emails exist per status, plus how many selected participants have none yet. */
export async function selectionSendStatus(ctx: Ctx) {
  const { selected } = await finalSelection(ctx);
  const participants = selected.reduce((n, t) => n + t.members.length, 0);
  const rows = await ctx.db
    .select({ status: emailOutbox.status, n: sql<number>`count(*)` })
    .from(emailOutbox)
    .where(eq(emailOutbox.template, SEND_TEMPLATE))
    .groupBy(emailOutbox.status);
  const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number>;
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  return { teams: selected.length, participants, byStatus, total };
}

/**
 * Queues one personalised selection email per member of every selected team, from the
 * portal's sender (EMAIL_FROM). Each member gets it at most once, however often this runs.
 */
/** Queues the selection email for every member of the given teams; each member gets it at most once. */
async function queueSelectionFor(ctx: Ctx, admin: Admin, list: SelectionTeam[], settings: Settings, tpl: SelectionTemplate) {
  const entries: OutboxEntry[] = [];
  for (const team of list) {
    // Rendered by the "final_selection" email template when sent, through the same escaping renderer.
    const payload = { tpl, vars: templateVars(team, settings, tpl), members: team.members.map((m) => m.fullName), assetBase: ctx.env.APP_URL };
    for (const m of team.members) entries.push({ template: SEND_TEMPLATE, to: m.email, dedupe: `${team.id}:${m.email.toLowerCase()}`, teamId: team.id, payload, requestedBy: admin.id });
  }
  const count = async () => (await ctx.db.select({ n: sql<number>`count(*)` }).from(emailOutbox).where(eq(emailOutbox.template, SEND_TEMPLATE)))[0]?.n ?? 0;
  const before = await count();
  await enqueue(ctx, entries);
  const queued = (await count()) - before;
  return { recipients: entries.length, queued };
}

/**
 * Queues one personalised selection email per member of every selected team, from the
 * portal's sender (EMAIL_FROM). Each member gets it at most once, however often this runs.
 */
export async function sendSelectionEmails(ctx: Ctx, admin: Admin) {
  const { selected, settings, tpl } = await selectionContext(ctx);
  const { recipients, queued } = await queueSelectionFor(ctx, admin, selected, settings, tpl);
  await ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "emails.final_selection", detail: { teams: selected.length, recipients, queued } }));
  return { teams: selected.length, recipients, queued, skipped: recipients - queued };
}

export const WAITLIST_PROMOTION_NOTE = "Promoted from the waitlist in the final review";

/**
 * Moves one waiting team onto the selected list (an override if the list is already full)
 * and emails the selection email to its members. Only runs when an admin presses that team's button.
 */
export async function selectFromWaitlistAndEmail(ctx: Ctx, admin: Admin, teamId: string) {
  const { waiting } = await finalSelection(ctx);
  const team = waiting.find((t) => t.id === teamId);
  if (!team) throw new AppError(409, "INVALID_TRANSITION", "This team is not on the waiting list.");
  await promoteFromWaitlist(ctx, admin, teamId, WAITLIST_PROMOTION_NOTE);
  const [settings, tpl] = await Promise.all([getSettings(ctx), getTemplate(ctx, "selection")]);
  const { recipients, queued } = await queueSelectionFor(ctx, admin, [team], settings, tpl);
  await ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "emails.selection_waitlist", entityType: "team", entityId: team.id, detail: { recipients, queued } }));
  return { team: team.name, recipients, queued };
}

/* ------------------------------------------------------------------ */
/* Payment confirmation, sent one team at a time by an admin           */
/* ------------------------------------------------------------------ */

const PAYMENT_TEMPLATE = "payment_confirmation" as const;

/** Per team: how many payment-confirmation emails are sent, queued or failed. */
export async function paymentEmailStatus(ctx: Ctx): Promise<Record<string, { sent: number; queued: number; failed: number }>> {
  const rows = await ctx.db
    .select({ teamId: emailOutbox.teamId, status: emailOutbox.status, n: sql<number>`count(*)` })
    .from(emailOutbox)
    .where(eq(emailOutbox.template, PAYMENT_TEMPLATE))
    .groupBy(emailOutbox.teamId, emailOutbox.status);
  const out: Record<string, { sent: number; queued: number; failed: number }> = {};
  for (const r of rows) {
    if (!r.teamId) continue;
    const s = (out[r.teamId] ??= { sent: 0, queued: 0, failed: 0 });
    if (r.status === "SENT") s.sent += r.n;
    else if (r.status === "DEAD") s.failed += r.n;
    else s.queued += r.n;
  }
  return out;
}

/**
 * Queues the payment-confirmed email for every member of one selected team. Each member
 * gets it at most once; pressing again only emails members who have not had it.
 */
export async function sendPaymentConfirmation(ctx: Ctx, admin: Admin, teamId: string) {
  const [{ selected }, settings, tpl] = await Promise.all([finalSelection(ctx), getSettings(ctx), getTemplate(ctx, "payment")]);
  const team = selected.find((t) => t.id === teamId);
  if (!team) throw new AppError(404, "NOT_FOUND", "This team is not on the final selection list.");
  const payload = { tpl, vars: templateVars(team, settings, tpl), members: team.members.map((m) => m.fullName), assetBase: ctx.env.APP_URL };
  const entries: OutboxEntry[] = team.members.map((m) => ({ template: PAYMENT_TEMPLATE, to: m.email, dedupe: `${team.id}:${m.email.toLowerCase()}`, teamId: team.id, payload, requestedBy: admin.id }));
  const count = async () => (await ctx.db.select({ n: sql<number>`count(*)` }).from(emailOutbox).where(and(eq(emailOutbox.template, PAYMENT_TEMPLATE), eq(emailOutbox.teamId, team.id))))[0]?.n ?? 0;
  const before = await count();
  await enqueue(ctx, entries);
  const queued = (await count()) - before;
  await ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "emails.payment_confirmation", entityType: "team", entityId: team.id, detail: { recipients: entries.length, queued } }));
  return { team: team.name, recipients: entries.length, queued };
}

/**
 * Takes a selected or waiting team off the final selection and lists it under Rejected.
 * Sends nothing. Only possible before the shortlist is finalised.
 */
export async function removeFromFinalSelection(ctx: Ctx, admin: Admin, teamId: string) {
  const { selected, waiting } = await finalSelection(ctx);
  const team = selected.find((t) => t.id === teamId) ?? waiting.find((t) => t.id === teamId);
  if (!team) throw new AppError(409, "INVALID_TRANSITION", "This team is not selected or waiting.");
  if (selected.some((t) => t.id === teamId)) await setCandidate(ctx, admin, teamId, false);
  else await setWaitlistPosition(ctx, admin, teamId, null);
  await ctx.db.batch([
    ctx.db.insert(shortlistSelections).values({ id: crypto.randomUUID(), teamId, action: "REMOVE", justification: REJECTED_NOTE, adminId: admin.id, createdAt: ctx.now() }),
    ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "shortlist.final_remove", entityType: "team", entityId: teamId })),
  ]);
  return { team: team.name };
}
