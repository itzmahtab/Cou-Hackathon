import { randomUUID } from 'node:crypto';
import { q } from '@/lib/db';
import { requireRole } from '@/lib/guards';
import { handle, httpError, jsonOk, str } from '@/lib/http';
import { audit, getSettings } from '@/lib/data';


export const POST = handle(async (req: Request) => {
  const user = await requireRole('team');
  const teamId = user.sub;

  const team = (
    await q('SELECT status, banned, deadline_override FROM public.teams WHERE id::text = $1', [teamId])
  ).rows[0] as { status?: string; banned?: boolean; deadline_override?: string } | undefined;

  if (!team || team.status !== 'approved' || team.banned) {
    throw httpError(403, 'Your team cannot submit right now.');
  }

  const settings = await getSettings();
  const deadline = team.deadline_override || settings.online_end_at;
  if (deadline && Date.now() > new Date(String(deadline)).getTime()) {
    throw httpError(400, 'Online submission window has closed.');
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const abstract = str(body.abstract);
  const repoUrl = str(body.repoUrl);
  const videoUrl = str(body.videoUrl);

  if (abstract.length > 350) throw httpError(400, 'Abstract exceeds the 350 character limit.');

  for (const [label, url] of [
    ['Repository', repoUrl],
    ['Video', videoUrl],
  ] as const) {
    if (url && !/^https?:\/\/\S+$/i.test(url)) {
      throw httpError(400, `${label} link must start with http:// or https://`);
    }
  }

  await q(
    `INSERT INTO public.submissions (id, team_id, abstract, repo_url, video_url) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (team_id) DO UPDATE SET abstract = EXCLUDED.abstract, repo_url = EXCLUDED.repo_url,
            video_url = EXCLUDED.video_url, updated_at = NOW()`,
    [randomUUID(), teamId, abstract, repoUrl, videoUrl]
  );

  await audit(user, 'SUBMIT_ONLINE_WORK', 'submission', teamId, { repoUrl });
  return jsonOk({ success: true });
});
