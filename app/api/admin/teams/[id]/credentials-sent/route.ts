import { q } from '@/lib/db';
import { requireRole } from '@/lib/guards';
import { handle, jsonOk } from '@/lib/http';
import { audit } from '@/lib/data';


export const POST = handle(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireRole('super_admin', 'moderator');
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const sent = Boolean(body.sent);

    await q(
      'UPDATE public.team_accounts SET credentials_sent = $1, credentials_sent_at = CASE WHEN $1 THEN NOW() ELSE NULL END WHERE team_id::text = $2',
      [sent, id]
    );

    await audit(user, 'MARK_CREDENTIALS_SENT', 'team', id, { sent });
    return jsonOk({ success: true });
  }
);
