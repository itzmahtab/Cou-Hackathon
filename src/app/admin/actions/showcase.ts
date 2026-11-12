"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAfter } from "@/lib/ctx";
import { requireAdmin, runAction, type ActionResult } from "@/lib/server";
import { drainOutbox } from "@/features/email/outbox";
import { deleteShowcase, rejectShowcase, verifyShowcase } from "@/features/showcase/service";

const id = (fd: FormData) => z.string().uuid().parse(fd.get("id"));

export async function verifyShowcaseAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("payments.verify");
    await verifyShowcase(ctx, admin, id(fd), String(fd.get("note") ?? ""));
    runAfter(drainOutbox(ctx));
    revalidatePath("/admin/showcase");
    return { message: "Verified. The team has been emailed." };
  });
}

export async function rejectShowcaseAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("payments.verify");
    await rejectShowcase(ctx, admin, id(fd), String(fd.get("reason") ?? ""), String(fd.get("note") ?? ""));
    runAfter(drainOutbox(ctx));
    revalidatePath("/admin/showcase");
    return { message: "Rejected. The team has been emailed the reason." };
  });
}

export async function deleteShowcaseAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("registrations.write");
    await deleteShowcase(ctx, admin, id(fd));
    revalidatePath("/admin/showcase");
    return { message: "Deleted. These students can register again." };
  });
}
