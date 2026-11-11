import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { q, withTransaction } from '@/lib/db';
import { handle, httpError, jsonOk, normalizeEmail, str } from '@/lib/http';
import { audit, getSettings } from '@/lib/data';
import { ID_BUCKET, requireStorage, sniffImage } from '@/lib/storage';


const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export const POST = handle(async (req: Request) => {
  const formData = await req.formData();

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(String(formData.get('payload') ?? '{}'));
  } catch {
    throw httpError(400, 'Invalid registration data.');
  }

  const settings = await getSettings();
  const now = Date.now();

  if (settings.registration_open_at && now < new Date(String(settings.registration_open_at)).getTime()) {
    throw httpError(403, 'Registration has not opened yet.');
  }
  if (settings.registration_close_at && now > new Date(String(settings.registration_close_at)).getTime()) {
    throw httpError(403, 'Registration is closed.');
  }

  const teamName = str(data.teamName);
  const members = Array.isArray(data.members) ? (data.members as Record<string, unknown>[]) : [];

  if (!teamName) throw httpError(400, 'Team name is required.');
  if (members.length < Number(settings.min_members) || members.length > Number(settings.max_members)) {
    throw httpError(
      400,
      `A team must have between ${settings.min_members} and ${settings.max_members} members.`
    );
  }

  members.forEach((m, i) => {
    if (
      !str(m.fullName) ||
      !str(m.studentId) ||
      !str(m.email) ||
      !str(m.phone) ||
      !str(m.department)
    ) {
      throw httpError(400, `Please fill all required fields for member ${i + 1}.`);
    }
    if (!/^\S+@\S+\.\S+$/.test(str(m.email))) {
      throw httpError(400, `Member ${i + 1} has an invalid email.`);
    }
  });

  const leaderIdx = Math.max(0, members.findIndex((m) => Boolean(m.isLeader)));
  const loginEmail = normalizeEmail(members[leaderIdx]?.email);
  const emails = members.map((m) => normalizeEmail(m.email));
  if (new Set(emails).size !== emails.length) {
    throw httpError(400, 'Each member must have a different email.');
  }

  const pay = (data.payment ?? {}) as Record<string, unknown>;
  const method = str(pay.method).toLowerCase();
  const trxId = str(pay.trxId).toUpperCase();

  if (!['bkash', 'nagad', 'rocket'].includes(method)) {
    throw httpError(400, 'Choose a valid payment method.');
  }
  if (!str(pay.senderNo) || !trxId) {
    throw httpError(400, 'Payment sender number and transaction ID are required.');
  }

  // Duplicate checks
  const dupName = await q('SELECT 1 FROM public.teams WHERE LOWER(team_name) = LOWER($1) LIMIT 1', [
    teamName,
  ]);
  if (dupName.rowCount) {
    throw httpError(409, `Team name "${teamName}" is already registered.`);
  }

  const dupEmail = await q(
    `SELECT m.email FROM public.members m JOIN public.teams t ON t.id = m.team_id
     WHERE LOWER(m.email) = ANY($1::text[]) AND t.status <> 'rejected' LIMIT 1`,
    [emails]
  );
  if (dupEmail.rowCount) {
    throw httpError(
      409,
      `Member email "${(dupEmail.rows[0] as { email: string }).email}" is already registered with another team.`
    );
  }

  const dupTrx = await q(
    `SELECT 1 FROM public.payments p JOIN public.teams t ON t.id = p.team_id
     WHERE p.method = $1 AND UPPER(p.trx_id) = $2 LIMIT 1`,
    [method, trxId]
  );
  if (dupTrx.rowCount) {
    throw httpError(409, `Transaction ID "${trxId}" has already been submitted for ${method}.`);
  }

  // ---- Persist ID card photos to Supabase storage ----
  const teamId = randomUUID();
  const uploadedKeys: string[] = [];
  const memberRows: { id: string; m: Record<string, unknown>; key: string | null; isLeader: boolean }[] =
    [];

  try {
    const storage = requireStorage();

    for (let i = 0; i < members.length; i++) {
      const memberId = randomUUID();
      let key: string | null = null;

      const file = formData.get(`idCard_${i}`);
      if (file instanceof File && file.size > 0) {
        if (file.size > MAX_IMAGE_BYTES) {
          throw httpError(400, `The ID photo for member ${i + 1} is larger than 2 MB.`);
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        const kind = sniffImage(buffer);
        if (!kind) {
          throw httpError(400, `The ID photo for member ${i + 1} must be a JPG, PNG or WebP image.`);
        }
        key = `teams/${teamId}/${memberId}.${kind.ext}`;
        const { error } = await storage.storage
          .from(ID_BUCKET)
          .upload(key, buffer, { contentType: kind.type, upsert: false });
        if (error) {
          throw httpError(502, `Could not store the ID photo for member ${i + 1}: ${error.message}`);
        }
        uploadedKeys.push(key);
      }

      memberRows.push({ id: memberId, m: members[i], key, isLeader: i === leaderIdx });
    }

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO public.teams (id, team_name, university, description, status, is_finalist, created_at)
         VALUES ($1,$2,$3,$4,'pending',false,NOW())`,
        [teamId, teamName, str(data.university), str(data.description)]
      );

      // Placeholder hash: the real password is created when an organizer approves the team.
      await client.query(
        `INSERT INTO public.team_accounts (team_id, login_email, password_hash, must_change_password, credentials_sent, failed_logins, created_at)
         VALUES ($1,$2,$3,true,false,0,NOW())`,
        [teamId, loginEmail, await bcrypt.hash(randomUUID() + randomUUID(), 8)]
      );

      for (const r of memberRows) {
        await client.query(
          `INSERT INTO public.members (id, team_id, is_leader, full_name, student_id, email, phone, department, year, id_card_key)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            r.id,
            teamId,
            r.isLeader,
            str(r.m.fullName),
            str(r.m.studentId),
            normalizeEmail(r.m.email),
            str(r.m.phone),
            str(r.m.department),
            str(r.m.year),
            r.key,
          ]
        );
      }

      await client.query(
        'INSERT INTO public.payments (id, team_id, method, sender_no, trx_id, amount) VALUES ($1,$2,$3,$4,$5,$6)',
        [randomUUID(), teamId, method, str(pay.senderNo), trxId, Number(settings.registration_fee_bdt) || 0]
      );
    });
  } catch (e) {
    const { removeFiles } = await import('@/lib/storage');
    await removeFiles(ID_BUCKET, uploadedKeys);
    throw e;
  }

  await audit(
    { role: 'visitor', name: str(members[leaderIdx]?.fullName) },
    'REGISTER_TEAM',
    'team',
    teamId,
    { teamName, method, trxId }
  );

  return jsonOk({
    success: true,
    teamId,
    message: 'Team registration received. Awaiting admin approval.',
  });
});
