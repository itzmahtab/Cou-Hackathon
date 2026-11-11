import { q } from '@/lib/db';
import { requireRole } from '@/lib/guards';
import { handle, httpError, jsonOk } from '@/lib/http';
import { getSettings } from '@/lib/data';
import { DOC_BUCKET, requireStorage } from '@/lib/storage';


export const GET = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireRole('super_admin', 'moderator', 'judge', 'team');
    const { id } = await ctx.params;

    const storage = requireStorage();
    const doc = (
      await q('SELECT * FROM public.documents WHERE id::text = $1', [id])
    ).rows[0] as Record<string, unknown> | undefined;

    if (!doc) throw httpError(404, 'Document not found.');

    if (user.role === 'team') {
      const settings = await getSettings();
      const team = (
        await q('SELECT status, banned FROM public.teams WHERE id::text = $1', [user.sub])
      ).rows[0] as { status?: string; banned?: boolean } | undefined;

      if (!team || team.status !== 'approved' || team.banned) {
        throw httpError(403, 'Only approved teams can download documents.');
      }
      if (!doc.visible) throw httpError(403, 'This document is not available.');
      if (
        settings.online_start_at &&
        Date.now() < new Date(String(settings.online_start_at)).getTime()
      ) {
        throw httpError(403, 'Documents unlock when the online round starts.');
      }
    } else if (user.role === 'judge' && !doc.visible) {
      throw httpError(403, 'This document is not available.');
    }

    const { data, error } = await storage.storage
      .from(DOC_BUCKET)
      .createSignedUrl(String(doc.file_key), 120, { download: String(doc.file_name) });

    if (error) throw httpError(502, error.message);

    return jsonOk({ success: true, url: data.signedUrl, fileName: doc.file_name });
  }
);
