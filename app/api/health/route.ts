import { pool } from '@/lib/db';
import { supabase } from '@/lib/storage';
import { handle, jsonOk } from '@/lib/http';


export const GET = handle(async () =>
  jsonOk({
    ok: true,
    timestamp: new Date().toISOString(),
    databaseConfigured: Boolean(pool),
    storageConfigured: Boolean(supabase),
    jwtConfigured: Boolean(process.env.JWT_SECRET),
  })
);
