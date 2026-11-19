"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, runAction, type ActionResult } from "@/lib/server";
import { reviewSchema, saveReview } from "@/features/reviews/service";
import { finalisedAt, finaliseShortlist, promoteFromWaitlist, releaseFromWaitlist, setCandidate, setWaitlistPosition } from "@/features/shortlist/service";
import { runAfter } from "@/lib/ctx";
import { can } from "@/lib/auth/permissions";
import { AppError } from "@/lib/http";
import { drainOutbox } from "@/features/email/outbox";

export async function saveReviewAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("reviews.write");
    const teamId = z.string().uuid().parse(fd.get("teamId"));
    const { total } = await saveReview(ctx, admin, teamId, reviewSchema.parse(Object.fromEntries(fd)));
    revalidatePath("/admin/reviews");
    return { message: `Saved. Your total: ${total} / 100.` };
  });
}

export async function setCandidateAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("shortlist.manage");
    const teamId = z.string().uuid().parse(fd.get("teamId"));
    const selected = fd.get("selected") === "1";
    const justification = String(fd.get("justification") ?? "") || undefined;
    const res = await setCandidate(ctx, admin, teamId, selected, justification);
    revalidatePath("/admin/shortlist");
    return { message: res.selected ? (res.override ? "Added above the limit (override recorded)." : "Added to shortlist.") : "Removed from shortlist." };
  });
}

export async function finaliseShortlistAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("shortlist.finalise");
    if (fd.get("confirm") !== "FINALISE") throw new Error("Confirmation phrase missing.");
    const res = await finaliseShortlist(ctx, admin);
    runAfter(drainOutbox(ctx));
    revalidatePath("/admin", "layout");
    return { message: `Finalised: ${res.shortlisted} teams shortlisted, ${res.emailsQueued} emails queued.` };
  });
}

/** Adds, moves or removes a team in the waitlist (before finalising). */
export async function setWaitlistAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("shortlist.manage");
    const teamId = z.string().uuid().parse(fd.get("teamId"));
    const raw = String(fd.get("position") ?? "").trim();
    const position = raw === "" || fd.get("remove") === "1" ? null : z.coerce.number().int().min(1).max(500).parse(raw);
    const res = await setWaitlistPosition(ctx, admin, teamId, position);
    revalidatePath("/admin/shortlist");
    return { message: res.position === null ? "Removed from the waitlist." : `Waitlisted at #${res.position}.` };
  });
}

/** Promotes a waitlisted team. After finalising this emails the team, so it needs the finalise permission. */
export async function promoteWaitlistAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("shortlist.manage");
    // After finalising these actions email the team, so they need the finalise permission.
    if ((await finalisedAt(ctx)) && !can(admin.role, "shortlist.finalise")) throw new AppError(403, "FORBIDDEN", "Only a super admin can promote after finalising.");
    const teamId = z.string().uuid().parse(fd.get("teamId"));
    const justification = String(fd.get("justification") ?? "") || undefined;
    const res = await promoteFromWaitlist(ctx, admin, teamId, justification);
    if (res.emailsQueued) runAfter(drainOutbox(ctx));
    revalidatePath("/admin", "layout");
    return { message: res.emailsQueued ? "Promoted to the shortlist; the team has been emailed." : "Promoted to the shortlist." };
  });
}

/** Takes a team off the waitlist. After finalising it becomes not selected and is emailed. */
export async function releaseWaitlistAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("shortlist.manage");
    // After finalising these actions email the team, so they need the finalise permission.
    if ((await finalisedAt(ctx)) && !can(admin.role, "shortlist.finalise")) throw new AppError(403, "FORBIDDEN", "Only a super admin can release waitlisted teams after finalising.");
    const teamId = z.string().uuid().parse(fd.get("teamId"));
    const res = await releaseFromWaitlist(ctx, admin, teamId);
    if (res.emailsQueued) runAfter(drainOutbox(ctx));
    revalidatePath("/admin", "layout");
    return { message: res.emailsQueued ? "Released; the team has been emailed." : "Removed from the waitlist." };
  });
}
