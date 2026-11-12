"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, runAction, type ActionResult } from "@/lib/server";
import { reviewSchema, saveReview } from "@/features/reviews/service";
import { finaliseShortlist, setCandidate } from "@/features/shortlist/service";
import { runAfter } from "@/lib/ctx";
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
