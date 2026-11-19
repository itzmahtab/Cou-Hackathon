import { AppError, handle } from "@/lib/http";
import { requireAdmin } from "@/lib/server";
import { renderForTeam, selectionContext } from "@/features/selection/service";

/** The filled-in selection email for one team, as a standalone page (admins only). Sends nothing. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ teamId: string }> }) => {
  const { teamId } = await params;
  const { ctx } = await requireAdmin("registrations.contact");
  const { selected, waiting, rejected, settings, tpl } = await selectionContext(ctx);
  const team = [...selected, ...waiting, ...rejected].find((t) => t.id === teamId);
  if (!team) throw new AppError(404, "NOT_FOUND", "Team not found in the final selection.");
  const mail = renderForTeam(team, settings, tpl);
  return new Response(mail.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // Static email markup only: no scripts, no forms.
      "Content-Security-Policy": "default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; frame-ancestors 'self'",
    },
  });
});
