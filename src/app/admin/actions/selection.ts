"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, runAction, type ActionResult } from "@/lib/server";
import { saveSelectionTemplate } from "@/features/selection/service";

/** Saves the hand-sent selection email template. Nothing is emailed. */
export async function saveSelectionTemplateAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("emails.manage");
    const f = (k: string) => String(fd.get(k) ?? "");
    await saveSelectionTemplate(ctx, admin, {
      subject: f("subject"),
      heading: f("heading"),
      body: f("body"),
      telegramLink: f("telegramLink"),
      rulebookLink: f("rulebookLink"),
      websiteLink: f("websiteLink"),
      telegramLabel: f("telegramLabel"),
      rulebookLabel: f("rulebookLabel"),
      websiteLabel: f("websiteLabel"),
    });
    revalidatePath("/admin/emails");
    revalidatePath("/admin/final-selection");
    return { message: "Template saved. Nothing was emailed." };
  });
}
