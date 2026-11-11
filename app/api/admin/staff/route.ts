import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { q } from '@/lib/db';
import { makePassword } from '@/lib/auth';
import { requireRole } from '@/lib/guards';
import { handle, httpError, jsonOk, normalizeEmail, str } from '@/lib/http';
import { audit } from '@/lib/data';


export const POST = handle(async (req: Request) => {
  const user = await requireRole('super_admin');
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const name = str(body.name);
  const email = normalizeEmail(body.email);
  const role = str(body.role);

  if (!name || !email || !['moderator', 'judge'].includes(role)) {
    throw httpError(400, 'Name, email, and a valid role are required.');
  }

  const existing = await q('SELECT 1 FROM public.staff WHERE LOWER(email) = $1', [email]);
  if (existing.rowCount) throw httpError(409, 'Staff with this email already exists.');

  const tempPassword = makePassword(role);
  const { rows } = await q(
    `INSERT INTO public.staff (id, name, email, password_hash, must_change_password, role, active)
     VALUES ($1,$2,$3,$4,true,$5,true)
     RETURNING id, name, email, role, active, must_change_password, created_at`,
    [randomUUID(), name, email, await bcrypt.hash(tempPassword, 10), role]
  );

  await audit(user, 'CREATE_STAFF', 'staff', (rows[0] as { id: string }).id, { role, email });

  return jsonOk({ success: true, tempPassword, staff: rows[0] });
});
