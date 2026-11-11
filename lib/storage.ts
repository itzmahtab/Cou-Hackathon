import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const ID_BUCKET = 'id-cards';
export const DOC_BUCKET = 'scenario-docs';

const globalForSupabase = globalThis as unknown as { couSupabase?: SupabaseClient | null };

function createSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export const supabase: SupabaseClient | null =
  globalForSupabase.couSupabase !== undefined
    ? globalForSupabase.couSupabase
    : createSupabase();

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase.couSupabase = supabase;
}

export function requireStorage(): SupabaseClient {
  if (!supabase) {
    throw Object.assign(new Error('File storage is not configured on the server.'), { status: 503 });
  }
  return supabase;
}

/** Creates the two private buckets if they do not exist yet. */
export async function ensureBuckets(): Promise<void> {
  if (!supabase) {
    console.warn('WARNING: Supabase Storage not configured. File uploads will be rejected.');
    return;
  }
  for (const name of [ID_BUCKET, DOC_BUCKET]) {
    const { error } = await supabase.storage.createBucket(name, { public: false });
    if (error && !/already exists|duplicate/i.test(error.message)) {
      console.warn(`Could not create bucket ${name}:`, error.message);
    }
  }
}

export async function removeFiles(bucket: string, keys: (string | null | undefined)[]) {
  const real = keys.filter((k): k is string => Boolean(k));
  if (!supabase || real.length === 0) return;
  const { error } = await supabase.storage.from(bucket).remove(real);
  if (error) console.warn(`Storage remove failed (${bucket}):`, error.message);
}

/** Detects an image type from its magic bytes (never trusts the client mime type). */
export function sniffImage(buf: Buffer | Uint8Array) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' };
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', type: 'image/png' };
  }
  if (b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { ext: 'webp', type: 'image/webp' };
  }
  return null;
}

export const DOC_EXT_ALLOWED = [
  'pdf',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  'txt',
  'zip',
  'png',
  'jpg',
  'jpeg',
];
