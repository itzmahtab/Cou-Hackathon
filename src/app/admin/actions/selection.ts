"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, runAction, type ActionResult } from "@/lib/server";
import { saveSelectionTemplate, sendSelectionEmails } from "@/features/selection/service";
import { drainOutbox } from "@/features/email/outbox";
import { runAfter } from "@/lib/ctx";

/** Saves the hand-sent selection email template. Nothing is emailed. */
export async function saveSelectionTemplateAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("emails.manage");
    const f = (k: string) => String(fd.get(k) ?? "");
    await saveSelectionTemplate(ctx, admin, {
      design: f("design") === "classic" ? "classic" : "technova",
      subject: f("subject"),
      headline: f("headline"),
      subheadline: f("subheadline"),
      body: f("body"),
      telegramNote: f("telegramNote"),
      telegramLabel: f("telegramLabel"),
      websiteCaption: f("websiteCaption"),
      classicSubject: f("classicSubject"),
      classicHeading: f("classicHeading"),
      classicBody: f("classicBody"),
      classicTelegramLabel: f("classicTelegramLabel"),
      classicRulebookLabel: f("classicRulebookLabel"),
      classicWebsiteLabel: f("classicWebsiteLabel"),
      helplineEmail: f("helplineEmail"),
      telegramLink: f("telegramLink"),
      websiteLink: f("websiteLink"),
      rulebookLink: f("rulebookLink"),
    });
    revalidatePath("/admin/emails");
    revalidatePath("/admin/final-selection");
    return { message: "Template saved. Nothing was emailed." };
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
