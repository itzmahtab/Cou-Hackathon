import bcrypt from 'bcryptjs';
import { q } from '@/lib/db';
import { signToken, setSessionCookie } from '@/lib/auth';
import { handle, httpError, jsonOk, normalizeEmail } from '@/lib/http';
import { audit } from '@/lib/data';


export const POST = handle(async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = normalizeEmail(body.email);
  const password = String(body.password ?? '');

  if (!email || !password) throw httpError(400, 'Email and password are required.');

  const { rows } = await q(
    `SELECT ta.team_id, ta.login_email, ta.password_hash, ta.must_change_password, ta.failed_logins, ta.locked_until,
            t.team_name, t.status, t.banned
     FROM public.team_accounts ta JOIN public.teams t ON t.id = ta.team_id
     WHERE LOWER(ta.login_email) = $1 LIMIT 1`,
    [email]
  );
  const team = rows[0] as Record<string, unknown> | undefined;
  if (!team) throw httpError(401, 'Invalid email or password.');

  if (team.locked_until && new Date(String(team.locked_until)) > new Date()) {
    throw httpError(423, 'This team account is temporarily locked. Try again later.');
  }
  if (team.banned) throw httpError(403, 'This team has been banned by the organizers.');
  if (team.status !== 'approved') {
    const msg =
      team.status === 'pending'
        ? 'Your registration is still awaiting approval. Credentials are issued once payment is verified.'
        : `Team status is currently '${team.status}'. Only approved teams can log in.`;
    throw httpError(403, msg);
  }

  if (!(await bcrypt.compare(password, String(team.password_hash)))) {
    const failed = Number(team.failed_logins || 0) + 1;
    const lock = failed >= 5 ? new Date(Date.now() + 15 * 60000).toISOString() : null;
    await q(
      'UPDATE public.team_accounts SET failed_logins = $1, locked_until = $2 WHERE team_id = $3',
      [failed >= 5 ? 0 : failed, lock, team.team_id]
    );
    throw httpError(
      401,
      failed >= 5 ? 'Too many failed attempts. Locked for 15 minutes.' : 'Invalid email or password.'
    );
  }

  await q(
    'UPDATE public.team_accounts SET failed_logins = 0, locked_until = NULL WHERE team_id = $1',
    [team.team_id]
  );

  const teamId = String(team.team_id);
  const token = signToken({
    sub: teamId,
    teamId,
    role: 'team',
    email,
    name: String(team.team_name),
  });
  await setSessionCookie(token);

  await audit({ role: 'team', sub: teamId, name: String(team.team_name) }, 'TEAM_LOGIN', 'team', teamId, {});

  return jsonOk({
    success: true,
    user: {
      id: teamId,
      name: String(team.team_name),
      email: String(team.login_email),
      teamId,
      mustChangePassword: Boolean(team.must_change_password),
    },
  });
});
