import bcrypt from 'bcryptjs';
import { q } from '@/lib/db';
import { signToken, setSessionCookie } from '@/lib/auth';
import { handle, httpError, jsonOk, normalizeEmail } from '@/lib/http';
import { audit } from '@/lib/data';


export const POST = handle(async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = normalizeEmail(body.email);
  const password = String(body.password ?? '');

  if (!email || !password) throw httpError(400, 'Email and password are required.');

  const { rows } = await q(
    `SELECT id, name, email, password_hash, must_change_password, role, active, failed_logins, locked_until
     FROM public.staff WHERE LOWER(email) = $1 LIMIT 1`,
    [email]
  );
  const staff = rows[0] as Record<string, unknown> | undefined;
  if (!staff) throw httpError(401, 'Invalid email or password.');

  if (staff.locked_until && new Date(String(staff.locked_until)) > new Date()) {
    throw httpError(423, 'This account is temporarily locked. Try again later.');
  }
  if (!staff.active) throw httpError(403, 'This staff account has been deactivated.');

  if (!(await bcrypt.compare(password, String(staff.password_hash)))) {
    const failed = Number(staff.failed_logins || 0) + 1;
    const lock = failed >= 5 ? new Date(Date.now() + 15 * 60000).toISOString() : null;
    await q(
      'UPDATE public.staff SET failed_logins = $1, locked_until = $2 WHERE id = $3',
      [failed >= 5 ? 0 : failed, lock, staff.id]
    );
    throw httpError(
      401,
      failed >= 5 ? 'Too many failed attempts. Locked for 15 minutes.' : 'Invalid email or password.'
    );
  }

  await q(
    'UPDATE public.staff SET failed_logins = 0, locked_until = NULL WHERE id = $1',
    [staff.id]
  );

  const role = String(staff.role) as 'super_admin' | 'moderator' | 'judge';
  const token = signToken({
    sub: String(staff.id),
    role,
    email,
    name: String(staff.name),
  });
  await setSessionCookie(token);

  await audit({ role, sub: String(staff.id), name: String(staff.name) }, 'STAFF_LOGIN', 'staff', staff.id, {});

  return jsonOk({
    success: true,
    role,
    user: {
      id: String(staff.id),
      name: String(staff.name),
      email: String(staff.email),
      mustChangePassword: Boolean(staff.must_change_password),
    },
  });
});
