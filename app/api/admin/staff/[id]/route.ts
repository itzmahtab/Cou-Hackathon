import { q } from '@/lib/db';
import { requireRole } from '@/lib/guards';
import { handle, httpError, jsonOk } from '@/lib/http';
import { audit } from '@/lib/data';


export const DELETE = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireRole('super_admin');
    const { id } = await ctx.params;

    const r = await q(
      `DELETE FROM public.staff WHERE id::text = $1 AND role <> 'super_admin' RETURNING id, email`,
      [id]
    );
    if (!r.rowCount) throw httpError(404, 'Staff account not found or cannot be deleted.');

    await q('DELETE FROM public.reviews WHERE judge_id = $1', [id]);
    await q('DELETE FROM public.onsite_scores WHERE judge_id = $1', [id]);

    await audit(user, 'DELETE_STAFF', 'staff', id, {
      email: (r.rows[0] as { email: string }).email,
    });

    return jsonOk({ success: true });
  }
);
