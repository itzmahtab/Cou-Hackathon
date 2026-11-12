"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { activityRow } from "@/lib/auth/session";
import { adminActivityLogs, participants, teams } from "@/lib/db/schema";
import { AppError } from "@/lib/http";
import { requireAdmin, runAction, type ActionResult } from "@/lib/server";
import { participantSchema, normaliseKey, normaliseStudentId } from "@/features/registration/schema";

const editSchema = participantSchema.omit({ idCardFileId: true });

export async function updateParticipantAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("registrations.write");
    const id = String(fd.get("participantId") ?? "");
    const before = (await ctx.db.select().from(participants).where(eq(participants.id, id)).limit(1))[0];
    if (!before) throw new AppError(404, "NOT_FOUND", "Participant not found.");
    const input = editSchema.parse(Object.fromEntries([...fd].filter(([k]) => k !== "participantId")));
    const changes = Object.fromEntries(Object.entries(input).filter(([k, v]) => before[k as keyof typeof before] !== v));
    if (Object.keys(changes).length === 0) return { message: "No changes." };
    try {
      await ctx.db.batch([
        ctx.db
          .update(participants)
          .set({ ...input, universityNorm: normaliseKey(input.university), studentIdNorm: normaliseStudentId(input.studentId), updatedAt: ctx.now() })
          .where(eq(participants.id, id)),
        ctx.db.insert(adminActivityLogs).values(
          activityRow(ctx, {
            adminId: admin.id,
            action: "participant.update",
            entityType: "participant",
            entityId: id,
            detail: { fields: Object.keys(changes) },
          }),
        ),
      ]);
    } catch (err) {
      if (/UNIQUE constraint failed/i.test(String((err as Error)?.message))) throw new AppError(409, "DUPLICATE", "That email or student ID is already used by another participant.");
      throw err;
    }
    revalidatePath(`/admin/registrations/${before.teamId}`);
    return { message: "Participant updated." };
  });
}

const statusSchema = z.object({ teamId: z.string().uuid(), reason: z.string().trim().min(10, "Give a reason of at least 10 characters.").max(500) });

/** Disqualification is a super-admin action and always needs a written reason. */
export async function disqualifyTeamAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx, admin } = await requireAdmin("admins.manage");
    const { teamId, reason } = statusSchema.parse(Object.fromEntries(fd));
    const changed = await ctx.db.update(teams).set({ status: "DISQUALIFIED", isShortlistCandidate: false, updatedAt: ctx.now() }).where(eq(teams.id, teamId)).returning({ id: teams.id });
    if (!changed.length) throw new AppError(404, "NOT_FOUND", "Team not found.");
    await ctx.db.insert(adminActivityLogs).values(activityRow(ctx, { adminId: admin.id, action: "team.disqualify", entityType: "team", entityId: teamId, detail: { reason } }));
    revalidatePath(`/admin/registrations/${teamId}`);
    return { message: "Team disqualified." };
  });
}
