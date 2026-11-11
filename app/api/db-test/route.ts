import { q } from '@/lib/db';
import { handle, jsonOk } from '@/lib/http';


export const GET = handle(async () => {
  const r = await q('SELECT NOW() AS t');
  return jsonOk({ ok: true, time: (r.rows[0] as { t: string }).t });
});
