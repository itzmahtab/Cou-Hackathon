import { withTransaction } from '@/lib/db';
import { requireRole } from '@/lib/guards';
import { handle, jsonOk } from '@/lib/http';
import { audit, getSettings } from '@/lib/data';


export const POST = handle(async (req: Request) => {
  const user = await requireRole('super_admin');
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const incoming = (body.settings && typeof body.settings === 'object'
    ? body.settings
    : body) as Record<string, unknown>;

  const entries = Object.entries(incoming).filter(
    ([k, v]) => /^[a-z0-9_]{1,64}$/i.test(k) && v !== undefined && typeof v !== 'function'
  );

  await withTransaction(async (client) => {
    for (const [key, value] of entries) {
      await client.query(
        `INSERT INTO public.settings (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, JSON.stringify(value)]
      );
    }
  });

  await audit(user, 'UPDATE_SETTINGS', 'settings', 'global', {
    keys: entries.map(([k]) => k),
  });

  return jsonOk({ success: true, settings: await getSettings() });
});
