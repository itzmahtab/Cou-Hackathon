import { q } from '@/lib/db';
import { requireRole } from '@/lib/guards';
import { handle, httpError, jsonOk } from '@/lib/http';
import { audit } from '@/lib/data';


export const POST = handle(async () => {
  const user = await requireRole('super_admin');

  if (process.env.ALLOW_RESET !== 'true') {
    throw httpError(403, 'Reset is disabled on this server (set ALLOW_RESET=true to enable).');
  }

  const tables = [
    'reviews',
    'onsite_scores',
    'checkins',
    'final_results',
    'correction_tokens',
    'submissions',
    'members',
    'payments',
    'team_accounts',
    'teams',
    'settings',
  ];

  for (const t of tables) {
    await q(`DELETE FROM public.${t}`);
  }

  await audit(user, 'RESET_ALL_DATA', 'system', 'all', {});
  return jsonOk({ success: true });
});
