import { randomUUID } from 'node:crypto';
import { q } from '@/lib/db';
import { requireRole } from '@/lib/guards';
import { handle, httpError, jsonOk, str } from '@/lib/http';
import { audit, getSettings } from '@/lib/data';


function validateScore(raw: unknown, settings: { max_score: number; score_decimals: boolean }) {
  const score = Number(raw);
  const max = Number(settings.max_score) || 100;
  if (!Number.isFinite(score) || score < 0 || score > max) {
    throw httpError(400, `Score must be between 0 and ${max}.`);
  }
  if (!settings.score_decimals && !Number.isInteger(score)) {
    throw httpError(400, 'Decimal scores are not allowed.');
  }
  return score;
}

async function judgeName(userId: string) {
  const row = (await q('SELECT name FROM public.staff WHERE id = $1', [userId])).rows[0] as
    | { name?: string }
    | undefined;
  return row?.name || 'Judge';
}

export const POST = handle(async (req: Request) => {
  const user = await requireRole('judge', 'super_admin');
  const settings = await getSettings();

  if (settings.judging_locked) {
    throw httpError(423, 'Judging is locked by the admin. No further edits are permitted.');
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const teamId = str(body.teamId);
  const score = validateScore(body.score, settings);
  const comment = str(body.comment).slice(0, 2000);
  const isFinal = Boolean(body.isFinal);

  const team = (
    await q('SELECT status, banned FROM public.teams WHERE id::text = $1', [teamId])
  ).rows[0] as { status?: string; banned?: boolean } | undefined;

  if (!team || team.status !== 'approved' || team.banned) throw httpError(404, 'Team not found.');

  const sub = (await q('SELECT id FROM public.submissions WHERE team_id = $1', [teamId])).rows[0] as
    | { id: string }
    | undefined;
  if (!sub) throw httpError(400, 'This team has not made a submission yet.');

  await q(
    `INSERT INTO public.reviews (id, submission_id, team_id, judge_id, judge_name, score, comment, is_final)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (team_id, judge_id) DO UPDATE SET score = EXCLUDED.score, comment = EXCLUDED.comment,
            is_final = EXCLUDED.is_final, judge_name = EXCLUDED.judge_name, submission_id = EXCLUDED.submission_id, updated_at = NOW()`,
    [randomUUID(), sub.id, teamId, user.sub, await judgeName(user.sub), score, comment, isFinal]
  );

  await audit(user, 'SUBMIT_REVIEW', 'review', teamId, { score, isFinal });
  return jsonOk({ success: true });
});
