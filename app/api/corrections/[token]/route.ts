import { q } from '@/lib/db';
import { sha256 } from '@/lib/auth';
import { handle, httpError, jsonOk, str } from '@/lib/http';
import { audit } from '@/lib/data';


async function loadCorrection(token: string) {
  const { rows } = await q(
    `SELECT c.*, t.team_name, t.university FROM public.correction_tokens c
     JOIN public.teams t ON t.id = c.team_id WHERE c.token_hash = $1`,
    [sha256(token)]
  );
  return rows[0] as Record<string, unknown> | undefined;
}

export const GET = handle(
  async (_req: Request, ctx: { params: Promise<{ token: string }> }) => {
    const { token } = await ctx.params;
    const c = await loadCorrection(token);
    if (!c) throw httpError(404, 'This correction link does not exist.');

    const pay =
      (
        await q('SELECT method, sender_no, amount FROM public.payments WHERE team_id::text = $1', [
          c.team_id,
        ])
      ).rows[0] ?? {};

    return jsonOk({
      success: true,
      teamName: c.team_name,
      university: c.university,
      reason: c.reason,
      usedAt: c.used_at,
      expired: new Date(String(c.expires_at)) < new Date(),
      method: pay.method || 'bkash',
      senderNo: pay.sender_no || '',
      amount: Number(pay.amount || 0),
    });
  }
);

export const POST = handle(
  async (req: Request, ctx: { params: Promise<{ token: string }> }) => {
    const { token } = await ctx.params;
    const c = await loadCorrection(token);
    if (!c) throw httpError(404, 'This correction link does not exist.');
    if (c.used_at) throw httpError(410, 'This link has already been used.');
    if (new Date(String(c.expires_at)) < new Date()) {
      throw httpError(410, 'This correction link has expired.');
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const senderNo = str(body.senderNo);
    const trxId = str(body.trxId).toUpperCase();

    if (!senderNo || !trxId) {
      throw httpError(400, 'Please enter both the sender number and the transaction ID.');
    }

    const pay = (
      await q('SELECT method FROM public.payments WHERE team_id::text = $1', [c.team_id])
    ).rows[0] as { method?: string } | undefined;

    const dup = await q(
      `SELECT 1 FROM public.payments p JOIN public.teams t ON t.id = p.team_id
       WHERE p.method = $1 AND UPPER(p.trx_id) = $2 AND t.id::text <> $3 LIMIT 1`,
      [pay?.method || 'bkash', trxId, c.team_id]
    );
    if (dup.rowCount) {
      throw httpError(409, 'This transaction ID was already used by another team.');
    }

    await q(
      'UPDATE public.payments SET sender_no = $1, trx_id = $2, verified_at = NULL, verified_by = NULL WHERE team_id::text = $3',
      [senderNo, trxId, c.team_id]
    );
    await q(
      `UPDATE public.teams SET status = 'pending', admin_note = NULL WHERE id::text = $1`,
      [c.team_id]
    );
    await q('UPDATE public.correction_tokens SET used_at = NOW() WHERE token_hash = $1', [
      sha256(token),
    ]);

    await audit({ role: 'team', name: String(c.team_name) }, 'CORRECTION_SUBMITTED', 'team', c.team_id, {
      trxId,
    });

    return jsonOk({ success: true });
  }
);
