import { withTransaction } from '@/lib/db';
import { requireRole } from '@/lib/guards';
import { handle, jsonOk, str } from '@/lib/http';
import { audit } from '@/lib/data';


export const POST = handle(async (req: Request) => {
  const user = await requireRole('super_admin');
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const results = Array.isArray(body.results) ? (body.results as Record<string, unknown>[]) : [];

  await withTransaction(async (client) => {
    await client.query('DELETE FROM public.final_results');
    for (const r of results) {
      await client.query(
        `INSERT INTO public.final_results (team_id, team_name, university, online_avg, onsite_avg, final_score, rank, prize_label, published)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false)`,
        [
          String(r.teamId),
          str(r.teamName),
          str(r.university),
          Number(r.onlineAvg) || 0,
          Number(r.onsiteAvg) || 0,
          Number(r.finalScore) || 0,
          Number(r.rank) || 0,
          r.prizeLabel || null,
        ]
      );
    }
  });

  await audit(user, 'COMPUTE_FINAL_RESULTS', 'results', 'offline', { count: results.length });
  return jsonOk({ success: true });
});
