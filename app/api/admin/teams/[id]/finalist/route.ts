import { q } from '@/lib/db';
import { requireRole } from '@/lib/guards';
import { handle, jsonOk } from '@/lib/http';
import { audit } from '@/lib/data';


export const POST = handle(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireRole('super_admin', 'moderator');
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const isFinalist = Boolean(body.isFinalist);

    await q(
      'UPDATE public.teams SET is_finalist = $1, finalist_set_at = CASE WHEN $1 THEN NOW() ELSE NULL END WHERE id::text = $2',
      [isFinalist, id]
    );

    await audit(user, 'SET_FINALIST', 'team', id, { isFinalist });
    return jsonOk({ success: true });
  }
);
