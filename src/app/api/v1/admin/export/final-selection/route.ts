import { logActivity } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";
import { clientIp, handle } from "@/lib/http";
import { rateLimit } from "@/lib/security/ratelimit";
import { requireAdmin } from "@/lib/server";
import { finalSelection, type SelectionTeam } from "@/features/selection/service";

/** One row per participant of every selected, waiting and rejected team. */
export const GET = handle(async (req: Request) => {
  const { ctx, admin } = await requireAdmin("registrations.contact");
  await rateLimit(ctx, `admin-export:${admin.id}`, 30, 60 * 60);
  const { selected, waiting, rejected } = await finalSelection(ctx);
  const rows = (group: string, list: SelectionTeam[]) =>
    list.flatMap((t, i) =>
      t.members.map((m) => [group, group === "Waiting" ? t.waitlist : i + 1, t.registrationId, t.name, t.score, t.title, m.position, m.position === 1 ? "Leader" : "Member", m.fullName, m.email, m.phone, m.whatsapp, m.university]),
    );
  const csv = toCsv(
    ["Decision", "#", "Registration ID", "Team", "Score", "Idea title", "Member #", "Role", "Full name", "Email", "Phone", "WhatsApp", "University"],
    [...rows("Selected", selected), ...rows("Waiting", waiting), ...rows("Rejected", rejected)],
  );
  await logActivity(ctx, { adminId: admin.id, action: "export.final_selection", detail: { selected: selected.length, waiting: waiting.length, rejected: rejected.length }, ip: clientIp(req) });
  const stamp = new Date(ctx.now()).toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="final-selection-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
});
