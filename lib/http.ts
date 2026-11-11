import { NextResponse } from 'next/server';

export function httpError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status });
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(status: number, message: string, detail?: string) {
  return NextResponse.json(
    { success: false, error: message, ...(detail ? { detail } : {}) },
    { status }
  );
}

/**
 * Wraps an async route handler so thrown errors become clean JSON responses
 * instead of an unhandled rejection. Mirrors the original Express `h()` wrapper.
 */
export function handle<T extends unknown[]>(
  fn: (...args: T) => Promise<Response>
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      return await fn(...args);
    } catch (err) {
      const anyErr = err as { code?: string; status?: number; message?: string };

      if (anyErr.code === '23505') {
        return jsonError(
          409,
          'Duplicate value: this team name, email, student ID or transaction ID is already registered.'
        );
      }
      if (anyErr.code === '22001') {
        return jsonError(400, 'One of the fields is too long. Please shorten it and try again.');
      }

      const status = anyErr.status ?? 500;
      if (status >= 500) {
        if (status === 503) {
          // A configuration problem (missing DATABASE_URL / storage), not a crash.
          console.warn('[api] service unavailable:', anyErr.message);
        } else {
          console.error('[api] unhandled error:', anyErr.message, err);
        }
      }

      return jsonError(
        status,
        status >= 500 && !anyErr.status ? 'Server error. Please try again.' : (anyErr.message ?? 'Bad request'),
        status >= 500 && status !== 503 ? anyErr.message : undefined
      );
    }
  };
}

export const str = (v: unknown): string => String(v ?? '').trim();
export const normalizeEmail = (v: unknown): string => String(v ?? '').trim().toLowerCase();
