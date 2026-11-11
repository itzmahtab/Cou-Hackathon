import bcrypt from 'bcryptjs';
import { q } from '@/lib/db';
import { makePassword } from '@/lib/auth';
import { requireRole } from '@/lib/guards';
import { handle, httpError, jsonOk, str } from '@/lib/http';
import { audit } from '@/lib/data';


export const POST = handle(async (req: Request) => {
  const user = await requireRole('super_admin', 'moderator');
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const teamId = str(body.teamId);

  const team = (await q('SELECT id FROM public.teams WHERE id::text = $1', [teamId])).rows[0];
  if (!team) throw httpError(404, 'Team not found.');

  const account = (
    await q('SELECT login_email FROM public.team_accounts WHERE team_id::text = $1', [teamId])
  ).rows[0] as { login_email?: string } | undefined;
  if (!account) throw httpError(409, 'This team has no login account.');

  const temporaryPassword = makePassword('cou');
  const hash = await bcrypt.hash(temporaryPassword, 10);

  await q(
    `UPDATE public.teams SET status = 'approved', admin_note = NULL, reviewed_at = NOW() WHERE id::text = $1`,
    [teamId]
  );
  await q(
    `UPDATE public.team_accounts SET password_hash = $1, must_change_password = true, credentials_sent = false,
            credentials_sent_at = NULL, failed_logins = 0, locked_until = NULL WHERE team_id::text = $2`,
    [hash, teamId]
  );

  await audit(user, 'APPROVE_TEAM', 'team', teamId, { email: account.login_email });

  return jsonOk({ success: true, email: account.login_email, temporaryPassword });
});
