"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, runAction, type ActionResult } from "@/lib/server";
import { saveSelectionTemplate } from "@/features/selection/service";

/** Saves the hand-sent selection email template. Nothing is emailed. */
export async function saveSelectionTemplateAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("emails.manage");
    await saveSelectionTemplate(ctx, admin, {
      subject: String(fd.get("subject") ?? ""),
      body: String(fd.get("body") ?? ""),
      telegramLink: String(fd.get("telegramLink") ?? ""),
    });
    revalidatePath("/admin/emails");
    revalidatePath("/admin/final-selection");
    return { message: "Template saved. Nothing was emailed." };
  });
}
