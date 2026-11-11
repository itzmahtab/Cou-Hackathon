import { q } from '@/lib/db';
import { requireRole } from '@/lib/guards';
import { handle, httpError, jsonOk, str } from '@/lib/http';
import { audit } from '@/lib/data';


export const POST = handle(async (req: Request) => {
  const user = await requireRole('super_admin', 'moderator');
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const teamId = str(body.teamId);
  const reason = str(body.reason) || 'Registration rejected.';

  const r = await q(
    `UPDATE public.teams SET status = 'rejected', admin_note = $1, reviewed_at = NOW() WHERE id::text = $2`,
    [reason, teamId]
  );
  if (!r.rowCount) throw httpError(404, 'Team not found.');

  await audit(user, 'REJECT_TEAM', 'team', teamId, { reason });
  return jsonOk({ success: true });
});
