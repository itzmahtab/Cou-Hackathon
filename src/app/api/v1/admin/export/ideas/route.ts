import { and, asc, eq, inArray } from "drizzle-orm";
import { can } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/auth/session";
import { TEAM_STATUSES } from "@/lib/constants";
import { files, ideaSubmissions, teams, type TeamStatus } from "@/lib/db/schema";
import { AppError, clientIp, handle, jsonOk } from "@/lib/http";
import type { IdeaDocItem } from "@/lib/idea-zip";
import { rateLimit } from "@/lib/security/ratelimit";
import { requireAdmin } from "@/lib/server";

/**
 * Lists every attached idea document so the admin's browser can fetch them through
 * /api/v1/admin/files/[id] and zip them locally. Building the ZIP on the client keeps
 * the Worker within its CPU and subrequest limits. `?status=A,B` narrows the list.
 */
export const GET = handle(async (req: Request) => {
  const { ctx, admin } = await requireAdmin();
  // Same rule as single idea documents in /api/v1/admin/files/[id].
  if (!can(admin.role, "reviews.read") && !can(admin.role, "registrations.contact")) {
    throw new AppError(403, "FORBIDDEN", "Your role does not allow idea documents.");
  }
  await rateLimit(ctx, `admin-export-ideas:${admin.id}`, 20, 60 * 60);

  const raw = new URL(req.url).searchParams.get("status");
  const statuses = raw ? (raw.split(",").filter((s) => (TEAM_STATUSES as readonly string[]).includes(s)) as TeamStatus[]) : [];

  const rows = await ctx.db
    .select({
      fileId: files.id,
      registrationId: teams.registrationId,
      teamName: teams.name,
      status: teams.status,
      reviewScore: teams.reviewScoreAvg,
      title: ideaSubmissions.title,
      r2Key: files.r2Key,
      originalName: files.originalName,
      sizeBytes: files.sizeBytes,
      createdAt: files.createdAt,
    })
    .from(teams)
    .innerJoin(ideaSubmissions, eq(ideaSubmissions.teamId, teams.id))
    .innerJoin(files, and(eq(files.id, ideaSubmissions.documentFileId), eq(files.status, "ATTACHED")))
    .where(statuses.length ? inArray(teams.status, statuses) : undefined)
    .orderBy(asc(teams.registrationId));

  await logActivity(ctx, {
    adminId: admin.id,
    action: "export.ideas",
    detail: { statuses: statuses.length ? statuses : "all", files: rows.length },
    ip: clientIp(req),
  });

  const items: IdeaDocItem[] =rows.map(({ r2Key, ...r }) => ({ ...r, ext: (r2Key.split(".").pop() ?? "bin").toLowerCase() }));
  return jsonOk({ items }, 200);
});
