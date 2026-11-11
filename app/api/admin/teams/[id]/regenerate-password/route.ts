import bcrypt from 'bcryptjs';
import { q } from '@/lib/db';
import { makePassword } from '@/lib/auth';
import { requireRole } from '@/lib/guards';
import { handle, httpError, jsonOk } from '@/lib/http';
import { audit } from '@/lib/data';


export const POST = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireRole('super_admin', 'moderator');
    const { id } = await ctx.params;

    const newPassword = makePassword('cou');
    const r = await q(
      `UPDATE public.team_accounts SET password_hash = $1, must_change_password = true, credentials_sent = false,
              credentials_sent_at = NULL, failed_logins = 0, locked_until = NULL WHERE team_id::text = $2`,
      [await bcrypt.hash(newPassword, 10), id]
    );
    if (!r.rowCount) throw httpError(404, 'Team account not found.');

    await audit(user, 'REGENERATE_PASSWORD', 'team', id, {});
    return jsonOk({ success: true, newPassword });
  }
);
