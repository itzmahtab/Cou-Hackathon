import { q } from '@/lib/db';
import { requireRole } from '@/lib/guards';
import { handle, jsonOk } from '@/lib/http';
import { audit } from '@/lib/data';


export const POST = handle(async (req: Request) => {
  const user = await requireRole('super_admin', 'moderator');
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const ids = Array.isArray(body.teamIds) ? body.teamIds.map(String) : [];

  await q(
    `UPDATE public.teams SET is_finalist = (id::text = ANY($1::text[])),
            finalist_set_at = CASE WHEN id::text = ANY($1::text[]) THEN NOW() ELSE NULL END`,
    [ids]
  );

  await audit(user, 'SUGGEST_FINALISTS', 'finalists', 'auto', { count: ids.length, teamIds: ids });
  return jsonOk({ success: true });
});
