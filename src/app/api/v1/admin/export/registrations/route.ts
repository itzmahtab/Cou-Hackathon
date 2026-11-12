import { logActivity } from "@/lib/auth/session";
import { TEAM_STATUSES } from "@/lib/constants";
import { toCsv } from "@/lib/csv";
import { clientIp, handle } from "@/lib/http";
import { requireAdmin } from "@/lib/server";
import { formatDhaka } from "@/lib/time";
import { exportRows } from "@/features/admin/queries";
import type { TeamStatus } from "@/lib/db/schema";

/** One row per participant. `?status=SHORTLISTED,CONFIRMED` narrows the export. */
export const GET = handle(async (req: Request) => {
  const { ctx, admin } = await requireAdmin("registrations.export");
  const raw = new URL(req.url).searchParams.get("status");
  const statuses = raw ? (raw.split(",").filter((s) => (TEAM_STATUSES as readonly string[]).includes(s)) as TeamStatus[]) : undefined;
  const rows = await exportRows(ctx, statuses?.length ? statuses : undefined);
  await logActivity(ctx, { adminId: admin.id, action: "export.registrations", detail: { statuses: statuses ?? "all", rows: rows.length }, ip: clientIp(req) });
  const csv = toCsv(
    ["Registration ID", "Team", "Team size", "Status", "Review score", "Registered (Dhaka)", "Idea title", "Member #", "Full name", "Email", "Phone", "WhatsApp", "University", "Student ID", "T-shirt"],
    rows.map((r) => [r.registrationId, r.teamName, r.teamSize, r.status, r.reviewScore, formatDhaka(r.registeredAt), r.ideaTitle, r.position, r.fullName, r.email, r.phone, r.whatsapp, r.university, r.studentId, r.tshirtSize]),
  );
  const stamp = new Date(ctx.now()).toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="registrations-${statuses?.join("-").toLowerCase() || "all"}-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
});
