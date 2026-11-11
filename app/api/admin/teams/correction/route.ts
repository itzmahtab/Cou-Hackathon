import { randomBytes } from 'node:crypto';
import { q } from '@/lib/db';
import { sha256 } from '@/lib/auth';
import { requireRole } from '@/lib/guards';
import { handle, httpError, jsonOk, str } from '@/lib/http';
import { audit, getSettings } from '@/lib/data';


export const POST = handle(async (req: Request) => {
  const user = await requireRole('super_admin', 'moderator');
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const teamId = str(body.teamId);
  const reason = str(body.reason) || 'Action required for payment correction.';

  const settings = await getSettings();
  const token = randomBytes(24).toString('hex');
  const days = Number(settings.correction_link_days) || 3;

  const r = await q(
    `UPDATE public.teams SET status = 'payment_correction', admin_note = $1, reviewed_at = NOW() WHERE id::text = $2`,
    [reason, teamId]
  );
  if (!r.rowCount) throw httpError(404, 'Team not found.');

  await q(
    `INSERT INTO public.correction_tokens (token_hash, team_id, reason, expires_at)
     VALUES ($1,$2,$3, NOW() + ($4 || ' days')::interval)`,
    [sha256(token), teamId, reason, String(days)]
  );

  await audit(user, 'REQUEST_CORRECTION', 'team', teamId, { reason });
  return jsonOk({ success: true, token });
});
