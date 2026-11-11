import { q, withTransaction } from '@/lib/db';
import { requireRole } from '@/lib/guards';
import { handle, jsonOk } from '@/lib/http';
import { audit } from '@/lib/data';
import { ID_BUCKET, removeFiles } from '@/lib/storage';


export const DELETE = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireRole('super_admin', 'moderator');
    const { id } = await ctx.params;

    const keys = (
      await q('SELECT id_card_key FROM public.members WHERE team_id::text = $1', [id])
    ).rows.map((r) => (r as { id_card_key?: string }).id_card_key).filter((k) => k?.startsWith('teams/'));

    await withTransaction(async (client) => {
      for (const sql of [
        'DELETE FROM public.members WHERE team_id::text = $1',
        'DELETE FROM public.payments WHERE team_id::text = $1',
        'DELETE FROM public.team_accounts WHERE team_id::text = $1',
        'DELETE FROM public.submissions WHERE team_id = $1',
        'DELETE FROM public.reviews WHERE team_id = $1',
        'DELETE FROM public.onsite_scores WHERE team_id = $1',
        'DELETE FROM public.checkins WHERE team_id = $1',
        'DELETE FROM public.final_results WHERE team_id = $1',
        'DELETE FROM public.correction_tokens WHERE team_id = $1',
        'DELETE FROM public.teams WHERE id::text = $1',
      ]) {
        await client.query(sql, [id]);
      }
    });

    await removeFiles(ID_BUCKET, keys);
    await audit(user, 'DELETE_TEAM', 'team', id, {});

    return jsonOk({ success: true });
  }
);
