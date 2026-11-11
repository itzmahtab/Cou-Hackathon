import { q } from '@/lib/db';
import { requireRole } from '@/lib/guards';
import { handle, httpError, jsonOk, str } from '@/lib/http';
import { audit } from '@/lib/data';


export const POST = handle(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireRole('super_admin', 'moderator');
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const newEndAt = new Date(String(body.deadlineOverride));
    if (Number.isNaN(newEndAt.getTime())) throw httpError(400, 'Invalid date.');

    await q('UPDATE public.teams SET deadline_override = $1 WHERE id::text = $2', [
      newEndAt.toISOString(),
      id,
    ]);

    await audit(user, 'DEADLINE_OVERRIDE', 'team', id, {
      newEndAt: newEndAt.toISOString(),
      reason: str(body.reason),
    });

    return jsonOk({ success: true });
  }
);
