import { eq } from "drizzle-orm";
import type { Ctx } from "@/lib/ctx";
import { adminActivityLogs, emailOutbox, eventSettings } from "@/lib/db/schema";
import { activityRow } from "@/lib/auth/session";

/**
 * The master email switch (Admin -> Emails). While it is off nothing is sent: the
 * outbox sender cancels every queued email instead of delivering it, and cancelled
 * emails stay cancelled when the switch goes back on (resend them one by one if needed).
 */
const KEY = "emailEnabled";
export const CANCELLED_NOTE = "Cancelled: email sending was turned off.";

export async function isEmailEnabled(ctx: Ctx): Promise<boolean> {
  const row = (await ctx.db.select({ value: eventSettings.valueJson }).from(eventSettings).where(eq(eventSettings.key, KEY)).limit(1))[0];
  if (!row) return true;
  try {
    return JSON.parse(row.value) !== false;
  } catch {
    return true;
  }
}

/** Marks every queued email as given up, so none of them is ever sent. Returns how many. */
export async function cancelQueuedEmails(ctx: Ctx): Promise<number> {
  const rows = await ctx.db
    .update(emailOutbox)
    .set({ status: "DEAD", lastError: CANCELLED_NOTE, updatedAt: ctx.now() })
    .where(eq(emailOutbox.status, "QUEUED"))
    .returning({ id: emailOutbox.id });
  return rows.length;
}

export async function setEmailEnabled(ctx: Ctx, enabled: boolean, adminId: string): Promise<{ cancelled: number }> {
  const now = ctx.now();
  await ctx.db.batch([
    ctx.db
      .insert(eventSettings)
      .values({ key: KEY, valueJson: JSON.stringify(enabled), updatedBy: adminId, updatedAt: now })
      .onConflictDoUpdate({ target: eventSettings.key, set: { valueJson: JSON.stringify(enabled), updatedBy: adminId, updatedAt: now } }),
    ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId, action: enabled ? "emails.enabled" : "emails.disabled" })),
  ]);
  return { cancelled: enabled ? 0 : await cancelQueuedEmails(ctx) };
}
