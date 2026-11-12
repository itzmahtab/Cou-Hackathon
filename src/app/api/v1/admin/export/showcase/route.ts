import { logActivity } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";
import { clientIp, handle } from "@/lib/http";
import { requireAdmin } from "@/lib/server";
import { formatDhaka } from "@/lib/time";
import { listShowcase } from "@/features/showcase/service";

/** One row per showcase participant. `?status=CONFIRMED` narrows the export. */
export const GET = handle(async (req: Request) => {
  const { ctx, admin } = await requireAdmin("registrations.export");
  const status = new URL(req.url).searchParams.get("status") ?? undefined;
  const regs = await listShowcase(ctx, { status });
  const rows = regs.flatMap((r) =>
    r.members.map((m) => [r.registrationId, r.status, r.projectTitle, r.category, r.teamSize, r.feeBdt, r.senderPhone, r.transactionId, formatDhaka(r.createdAt), m.position, m.fullName, m.studentId, m.department, m.session, m.email, m.phone]),
  );
  await logActivity(ctx, { adminId: admin.id, action: "export.showcase", detail: { status: status ?? "all", rows: rows.length }, ip: clientIp(req) });
  const csv = toCsv(["Registration ID", "Status", "Project", "Category", "Team size", "Fee (BDT)", "bKash sender", "Transaction ID", "Registered (Dhaka)", "Member #", "Full name", "Student ID", "Department", "Session", "Email", "Phone"], rows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="showcase-${(status ?? "all").toLowerCase()}-${new Date(ctx.now()).toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
});
