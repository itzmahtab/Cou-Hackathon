import { q } from '@/lib/db';
import { requireRole } from '@/lib/guards';
import { handle, httpError, jsonOk } from '@/lib/http';
import { audit } from '@/lib/data';


export const POST = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireRole('super_admin', 'moderator');
    const { id } = await ctx.params;

    const r = await q(
      'UPDATE public.teams SET banned = NOT banned WHERE id::text = $1 RETURNING banned',
      [id]
    );
    if (!r.rowCount) throw httpError(404, 'Team not found.');

    const banned = Boolean((r.rows[0] as { banned: boolean }).banned);
    await audit(user, banned ? 'BAN_TEAM' : 'UNBAN_TEAM', 'team', id, {});
    return jsonOk({ success: true, banned });
  }
);
