import { q } from '@/lib/db';
import { requireRole } from '@/lib/guards';
import { handle, httpError, jsonOk } from '@/lib/http';
import { audit } from '@/lib/data';


export const PATCH = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireRole('super_admin');
    const { id } = await ctx.params;

    const r = await q(
      `UPDATE public.staff SET active = NOT active WHERE id::text = $1 AND role <> 'super_admin' RETURNING id, active`,
      [id]
    );
    if (!r.rowCount) throw httpError(404, 'Staff account not found.');

    const active = Boolean((r.rows[0] as { active: boolean }).active);
    await audit(user, 'TOGGLE_STAFF', 'staff', id, { active });

    return jsonOk({ success: true, active });
  }
);
