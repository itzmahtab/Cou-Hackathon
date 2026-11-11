import { randomUUID } from 'node:crypto';
import { q } from './db';
import { DEFAULT_SETTINGS } from './defaults';
import type {
  AuditLogEntry,
  Checkin,
  FinalResult,
  OnsiteScore,
  Review,
  ScenarioDocument,
  StaffAccount,
  SystemSettings,
  Team,
  TeamMember,
  TeamSubmission,
} from '@/types';

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export async function getSettings(): Promise<SystemSettings & Record<string, unknown>> {
  const { rows } = await q('SELECT key, value FROM public.settings');
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.key) out[row.key] = row.value ?? out[row.key];
  }
  return out as SystemSettings & Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* Audit trail                                                         */
/* ------------------------------------------------------------------ */

export async function audit(
  user: { role?: string; sub?: string; name?: string } | null,
  action: string,
  targetType: string,
  targetId: unknown,
  detail: Record<string, unknown> = {}
): Promise<void> {
  try {
    await q(
      `INSERT INTO public.audit_logs (id, actor_type, actor_id, actor_name, action, target_type, target_id, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [
        randomUUID(),
        user?.role || 'visitor',
        user?.sub || 'anonymous',
        user?.name || (user?.role === 'team' ? 'Team Leader' : 'Visitor'),
        action,
        targetType,
        String(targetId ?? ''),
        JSON.stringify(detail || {}),
      ]
    );
  } catch (e) {
    console.warn('audit log failed:', (e as Error).message);
  }
}

/* ------------------------------------------------------------------ */
/* Mappers                                                             */
/* ------------------------------------------------------------------ */

const emptyMember = (m: Record<string, unknown>): TeamMember => ({
  id: String(m.id),
  isLeader: Boolean(m.is_leader),
  fullName: '',
  studentId: '',
  email: '',
  phone: '',
  department: '',
  year: '',
});

const mapSubmission = (s: Record<string, unknown>): TeamSubmission | undefined =>
  s
    ? {
        id: String(s.id),
        teamId: String(s.team_id),
        abstract: String(s.abstract ?? ''),
        repoUrl: String(s.repo_url ?? ''),
        videoUrl: String(s.video_url ?? ''),
        createdAt: String(s.created_at ?? ''),
        updatedAt: String(s.updated_at ?? ''),
      }
    : undefined;

export const mapReview = (r: Record<string, unknown>, anonIndex?: number): Review => ({
  id: String(r.id),
  submissionId: String(r.submission_id ?? ''),
  teamId: String(r.team_id),
  judgeId: anonIndex ? `judge-${anonIndex}` : String(r.judge_id),
  judgeName: anonIndex ? `Judge ${anonIndex}` : String(r.judge_name ?? ''),
  score: Number(r.score),
  comment: String(r.comment ?? ''),
  isFinal: Boolean(r.is_final),
  createdAt: String(r.created_at ?? ''),
  updatedAt: String(r.updated_at ?? ''),
});

export const mapOnsite = (r: Record<string, unknown>): OnsiteScore => ({
  id: String(r.id),
  teamId: String(r.team_id),
  judgeId: String(r.judge_id),
  judgeName: String(r.judge_name ?? ''),
  score: Number(r.score),
  comment: r.comment ? String(r.comment) : undefined,
  isFinal: Boolean(r.is_final),
  updatedAt: String(r.updated_at ?? ''),
});

export const mapCheckin = (c: Record<string, unknown>): Checkin => ({
  teamId: String(c.team_id),
  checkedInAt: String(c.checked_in_at ?? ''),
  checkedInBy: String(c.checked_in_by ?? ''),
  membersPresent: Number(c.members_present ?? 0),
});

export const mapResult = (r: Record<string, unknown>): FinalResult => ({
  teamId: String(r.team_id),
  teamName: String(r.team_name ?? ''),
  university: String(r.university ?? ''),
  onlineAvg: Number(r.online_avg ?? 0),
  onsiteAvg: Number(r.onsite_avg ?? 0),
  finalScore: Number(r.final_score ?? 0),
  rank: Number(r.rank ?? 0),
  prizeLabel: r.prize_label ? String(r.prize_label) : undefined,
  published: Boolean(r.published),
});

export const mapDoc = (d: Record<string, unknown>): ScenarioDocument => ({
  id: String(d.id),
  title: String(d.title ?? ''),
  kind: String(d.kind ?? 'other') as ScenarioDocument['kind'],
  fileKey: String(d.file_key ?? ''),
  fileName: String(d.file_name ?? ''),
  sizeBytes: Number(d.size_bytes ?? 0),
  visible: Boolean(d.visible),
  sortOrder: Number(d.sort_order ?? 0),
  uploadedBy: String(d.uploaded_by ?? ''),
  createdAt: String(d.created_at ?? ''),
});

export const mapStaff = (s: Record<string, unknown>): StaffAccount => ({
  id: String(s.id),
  name: String(s.name ?? ''),
  email: String(s.email ?? ''),
  role: String(s.role ?? 'judge') as StaffAccount['role'],
  active: Boolean(s.active),
  mustChangePassword: Boolean(s.must_change_password),
  createdAt: String(s.created_at ?? ''),
});

export const mapAuditLog = (l: Record<string, unknown>): AuditLogEntry => ({
  id: String(l.id),
  actorType: String(l.actor_type ?? ''),
  actorId: String(l.actor_id ?? ''),
  actorName: String(l.actor_name ?? ''),
  action: String(l.action ?? ''),
  targetType: String(l.target_type ?? ''),
  targetId: String(l.target_id ?? ''),
  detail: (l.detail ?? {}) as Record<string, unknown>,
  createdAt: String(l.created_at ?? ''),
});

/* ------------------------------------------------------------------ */
/* Teams loader                                                        */
/* ------------------------------------------------------------------ */

export type TeamVisibility = 'full' | 'judge' | 'public';

/**
 * Loads teams with the level of detail the caller is allowed to see.
 *  - 'full'   -> admin/moderator, or the team itself
 *  - 'judge'  -> approved teams without member contact data
 *  - 'public' -> roster without member contact data
 */
export async function loadTeams(level: TeamVisibility, onlyTeamId?: string): Promise<Team[]> {
  const params: unknown[] = onlyTeamId ? [onlyTeamId] : [];
  const where = onlyTeamId ? 'WHERE t.id::text = $1' : '';

  const { rows: teamRows } = await q(
    `SELECT t.*, ta.login_email, ta.must_change_password, ta.credentials_sent, ta.credentials_sent_at
     FROM public.teams t LEFT JOIN public.team_accounts ta ON ta.team_id = t.id
     ${where} ORDER BY t.created_at DESC`,
    params
  );

  const ids = teamRows.map((t) => String(t.id));
  if (ids.length === 0) return [];

  const [membersRes, paymentsRes, subsRes] = await Promise.all([
    q(
      `SELECT id, team_id, is_leader, full_name, student_id, email, phone, department, year, id_card_key
       FROM public.members WHERE team_id::text = ANY($1::text[]) ORDER BY is_leader DESC, full_name ASC`,
      [ids]
    ),
    level === 'full'
      ? q(
          `SELECT team_id, method, sender_no, trx_id, amount, verified_at, verified_by
           FROM public.payments WHERE team_id::text = ANY($1::text[])`,
          [ids]
        )
      : Promise.resolve({ rows: [], rowCount: 0 }),
    level === 'public'
      ? Promise.resolve({ rows: [], rowCount: 0 })
      : q(`SELECT * FROM public.submissions WHERE team_id::text = ANY($1::text[])`, [ids]),
  ]);

  const membersBy = new Map<string, TeamMember[]>();
  for (const m of membersRes.rows as Record<string, unknown>[]) {
    const k = String(m.team_id);
    if (!membersBy.has(k)) membersBy.set(k, []);
    membersBy.get(k)!.push(
      level === 'full'
        ? {
            id: String(m.id),
            isLeader: Boolean(m.is_leader),
            fullName: String(m.full_name ?? ''),
            studentId: String(m.student_id ?? ''),
            email: String(m.email ?? ''),
            phone: String(m.phone ?? ''),
            department: String(m.department ?? ''),
            year: String(m.year ?? ''),
            idCardFile:
              m.id_card_key && String(m.id_card_key).startsWith('teams/')
                ? String(m.id_card_key).split('/').pop()
                : undefined,
          }
        : emptyMember(m)
    );
  }

  const payBy = new Map(
    (paymentsRes.rows as Record<string, unknown>[]).map((p) => [
      String(p.team_id),
      {
        method: String(p.method ?? 'bkash') as Team['payment']['method'],
        senderNo: String(p.sender_no ?? ''),
        trxId: String(p.trx_id ?? ''),
        amount: Number(p.amount ?? 0),
        verifiedAt: p.verified_at ? String(p.verified_at) : undefined,
        verifiedBy: p.verified_by ? String(p.verified_by) : undefined,
      },
    ])
  );

  const subBy = new Map(
    (subsRes.rows as Record<string, unknown>[]).map((s) => [String(s.team_id), mapSubmission(s)])
  );

  return teamRows.map((t) => {
    const row = t as Record<string, unknown>;
    const id = String(row.id);
    const base: Team = {
      id,
      teamName: String(row.team_name ?? ''),
      university: String(row.university ?? ''),
      description: row.description ? String(row.description) : undefined,
      status: String(row.status ?? 'pending') as Team['status'],
      isFinalist: Boolean(row.is_finalist),
      finalistSetAt: row.finalist_set_at ? String(row.finalist_set_at) : undefined,
      createdAt: String(row.created_at ?? ''),
      banned: Boolean(row.banned),
      members: membersBy.get(id) || [],
      payment: payBy.get(id) || { method: 'bkash', senderNo: '', trxId: '', amount: 0 },
      submission: subBy.get(id),
    } as Team;

    if (level !== 'full') return base;

    return {
      ...base,
      adminNote: row.admin_note ? String(row.admin_note) : undefined,
      reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
      reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
      deadlineOverride: row.deadline_override ? String(row.deadline_override) : undefined,
      account: row.login_email
        ? {
            loginEmail: String(row.login_email),
            mustChangePassword: Boolean(row.must_change_password),
            credentialsSent: Boolean(row.credentials_sent),
            credentialsSentAt: row.credentials_sent_at ? String(row.credentials_sent_at) : undefined,
          }
        : undefined,
    } as Team;
  });
}
