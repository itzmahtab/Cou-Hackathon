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

  const team = (
    await q('SELECT is_finalist FROM public.teams WHERE id::text = $1', [teamId])
  ).rows[0] as { is_finalist?: boolean } | undefined;

  if (!team || !team.is_finalist) {
    throw httpError(400, 'Only finalist teams can receive on-site scores.');
  }

  await q(
    `INSERT INTO public.onsite_scores (id, team_id, judge_id, judge_name, score, comment, is_final)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (team_id, judge_id) DO UPDATE SET score = EXCLUDED.score, comment = EXCLUDED.comment,
            is_final = EXCLUDED.is_final, judge_name = EXCLUDED.judge_name, updated_at = NOW()`,
    [
      randomUUID(),
      teamId,
      user.sub,
      await judgeName(user.sub),
      score,
      str(body.comment).slice(0, 2000) || null,
      body.isFinal !== false,
    ]
  );

  await audit(user, 'SUBMIT_ONSITE_SCORE', 'onsite_score', teamId, { score });
  return jsonOk({ success: true });
});
