'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import {
  Team,
  TeamMember,
  StaffAccount,
  SystemSettings,
  ScenarioDocument,
  Review,
  OnsiteScore,
  Checkin,
  FinalResult,
  AuditLogEntry,
  CorrectionToken,
  UserRole,
} from '@/types';
import type { ApiDataPayload, LoginPayload, SessionPayload } from '@/types/api';
import {
  calculateOnlineAverage,
  calculateOnsiteAverage,
  calculateFinalScore,
  suggestTopNFinalists,
} from '@/utils/rules';
import { DEFAULT_SETTINGS } from '@/lib/defaults';

export interface AuthSession {
  role: UserRole;
  user: {
    id: string;
    name: string;
    email: string;
    teamId?: string;
    mustChangePassword?: boolean;
  } | null;
}

type Result = { success: boolean; error?: string };

export interface CorrectionInfo {
  teamName: string;
  university: string;
  reason: string;
  usedAt?: string | null;
  expired: boolean;
  method: string;
  senderNo: string;
  amount: number;
}

interface AppContextType {
  settings: SystemSettings;
  updateSettings: (newSettings: Partial<SystemSettings>) => Promise<void>;
  teams: Team[];
  staff: StaffAccount[];
  documents: ScenarioDocument[];
  reviews: Review[];
  onsiteScores: OnsiteScore[];
  checkins: Checkin[];
  finalResults: FinalResult[];
  auditLogs: AuditLogEntry[];
  correctionTokens: CorrectionToken[];
  auth: AuthSession;
  refresh: () => Promise<void>;

  loginTeam: (email: string, pass: string) => Promise<Result & { mustChangePassword?: boolean }>;
  loginStaff: (email: string, pass: string) => Promise<Result & { role?: UserRole; mustChangePassword?: boolean }>;
  logout: () => void;
  changePassword: (newPass: string) => Promise<Result>;
  switchRoleQuick: (role: UserRole, targetId?: string) => void;

  registerTeam: (teamData: Omit<Team, 'id' | 'status' | 'createdAt' | 'isFinalist'>) => Promise<Result & { teamId?: string }>;
  getCorrectionInfo: (token: string) => Promise<{ success: boolean; error?: string; info?: CorrectionInfo }>;
  submitPaymentCorrection: (token: string, newSenderNo: string, newTrxId: string) => Promise<Result>;

  approveTeam: (teamId: string) => Promise<Result & { temporaryPassword?: string; email?: string }>;
  rejectTeam: (teamId: string, reason: string) => Promise<Result>;
  requestCorrection: (teamId: string, reason: string) => Promise<Result & { token?: string }>;
  regenerateTeamPassword: (teamId: string) => Promise<Result & { newPassword?: string }>;
  markCredentialsSent: (teamId: string, sent: boolean) => Promise<void>;
  getIdCardUrls: (teamId: string) => Promise<Record<string, string>>;

  uploadDocument: (input: { title: string; kind: ScenarioDocument['kind']; file: File }) => Promise<Result>;
  deleteDocument: (id: string) => Promise<void>;
  toggleDocumentVisibility: (id: string) => Promise<void>;
  downloadDocument: (id: string) => Promise<Result>;

  saveSubmission: (abstract: string, repoUrl: string, videoUrl: string) => Promise<Result>;
  triggerSnapshot: (teamId: string) => { success: boolean };

  submitReview: (teamId: string, score: number, comment: string, isFinal: boolean) => Promise<Result>;
  submitOnsiteScore: (teamId: string, score: number, comment?: string, isFinal?: boolean) => Promise<Result>;
  lockJudging: (lock: boolean) => void;
  releaseResults: (release: boolean) => void;

  createStaff: (name: string, email: string, role: 'moderator' | 'judge') => Promise<Result & { tempPassword?: string }>;
  toggleStaffActive: (id: string) => void;
  deleteStaff: (id: string) => void;

  bannedTeamIds: string[];
  toggleTeamBan: (teamId: string) => void;
  deleteTeam: (teamId: string) => void;

  setFinalist: (teamId: string, isFinalist: boolean) => void;
  suggestFinalists: (n?: number) => void;
  checkinTeam: (teamId: string, membersPresent: number) => Promise<Result>;
  computeFinalResults: () => void;
  publishFinalResults: (publish: boolean) => void;
  setDeadlineOverride: (teamId: string, newEndAt: string, reason: string) => void;
  purgeIdPhotos: () => void;
  resetAllDataToDefaults: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

/**
 * Session state lives in an httpOnly cookie managed by the API routes.
 * `fetch` sends it automatically for same-origin requests.
 */
const apiFetch = async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
  const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...((init.headers as Record<string, string>) || {}),
  };

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers,
      credentials: 'include',
      cache: 'no-store',
    });
  } catch {
    throw new Error('Cannot reach the server. Check your internet connection and try again.');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new Event('cou-auth-expired'));
    }
    throw new Error(payload.error || payload.message || `Request failed (${response.status})`);
  }
  return payload as T;
};

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [teams, setTeams] = useState<Team[]>([]);
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [documents, setDocuments] = useState<ScenarioDocument[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [onsiteScores, setOnsiteScores] = useState<OnsiteScore[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [finalResults, setFinalResults] = useState<FinalResult[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [correctionTokens] = useState<CorrectionToken[]>([]);
  const [bannedTeamIds, setBannedTeamIds] = useState<string[]>([]);
  const [auth, setAuth] = useState<AuthSession>({ role: 'visitor', user: null });
  const [hydrated, setHydrated] = useState(false);

  /* ---------------- loading everything the current user may see ---------------- */

  const loadAll = useCallback(async () => {
    try {
      const d = await apiFetch<ApiDataPayload>('/api/data');
      if (d.settings) {
        const next = { ...DEFAULT_SETTINGS, ...d.settings };
        setSettings((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      }
      const t: Team[] = d.teams || [];
      setTeams(t);
      setBannedTeamIds(t.filter((x) => x.banned).map((x) => x.id));
      setStaff(d.staff || []);
      setDocuments(d.documents || []);
      setReviews(d.reviews || []);
      setOnsiteScores(d.onsiteScores || []);
      setCheckins(d.checkins || []);
      setFinalResults(d.finalResults || []);
      setAuditLogs(d.auditLogs || []);
    } catch (e) {
      console.warn('Unable to load data:', errMsg(e));
    }
  }, []);

  const loadRef = useRef(loadAll);

  useEffect(() => {
    loadRef.current = loadAll;
  }, [loadAll]);

  /* ---------------- restore the session from the httpOnly cookie ---------------- */

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await apiFetch<SessionPayload>('/api/auth/me');
        if (cancelled) return;
        if (res?.user) {
          setAuth({ role: res.role ?? 'visitor', user: res.user });
        } else {
          setAuth({ role: 'visitor', user: null });
        }
      } catch {
        if (!cancelled) setAuth({ role: 'visitor', user: null });
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    // Synchronising with an external system (our own API) is exactly what an
    // effect is for. `loadAll` is async, so the state updates land after the
    // request resolves rather than during this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, [loadAll, hydrated, auth.user?.id]);

  useEffect(() => {
    const onExpired = () => {
      setAuth({ role: 'visitor', user: null });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadRef.current();
    };
    window.addEventListener('cou-auth-expired', onExpired);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('cou-auth-expired', onExpired);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Run a mutation, reload data, and tell the user if it failed.
  const mutate = async <T extends Result>(fn: () => Promise<T>): Promise<T> => {
    try {
      const res = await fn();
      await loadAll();
      return res;
    } catch (e) {
      return { success: false, error: errMsg(e) } as T;
    }
  };

  const mutateAlert = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await loadAll();
    } catch (e) {
      window.alert(errMsg(e));
    }
  };

  const post = <T = Record<string, unknown>,>(path: string, body?: unknown, method = 'POST') =>
    apiFetch<T>(path, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  /* ---------------- settings ---------------- */

  const updateSettings = async (newSettings: Partial<SystemSettings>) => {
    const next = { ...settings, ...newSettings };
    setSettings(next);
    try {
      await post('/api/admin/settings', next);
      await loadAll();
    } catch (e) {
      window.alert(`Settings were NOT saved: ${errMsg(e)}`);
      await loadAll();
    }
  };

  /* ---------------- auth ---------------- */

  const loginTeam: AppContextType['loginTeam'] = async (email, pass) => {
    try {
      const p = await post<LoginPayload>('/api/auth/team-login', {
        email: email.trim().toLowerCase(),
        password: pass,
      });
      setAuth({
        role: 'team',
        user: {
          id: p.user.id,
          name: p.user.name,
          email: p.user.email,
          teamId: p.user.teamId,
          mustChangePassword: Boolean(p.user.mustChangePassword),
        },
      });
      return { success: true, mustChangePassword: Boolean(p.user.mustChangePassword) };
    } catch (e) {
      return { success: false, error: errMsg(e) };
    }
  };

  const loginStaff: AppContextType['loginStaff'] = async (email, pass) => {
    try {
      const p = await post<LoginPayload>('/api/auth/staff-login', {
        email: email.trim().toLowerCase(),
        password: pass,
      });
      const role = (p.role ?? 'visitor') as UserRole;
      setAuth({
        role,
        user: {
          id: p.user.id,
          name: p.user.name,
          email: p.user.email,
          mustChangePassword: Boolean(p.user.mustChangePassword),
        },
      });
      return { success: true, role, mustChangePassword: Boolean(p.user.mustChangePassword) };
    } catch (e) {
      return { success: false, error: errMsg(e) };
    }
  };

  const logout = () => {
    void fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setAuth({ role: 'visitor', user: null });
  };

  const changePassword = async (newPass: string): Promise<Result> => {
    try {
      await post('/api/auth/change-password', { newPassword: newPass });
      setAuth((prev) => ({
        ...prev,
        user: prev.user ? { ...prev.user, mustChangePassword: false } : null,
      }));
      return { success: true };
    } catch (e) {
      return { success: false, error: errMsg(e) };
    }
  };

  // Kept only so old imports don't break. The server enforces real permissions.
  const switchRoleQuick = (role: UserRole) => {
    if (role === 'visitor') logout();
  };

  /* ---------------- registration & payment correction ---------------- */

  const registerTeam: AppContextType['registerTeam'] = async (teamData) => {
    try {
      const form = new FormData();
      const members = teamData.members.map((m, i) => {
        if (m.idCardFileObj instanceof File) form.append(`idCard_${i}`, m.idCardFileObj);
        // Strip the local-only preview fields before sending the payload.
        const rest: Partial<TeamMember> = { ...m };
        delete rest.idCardPhotoUrl;
        delete rest.idCardFileObj;
        return rest;
      });
      form.append('payload', JSON.stringify({ ...teamData, members }));
      const p = await apiFetch<{ teamId: string }>('/api/teams/register', {
        method: 'POST',
        body: form,
      });
      await loadAll();
      return { success: true, teamId: p.teamId };
    } catch (e) {
      return { success: false, error: errMsg(e) };
    }
  };

  const getCorrectionInfo: AppContextType['getCorrectionInfo'] = async (token) => {
    try {
      const p = await apiFetch<CorrectionInfo>(`/api/corrections/${encodeURIComponent(token)}`);
      return { success: true, info: p as CorrectionInfo };
    } catch (e) {
      return { success: false, error: errMsg(e) };
    }
  };

  const submitPaymentCorrection: AppContextType['submitPaymentCorrection'] = async (
    token,
    senderNo,
    trxId
  ) => {
    try {
      await post(`/api/corrections/${encodeURIComponent(token)}`, { senderNo, trxId });
      return { success: true };
    } catch (e) {
      return { success: false, error: errMsg(e) };
    }
  };

  /* ---------------- moderation ---------------- */

  const approveTeam = (teamId: string) =>
    mutate(async () => {
      const p = await post('/api/admin/teams/approve', { teamId });
      return { success: true, temporaryPassword: p.temporaryPassword as string, email: p.email as string };
    });

  const rejectTeam = (teamId: string, reason: string) =>
    mutate(async () => {
      await post('/api/admin/teams/reject', { teamId, reason });
      return { success: true };
    });

  const requestCorrection = (teamId: string, reason: string) =>
    mutate(async () => {
      const p = await post('/api/admin/teams/correction', { teamId, reason });
      return { success: true, token: p.token as string };
    });

  const regenerateTeamPassword = (teamId: string) =>
    mutate(async () => {
      const p = await post(`/api/admin/teams/${teamId}/regenerate-password`);
      return { success: true, newPassword: p.newPassword as string };
    });

  const markCredentialsSent = (teamId: string, sent: boolean) =>
    mutateAlert(() => post(`/api/admin/teams/${teamId}/credentials-sent`, { sent }));

  const getIdCardUrls = async (teamId: string) => {
    try {
      const p = await apiFetch<{ urls: Record<string, string> }>(
        `/api/admin/teams/${teamId}/id-cards`
      );
      return p.urls || {};
    } catch (e) {
      console.warn('Could not load ID photos:', errMsg(e));
      return {};
    }
  };

  const toggleTeamBan = (teamId: string) => void mutateAlert(() => post(`/api/admin/teams/${teamId}/ban`));
  const deleteTeam = (teamId: string) =>
    void mutateAlert(() => apiFetch(`/api/admin/teams/${teamId}`, { method: 'DELETE' }));
  const setDeadlineOverride = (teamId: string, newEndAt: string, reason: string) =>
    void mutateAlert(() =>
      post(`/api/admin/teams/${teamId}/deadline`, { deadlineOverride: newEndAt, reason })
    );
  const purgeIdPhotos = () => void mutateAlert(() => post('/api/admin/purge-id-photos'));
  const resetAllDataToDefaults = () =>
    void mutateAlert(async () => {
      await post('/api/admin/reset');
      logout();
    });

  /* ---------------- documents (real files) ---------------- */

  const uploadDocument: AppContextType['uploadDocument'] = ({ title, kind, file }) =>
    mutate(async () => {
      const form = new FormData();
      form.append('title', title);
      form.append('kind', kind);
      form.append('file', file);
      await apiFetch('/api/admin/documents', { method: 'POST', body: form });
      return { success: true };
    });

  const deleteDocument = (id: string) =>
    mutateAlert(() => apiFetch(`/api/admin/documents/${id}`, { method: 'DELETE' }));
  const toggleDocumentVisibility = (id: string) =>
    mutateAlert(() =>
      apiFetch(`/api/admin/documents/${id}/visibility`, { method: 'PATCH' })
    );

  const downloadDocument = async (id: string) => {
    try {
      const p = await apiFetch<{ url: string }>(`/api/documents/${id}/download`);
      window.open(p.url, '_blank', 'noopener');
      return { success: true };
    } catch (e) {
      return { success: false, error: errMsg(e) };
    }
  };

  /* ---------------- team submission ---------------- */

  const saveSubmission = (abstract: string, repoUrl: string, videoUrl: string) =>
    mutate(async () => {
      await post('/api/team/submission', { abstract, repoUrl, videoUrl });
      return { success: true };
    });

  // Snapshots are intentionally not implemented yet (skipped). Local-only demo; lost on refresh.
  const triggerSnapshot = () => {
    window.alert('Snapshots are not enabled yet.');
    return { success: false };
  };

  /* ---------------- judging ---------------- */

  const submitReview = (teamId: string, score: number, comment: string, isFinal: boolean) =>
    mutate(async () => {
      await post('/api/judge/reviews', { teamId, score, comment, isFinal });
      return { success: true };
    });

  const submitOnsiteScore = (
    teamId: string,
    score: number,
    comment?: string,
    isFinal = true
  ) =>
    mutate(async () => {
      await post('/api/judge/onsite', { teamId, score, comment, isFinal });
      return { success: true };
    });

  const lockJudging = (lock: boolean) => void updateSettings({ judging_locked: lock });
  const releaseResults = (release: boolean) => void updateSettings({ results_released: release });

  /* ---------------- staff ---------------- */

  const createStaff = (name: string, email: string, role: 'moderator' | 'judge') =>
    mutate(async () => {
      const p = await post('/api/admin/staff', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
      });
      return { success: true, tempPassword: p.tempPassword as string };
    });

  const toggleStaffActive = (id: string) => {
    const target = staff.find((s) => s.id === id);
    if (!target || target.role === 'super_admin') return;
    void mutateAlert(() =>
      apiFetch(`/api/admin/staff/${id}/toggle-active`, { method: 'PATCH' })
    );
  };

  const deleteStaff = (id: string) => {
    const target = staff.find((m) => m.id === id);
    if (!target || target.role === 'super_admin' || auth.user?.id === id) return;
    void mutateAlert(() => apiFetch(`/api/admin/staff/${id}`, { method: 'DELETE' }));
  };

  /* ---------------- finalists, check-in, results ---------------- */

  const setFinalist = (teamId: string, isFinalist: boolean) =>
    void mutateAlert(() => post(`/api/admin/teams/${teamId}/finalist`, { isFinalist }));

  const suggestFinalists = (n = settings.finalist_count_n || 10) => {
    const teamsWithAvg = teams.map((team) => ({
      team,
      onlineAvg: calculateOnlineAverage(reviews.filter((r) => r.teamId === team.id && r.isFinal)),
    }));
    const topIds = suggestTopNFinalists(teamsWithAvg, n).map((s) => s.teamId);
    void mutateAlert(() => post('/api/admin/finalists/bulk', { teamIds: topIds }));
  };

  const checkinTeam = (teamId: string, membersPresent: number) =>
    mutate(async () => {
      await post('/api/admin/checkins', { teamId, membersPresent });
      return { success: true };
    });

  const computeFinalResults = () => {
    const finalists = teams.filter((t) => t.isFinalist && t.status === 'approved');
    const computed = finalists.map((team) => {
      const onlineAvg = calculateOnlineAverage(
        reviews.filter((r) => r.teamId === team.id && r.isFinal)
      );
      const onsiteAvg = calculateOnsiteAverage(
        onsiteScores.filter((s) => s.teamId === team.id && s.isFinal)
      );
      return {
        teamId: team.id,
        teamName: team.teamName,
        university: team.university,
        onlineAvg,
        onsiteAvg,
        finalScore: calculateFinalScore(
          onlineAvg,
          onsiteAvg,
          settings.online_weight,
          settings.onsite_weight
        ),
        rank: 0,
        prizeLabel: '',
      };
    });
    computed.sort((a, b) => b.finalScore - a.finalScore);
    computed.forEach((item, i) => {
      item.rank = i + 1;
      item.prizeLabel =
        item.rank === 1
          ? 'Champion 🏆'
          : item.rank === 2
            ? '1st Runner-Up 🥈'
            : item.rank === 3
              ? '2nd Runner-Up 🥉'
              : item.rank <= 5
                ? 'Top 5 Finalist ⭐'
                : 'Finalist Participant';
    });
    void mutateAlert(() => post('/api/admin/final-results', { results: computed }));
  };

  const publishFinalResults = (publish: boolean) =>
    void mutateAlert(() => post('/api/admin/final-results/publish', { published: publish }));

  return (
    <AppContext.Provider
      value={{
        settings,
        updateSettings,
        teams,
        staff,
        documents,
        reviews,
        onsiteScores,
        checkins,
        finalResults,
        auditLogs,
        correctionTokens,
        auth,
        refresh: loadAll,
        loginTeam,
        loginStaff,
        logout,
        changePassword,
        switchRoleQuick,
        registerTeam,
        getCorrectionInfo,
        submitPaymentCorrection,
        approveTeam,
        rejectTeam,
        requestCorrection,
        regenerateTeamPassword,
        markCredentialsSent,
        getIdCardUrls,
        uploadDocument,
        deleteDocument,
        toggleDocumentVisibility,
        downloadDocument,
        saveSubmission,
        triggerSnapshot,
        submitReview,
        submitOnsiteScore,
        lockJudging,
        releaseResults,
        createStaff,
        toggleStaffActive,
        deleteStaff,
        bannedTeamIds,
        toggleTeamBan,
        deleteTeam,
        setFinalist,
        suggestFinalists,
        checkinTeam,
        computeFinalResults,
        publishFinalResults,
        setDeadlineOverride,
        purgeIdPhotos,
        resetAllDataToDefaults,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
