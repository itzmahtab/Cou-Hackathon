import { getSession, type SessionUser } from './auth';
import { httpError } from './http';

/**
 * Resolves the current session and asserts that the caller holds one of the
 * given roles. Mirrors the Express `requireRole(...roles)` middleware.
 */
export async function requireRole(...roles: SessionUser['role'][]): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw httpError(401, 'Please sign in again.');
  if (roles.length && !roles.includes(user.role)) {
    throw httpError(403, 'You do not have permission to do this.');
  }
  if (user.role === 'super_admin' || user.role === 'moderator' || user.role === 'judge') {
    const { q } = await import('./db');
    const { rows } = await q('SELECT active FROM public.staff WHERE id = $1', [user.sub]);
    if (!rows[0] || !rows[0].active) {
      throw httpError(403, 'This staff account is no longer active.');
    }
  }
  return user;
}

/** Resolves the session without enforcing anything (optional auth). */
export async function optionalAuth(): Promise<SessionUser | null> {
  return getSession();
}
