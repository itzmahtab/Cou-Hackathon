import { q } from '@/lib/db';
import { requireRole } from '@/lib/guards';
import { handle, jsonOk } from '@/lib/http';
import { audit } from '@/lib/data';


export const POST = handle(async (req: Request) => {
  const user = await requireRole('super_admin');
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const published = Boolean(body.published);

  await q('UPDATE public.final_results SET published = $1', [published]);
  await audit(user, 'PUBLISH_FINAL_RESULTS', 'results', 'publish', { published });

  return jsonOk({ success: true });
});
