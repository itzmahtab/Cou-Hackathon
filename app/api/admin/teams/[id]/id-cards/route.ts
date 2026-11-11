import { q } from '@/lib/db';
import { requireRole } from '@/lib/guards';
import { handle, jsonOk } from '@/lib/http';
import { audit } from '@/lib/data';
import { ID_BUCKET, requireStorage } from '@/lib/storage';


export const GET = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireRole('super_admin', 'moderator');
    const { id } = await ctx.params;

    const storage = requireStorage();
    const { rows } = await q('SELECT id, id_card_key FROM public.members WHERE team_id::text = $1', [
      id,
    ]);

    const withKeys = rows.filter(
      (r) => r.id_card_key && String(r.id_card_key).startsWith('teams/')
    );

    const urls: Record<string, string> = {};
    if (withKeys.length) {
      const { data, error } = await storage.storage
        .from(ID_BUCKET)
        .createSignedUrls(withKeys.map((r) => String(r.id_card_key)), 3600);
      if (error) throw Object.assign(new Error(error.message), { status: 502 });
      data.forEach((item, i) => {
        if (item.signedUrl) urls[String(withKeys[i].id)] = item.signedUrl;
      });
    }

    await audit(user, 'VIEW_ID_CARDS', 'team', id, {});
    return jsonOk({ success: true, urls });
  }
);
