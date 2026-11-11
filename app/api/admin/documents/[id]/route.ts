import { q } from '@/lib/db';
import { requireRole } from '@/lib/guards';
import { handle, httpError, jsonOk } from '@/lib/http';
import { audit } from '@/lib/data';
import { DOC_BUCKET, removeFiles } from '@/lib/storage';


export const DELETE = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireRole('super_admin');
    const { id } = await ctx.params;

    const r = await q(
      'DELETE FROM public.documents WHERE id::text = $1 RETURNING file_key',
      [id]
    );
    if (!r.rowCount) throw httpError(404, 'Document not found.');

    await removeFiles(DOC_BUCKET, [(r.rows[0] as { file_key: string }).file_key]);
    await audit(user, 'DELETE_DOCUMENT', 'document', id, {});

    return jsonOk({ success: true });
  }
);
