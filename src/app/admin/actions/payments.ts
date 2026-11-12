"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAfter } from "@/lib/ctx";
import { requireAdmin, runAction, type ActionResult } from "@/lib/server";
import { drainOutbox } from "@/features/email/outbox";
import { rejectPayment, setAttendance, verifyPayment } from "@/features/payments/service";

export async function verifyPaymentAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("payments.verify");
    await verifyPayment(ctx, admin, z.string().uuid().parse(fd.get("paymentId")), String(fd.get("note") ?? ""));
    runAfter(drainOutbox(ctx));
    revalidatePath("/admin/payments");
    return { message: "Verified. The team is confirmed and has been emailed." };
  });
}

export async function rejectPaymentAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("payments.verify");
    await rejectPayment(ctx, admin, z.string().uuid().parse(fd.get("paymentId")), String(fd.get("reason") ?? ""), String(fd.get("note") ?? ""));
    runAfter(drainOutbox(ctx));
    revalidatePath("/admin/payments");
    return { message: "Rejected. The team has been emailed the reason." };
  });
}

export async function attendanceAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("event.manage");
    await setAttendance(ctx, admin, z.string().uuid().parse(fd.get("participantId")), fd.get("present") === "1");
    revalidatePath("/admin/event");
    return { message: fd.get("present") === "1" ? "Checked in." : "Check-in removed." };
  });
}
