import { q } from '@/lib/db';
import { requireRole } from '@/lib/guards';
import { handle, httpError, jsonOk } from '@/lib/http';
import { audit } from '@/lib/data';


export const PATCH = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireRole('super_admin');
    const { id } = await ctx.params;

    const r = await q(
      'UPDATE public.documents SET visible = NOT visible WHERE id::text = $1 RETURNING visible',
      [id]
    );
    if (!r.rowCount) throw httpError(404, 'Document not found.');

    const visible = Boolean((r.rows[0] as { visible: boolean }).visible);
    await audit(user, 'TOGGLE_DOCUMENT', 'document', id, { visible });

    return jsonOk({ success: true, visible });
  }
);
