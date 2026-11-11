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
  UserRole,
} from './index';

/** Shape of the `GET /api/data` payload. */
export interface ApiDataPayload {
  success: boolean;
  settings: SystemSettings & Record<string, unknown>;
  teams: Team[];
  staff: StaffAccount[];
  documents: ScenarioDocument[];
  reviews: Review[];
  onsiteScores: OnsiteScore[];
  checkins: Checkin[];
  finalResults: FinalResult[];
  auditLogs: AuditLogEntry[];
}

/** Shape of the `GET /api/auth/me` payload. */
export interface SessionPayload {
  success: boolean;
  role: UserRole;
  user: {
    id: string;
    name: string;
    email: string;
    teamId?: string;
    mustChangePassword?: boolean;
  } | null;
}

/** Payload returned by the staff and team login endpoints. */
export interface LoginPayload {
  success: boolean;
  token?: string;
  role?: UserRole;
  user: {
    id: string;
    name: string;
    email: string;
    teamId?: string;
    mustChangePassword: boolean;
  };
}

/** Registration payload sent to `POST /api/teams/register`. */
export interface RegisterPayload {
  teamName: string;
  university: string;
  description?: string;
  members: Array<{
    id?: string;
    isLeader?: boolean;
    fullName: string;
    studentId: string;
    email: string;
    phone: string;
    department: string;
    year: string;
  }>;
  payment: {
    method: string;
    senderNo: string;
    trxId: string;
    amount: number;
  };
}
