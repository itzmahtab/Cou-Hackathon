import { q } from '@/lib/db';
import { requireRole } from '@/lib/guards';
import { handle, jsonOk } from '@/lib/http';
import { audit } from '@/lib/data';
import { ID_BUCKET, removeFiles } from '@/lib/storage';


export const POST = handle(async () => {
  const user = await requireRole('super_admin');

  const { rows } = await q(`SELECT id, id_card_key FROM public.members WHERE id_card_key LIKE 'teams/%'`);
  await removeFiles(
    ID_BUCKET,
    rows.map((r) => (r as { id_card_key?: string }).id_card_key)
  );
  await q(`UPDATE public.members SET id_card_key = NULL WHERE id_card_key LIKE 'teams/%'`);

  await audit(user, 'PURGE_ID_PHOTOS', 'storage', 'id-cards', { count: rows.length });
  return jsonOk({ success: true, purged: rows.length });
});
