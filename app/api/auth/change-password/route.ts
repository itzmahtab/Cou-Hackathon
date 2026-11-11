import bcrypt from 'bcryptjs';
import { q } from '@/lib/db';
import { requireRole } from '@/lib/guards';
import { handle, httpError, jsonOk } from '@/lib/http';
import { audit } from '@/lib/data';


export const POST = handle(async (req: Request) => {
  const user = await requireRole();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const newPassword = String(body.newPassword ?? '');

  if (newPassword.length < 6) throw httpError(400, 'Password must be at least 6 characters long.');

  const hash = await bcrypt.hash(newPassword, 10);
  if (user.role === 'team') {
    await q(
      'UPDATE public.team_accounts SET password_hash = $1, must_change_password = false WHERE team_id::text = $2',
      [hash, user.sub]
    );
  } else {
    await q(
      'UPDATE public.staff SET password_hash = $1, must_change_password = false WHERE id = $2',
      [hash, user.sub]
    );
  }

  await audit(user, 'CHANGE_PASSWORD', user.role, user.sub, {});
  return jsonOk({ success: true });
});
