import { randomUUID } from 'node:crypto';
import { q } from '@/lib/db';
import { requireRole } from '@/lib/guards';
import { handle, httpError, jsonOk, str } from '@/lib/http';
import { audit, mapDoc } from '@/lib/data';
import { DOC_BUCKET, DOC_EXT_ALLOWED, removeFiles, requireStorage } from '@/lib/storage';


const MAX_DOC_BYTES = 25 * 1024 * 1024;

export const POST = handle(async (req: Request) => {
  const user = await requireRole('super_admin');
  const formData = await req.formData();

  const title = str(formData.get('title'));
  const rawKind = str(formData.get('kind'));
  const kind = ['guideline', 'rulebook', 'problem_statement', 'other'].includes(rawKind)
    ? rawKind
    : 'other';

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    throw httpError(400, 'Please choose a file to upload.');
  }
  if (!title) throw httpError(400, 'Document title is required.');
  if (file.size > MAX_DOC_BYTES) throw httpError(400, 'File is too large (max 25 MB).');

  const originalName = file.name || 'document';
  const ext = (originalName.split('.').pop() || '').toLowerCase();
  if (!DOC_EXT_ALLOWED.includes(ext)) {
    throw httpError(400, `File type .${ext} is not allowed.`);
  }

  const storage = requireStorage();
  const safeName = originalName.replace(/[^\w.\- ]+/g, '_').slice(0, 120);
  const key = `scenarios/${randomUUID()}-${safeName.replace(/ /g, '_')}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await storage.storage.from(DOC_BUCKET).upload(key, buffer, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (error) throw httpError(502, `Upload failed: ${error.message}`);

  try {
    const count = (
      await q('SELECT COUNT(*)::int AS n FROM public.documents')
    ).rows[0] as { n: number };

    const { rows } = await q(
      `INSERT INTO public.documents (id, title, kind, file_key, file_name, size_bytes, visible, sort_order, uploaded_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,NOW()) RETURNING *`,
      [randomUUID(), title, kind, key, safeName, file.size, count.n + 1, user.sub]
    );

    const document = mapDoc(rows[0] as Record<string, unknown>);
    await audit(user, 'UPLOAD_DOCUMENT', 'document', document.id, { title, size: file.size });

    return jsonOk({ success: true, document });
  } catch (e) {
    await removeFiles(DOC_BUCKET, [key]);
    throw e;
  }
});
