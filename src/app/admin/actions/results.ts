"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAfter } from "@/lib/ctx";
import { requireAdmin, runAction, type ActionResult } from "@/lib/server";
import { drainOutbox, resendEmail } from "@/features/email/outbox";
import { autoRank, publishResults, resultSchema, saveResult, unpublishResults } from "@/features/results/service";

export async function saveResultAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("results.manage");
    await saveResult(ctx, admin, z.string().uuid().parse(fd.get("teamId")), resultSchema.parse(Object.fromEntries(fd)));
    revalidatePath("/admin/results");
    return { message: "Saved (not yet public)." };
  });
}

export async function autoRankAction(): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("results.manage");
    const n = await autoRank(ctx, admin);
    revalidatePath("/admin/results");
    return { message: `Ranked ${n} teams by score and assigned the three prizes.` };
  });
}

export async function publishResultsAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("results.publish");
    const n = await publishResults(ctx, admin, { notify: fd.get("notify") === "1" });
    runAfter(drainOutbox(ctx));
    revalidatePath("/", "layout");
    return { message: `Published ${n} results to the public leaderboard.` };
  });
}

export async function unpublishResultsAction(): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("results.publish");
    await unpublishResults(ctx, admin);
    revalidatePath("/", "layout");
    return { message: "The leaderboard is hidden again." };
  });
}

export async function resendEmailAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("emails.manage");
    await resendEmail(ctx, z.string().uuid().parse(fd.get("id")), admin.id);
    runAfter(drainOutbox(ctx, 3));
    revalidatePath("/admin/emails");
    return { message: "Queued again." };
  });
}

export async function drainNowAction(): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx } = await requireAdmin("emails.manage");
    const r = await drainOutbox(ctx, 25);
    revalidatePath("/admin/emails");
    return { message: `Sent ${r.sent}, failed ${r.failed}.` };
  });
}
