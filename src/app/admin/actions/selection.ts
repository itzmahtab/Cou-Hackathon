"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, runAction, type ActionResult } from "@/lib/server";
import { z } from "zod";
import { removeFromFinalSelection, saveTemplate, selectFromWaitlistAndEmail, sendPaymentConfirmation, sendSelectionEmails, type TemplateInput } from "@/features/selection/service";
import { drainOutbox } from "@/features/email/outbox";
import { runAfter } from "@/lib/ctx";

const FIELDS = ["emoji", "subject", "headline", "subheadline", "body", "telegramNote", "telegramLabel", "websiteCaption", "classicSubject", "classicHeading", "classicBody", "classicTelegramLabel", "classicRulebookLabel", "classicWebsiteLabel", "helplineEmail", "telegramLink", "websiteLink", "rulebookLink"] as const;

/** Reads the template editor's form. */
function templateFromForm(fd: FormData): TemplateInput {
  const out: Record<string, string> = {};
  for (const k of FIELDS) out[k] = String(fd.get(k) ?? "");
  return { ...(out as Omit<TemplateInput, "design">), design: fd.get("design") === "classic" ? "classic" : "technova" };
}

/** Saves the selection email template. Nothing is emailed. */
export async function saveSelectionTemplateAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("emails.manage");
    await saveTemplate(ctx, admin, "selection", templateFromForm(fd));
    revalidatePath("/admin/emails");
    revalidatePath("/admin/final-selection");
    return { message: "Template saved. Nothing was emailed." };
  });
}

/** Saves the payment-confirmed email template. Nothing is emailed. */
export async function savePaymentTemplateAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("emails.manage");
    await saveTemplate(ctx, admin, "payment", templateFromForm(fd));
    revalidatePath("/admin/emails");
    return { message: "Template saved. Nothing was emailed." };
  });
}

/** Emails the payment confirmation to one team's members (only when an admin presses that team's button). */
export async function sendPaymentConfirmationAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("emails.manage");
    const teamId = z.string().uuid().parse(fd.get("teamId"));
    const res = await sendPaymentConfirmation(ctx, admin, teamId);
    if (res.queued) runAfter(drainOutbox(ctx));
    revalidatePath("/admin/emails");
    return { message: res.queued ? `Sending to ${res.queued} member(s) of ${res.team}.` : `${res.team} already has this email. Nothing new was sent.` };
  });
}

/**
 * Queues the selection email for every member of every selected team, sent from the
 * portal's Gmail address. Super admins only, behind a typed confirmation; each member
 * is emailed at most once even if this is pressed again.
 */
export async function sendSelectionEmailsAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("emails.broadcast");
    if (fd.get("confirm") !== "SEND") throw new Error("Confirmation phrase missing.");
    const res = await sendSelectionEmails(ctx, admin);
    if (res.queued) runAfter(drainOutbox(ctx));
    revalidatePath("/admin/emails");
    return {
      message: res.queued
        ? `Queued ${res.queued} email(s) to the ${res.teams} selected teams. They go out over the next few minutes.${res.skipped ? ` ${res.skipped} member(s) already had this email and were skipped.` : ""}`
        : `Nothing new to send: all ${res.recipients} members of the ${res.teams} selected teams already have this email.`,
    };
  });
}

/** Selects one waiting team for the final and emails it the selection email (super admins only). */
export async function selectFromWaitlistAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("emails.broadcast");
    const teamId = z.string().uuid().parse(fd.get("teamId"));
    const res = await selectFromWaitlistAndEmail(ctx, admin, teamId);
    if (res.queued) runAfter(drainOutbox(ctx));
    revalidatePath("/admin", "layout");
    return { message: `${res.team} is now selected. Sending the selection email to ${res.queued} member(s).` };
  });
}

/** Removes a team from the final selection (moves it to Rejected). Sends nothing. */
export async function removeFromFinalSelectionAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("shortlist.manage");
    const teamId = z.string().uuid().parse(fd.get("teamId"));
    const res = await removeFromFinalSelection(ctx, admin, teamId);
    revalidatePath("/admin", "layout");
    return { message: `${res.team} was removed from the final selection. No email was sent.` };
  });
}
