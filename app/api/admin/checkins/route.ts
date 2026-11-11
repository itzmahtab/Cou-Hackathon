import { q } from '@/lib/db';
import { requireRole } from '@/lib/guards';
import { handle, httpError, jsonOk, str } from '@/lib/http';
import { audit } from '@/lib/data';


export const POST = handle(async (req: Request) => {
  const user = await requireRole('super_admin', 'moderator');
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const teamId = str(body.teamId);
  const present = Math.max(0, Math.floor(Number(body.membersPresent) || 0));

  const team = (
    await q('SELECT is_finalist, banned FROM public.teams WHERE id::text = $1', [teamId])
  ).rows[0] as { is_finalist?: boolean; banned?: boolean } | undefined;

  if (!team) throw httpError(404, 'Team not found.');
  if (!team.is_finalist) throw httpError(400, 'Only on-site finalist teams can check in.');
  if (team.banned) throw httpError(400, 'This team is banned.');

  await q(
    `INSERT INTO public.checkins (team_id, checked_in_at, checked_in_by, members_present) VALUES ($1, NOW(), $2, $3)
     ON CONFLICT (team_id) DO UPDATE SET checked_in_at = NOW(), checked_in_by = EXCLUDED.checked_in_by, members_present = EXCLUDED.members_present`,
    [teamId, user.sub, present]
  );

  await audit(user, 'CHECKIN_TEAM', 'checkin', teamId, { membersPresent: present });
  return jsonOk({ success: true });
});
