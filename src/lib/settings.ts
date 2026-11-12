import { z } from "zod";
import type { Ctx } from "./ctx";
import { eventSettings } from "./db/schema";

const iso = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date and time.");

export const settingsSchema = z.object({
  phase1OpenAt: iso,
  phase1CloseAt: iso,
  shortlistAnnouncement: z.string().max(80),
  phase2OpenAt: iso,
  phase2CloseAt: iso,
  eventStartAt: iso,
  venue: z.string().min(2).max(160),
  feeBdt: z.number().int().min(0).max(100000),
  bkashNumber: z.string().max(40),
  nagadNumber: z.string().max(40),
  screenshotRequired: z.boolean(),
  allowResubmission: z.boolean(),
  shortlistCapacity: z.number().int().min(1).max(500),
  contactEmail: z.string().max(120),
  contactPhone: z.string().max(40),
  domains: z.array(z.object({ title: z.string().min(1).max(80), description: z.string().max(400) })).max(12),
  organisers: z.array(z.object({ name: z.string().min(1).max(80), role: z.string().max(120) })).max(30),
});

export type Settings = z.infer<typeof settingsSchema>;

/**
 * Defaults come from the event brief. Payment numbers, contacts and organiser
 * names are deliberately blank: they must be entered in Admin -> Settings.
 */
export const DEFAULT_SETTINGS: Settings = {
  phase1OpenAt: "2026-11-12T00:00:00+06:00",
  phase1CloseAt: "2026-11-18T23:59:59+06:00",
  shortlistAnnouncement: "19–20 November 2026",
  phase2OpenAt: "2026-11-21T00:00:00+06:00",
  phase2CloseAt: "2026-11-23T23:59:59+06:00",
  eventStartAt: "2026-11-24T09:00:00+06:00",
  venue: "Comilla University, Cumilla, Bangladesh",
  feeBdt: 1350,
  bkashNumber: "",
  nagadNumber: "",
  screenshotRequired: false,
  allowResubmission: true,
  shortlistCapacity: 30,
  contactEmail: "",
  contactPhone: "",
  domains: [
    { title: "Healthcare & Wellbeing", description: "AI that helps people get diagnosed earlier, treated better or cared for more easily." },
    { title: "Education & Learning", description: "Tools that personalise learning, support teachers or widen access to knowledge." },
    { title: "Agriculture & Food", description: "Smarter farming, crop health, supply chains and food security." },
    { title: "Climate & Environment", description: "Disaster readiness, energy, pollution and sustainable cities." },
    { title: "Finance & Inclusion", description: "Safer payments, fairer credit and services for people the system leaves out." },
    { title: "Open Innovation", description: "A problem you care about that does not fit a box. Make the case for it." },
  ],
  organisers: [],
};

export async function getSettings(ctx: Ctx): Promise<Settings> {
  const rows = await ctx.db.select().from(eventSettings);
  const stored: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      stored[row.key] = JSON.parse(row.valueJson);
    } catch {
      /* ignore a corrupt value and fall back to the default */
    }
  }
  const merged = { ...DEFAULT_SETTINGS, ...stored };
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export function settingsUpserts(ctx: Ctx, patch: Partial<Settings>, adminId: string | null) {
  const now = ctx.now();
  return Object.entries(patch).map(([key, value]) =>
    ctx.db
      .insert(eventSettings)
      .values({ key, valueJson: JSON.stringify(value), updatedBy: adminId, updatedAt: now })
      .onConflictDoUpdate({ target: eventSettings.key, set: { valueJson: JSON.stringify(value), updatedBy: adminId, updatedAt: now } }),
  );
}

export const PRIZES = [
  { position: "CHAMPION", label: "Champion", amountBdt: 10000 },
  { position: "FIRST_RUNNER_UP", label: "First Runner-up", amountBdt: 8000 },
  { position: "SECOND_RUNNER_UP", label: "Second Runner-up", amountBdt: 7000 },
] as const;
