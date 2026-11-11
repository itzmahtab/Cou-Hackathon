import { optionalAuth } from '@/lib/guards';
import { handle, jsonOk } from '@/lib/http';
import { q } from '@/lib/db';
import {
  getSettings,
  loadTeams,
  mapAuditLog,
  mapCheckin,
  mapDoc,
  mapOnsite,
  mapResult,
  mapReview,
  mapStaff,
} from '@/lib/data';
import { ADMIN_ROLES } from '@/lib/auth';


/** One endpoint that returns exactly what the caller is allowed to see. */
export const GET = handle(async () => {
  const user = await optionalAuth();
  const settings = await getSettings();

  const out: Record<string, unknown> = {
    success: true,
    settings,
    teams: [],
    staff: [],
    documents: [],
    reviews: [],
    onsiteScores: [],
    checkins: [],
    finalResults: [],
    auditLogs: [],
  };

  const publishedResults = async () =>
    settings.results_released
      ? (
          await q('SELECT * FROM public.final_results WHERE published = true ORDER BY rank ASC')
        ).rows.map((r) => mapResult(r))
      : [];

  if (user && ADMIN_ROLES.includes(user.role)) {
    const [teams, staff, docs, reviews, onsite, checkins, results, logs] = await Promise.all([
      loadTeams('full'),
      q(
        'SELECT id, name, email, role, active, must_change_password, created_at FROM public.staff ORDER BY created_at DESC'
      ),
      q('SELECT * FROM public.documents ORDER BY sort_order ASC, created_at DESC'),
      q('SELECT * FROM public.reviews ORDER BY updated_at DESC'),
      q('SELECT * FROM public.onsite_scores ORDER BY updated_at DESC'),
      q('SELECT * FROM public.checkins'),
      q('SELECT * FROM public.final_results ORDER BY rank ASC'),
      q('SELECT * FROM public.audit_logs ORDER BY created_at DESC LIMIT 500'),
    ]);

    out.teams = teams;
    out.staff = staff.rows.map((s) => mapStaff(s));
    out.documents = docs.rows.map((d) => mapDoc(d));
    out.reviews = reviews.rows.map((r) => mapReview(r));
    out.onsiteScores = onsite.rows.map((r) => mapOnsite(r));
    out.checkins = checkins.rows.map((c) => mapCheckin(c));
    out.finalResults = results.rows.map((r) => mapResult(r));
    out.auditLogs = logs.rows.map((l) => mapAuditLog(l));
  } else if (user && user.role === 'judge') {
    const [teams, reviews, onsite] = await Promise.all([
      loadTeams('judge'),
      q('SELECT * FROM public.reviews WHERE judge_id = $1', [user.sub]),
      q('SELECT * FROM public.onsite_scores WHERE judge_id = $1', [user.sub]),
    ]);
    out.teams = teams.filter((t) => t.status === 'approved' && !t.banned);
    out.reviews = reviews.rows.map((r) => mapReview(r));
    out.onsiteScores = onsite.rows.map((r) => mapOnsite(r));
  } else if (user && user.role === 'team') {
    const teams = await loadTeams('full', user.teamId || user.sub);
    out.teams = teams;
    const mine = teams[0];
    if (mine && mine.status === 'approved' && !mine.banned) {
      const docs = await q(
        'SELECT * FROM public.documents WHERE visible = true ORDER BY sort_order ASC, created_at DESC'
      );
      out.documents = docs.rows.map((d) => mapDoc(d));
      const ci = await q('SELECT * FROM public.checkins WHERE team_id = $1', [mine.id]);
      out.checkins = ci.rows.map((c) => mapCheckin(c));
      if (settings.results_released) {
        const rev = await q(
          'SELECT * FROM public.reviews WHERE team_id = $1 AND is_final = true ORDER BY created_at ASC',
          [mine.id]
        );
        out.reviews = rev.rows.map((r, i) =>
          mapReview(r, settings.anonymous_judges_to_teams ? i + 1 : 0)
        );
      }
    }
    out.finalResults = await publishedResults();
  } else {
    const teams = await loadTeams('public');
    out.teams = teams.filter((t) => t.status !== 'rejected' && !t.banned);
    out.finalResults = await publishedResults();
  }

  return jsonOk(out);
});
