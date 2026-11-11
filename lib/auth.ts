import { cookies, headers } from 'next/headers';
import { connection } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';

export const SESSION_COOKIE = 'cou_ai_hackathon_session';

export type SessionRole = 'visitor' | 'team' | 'judge' | 'moderator' | 'super_admin';

export interface SessionUser {
  sub: string;
  role: Exclude<SessionRole, 'visitor'>;
  email: string;
  name: string;
  teamId?: string;
}

const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * Resolves the signing secret lazily. Doing this at module scope would break
 * `next build`, because the build evaluates route modules without a runtime
 * environment.
 */
export function resolveSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (IS_PROD) {
    throw new Error('JWT_SECRET must be set in production.');
  }
  return 'dev-secret-change-me';
}

export const STAFF_ROLES: SessionUser['role'][] = ['super_admin', 'moderator', 'judge'];
export const ADMIN_ROLES: SessionUser['role'][] = ['super_admin', 'moderator'];

export const sha256 = (value: unknown) =>
  createHash('sha256').update(String(value)).digest('hex');

export const makePassword = (prefix: string) =>
  `${prefix}_${randomBytes(5).toString('hex').slice(0, 7)}!`;

export function signToken(payload: Omit<SessionUser, 'sub'> & { sub: string; teamId?: string }) {
  return jwt.sign(payload, resolveSecret(), { expiresIn: '8h' });
}

/** Reads the signed session from the httpOnly cookie (with a Bearer fallback). */
export async function getSession(): Promise<SessionUser | null> {
  // Stop prerendering here: this handler always depends on the incoming request.
  // Next.js rejects `connection()` while it probes routes at build time, which
  // is expected - it simply means the route stays dynamic.
  try {
    await connection();
  } catch {
    return null;
  }

  const headerList = await headers();
  const header = headerList.get('authorization');

  if (header?.startsWith('Bearer ')) {
    try {
      return jwt.verify(header.slice(7), resolveSecret()) as SessionUser;
    } catch {
      return null;
    }
  }

  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    return jwt.verify(token, resolveSecret()) as SessionUser;
  } catch {
    return null;
  }
}

/** Writes the session cookie (httpOnly, sameSite lax, secure in production). */
export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    path: '/',
    maxAge: 60 * 60 * 8,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export { httpError } from './http';
