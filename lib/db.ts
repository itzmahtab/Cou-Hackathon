import { Pool, type QueryResultRow } from 'pg';

const globalForPg = globalThis as unknown as { couPgPool?: Pool };

const databaseUrl = process.env.DATABASE_URL;

const isLocal =
  /@(localhost|127\.0\.0\.1)[:/]/.test(databaseUrl || '') || process.env.DATABASE_SSL === 'false';

export const pool: Pool | null = databaseUrl
  ? globalForPg.couPgPool ??
    new Pool({
      connectionString: databaseUrl,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 10,
    })
  : null;

if (pool && process.env.NODE_ENV !== 'production') {
  globalForPg.couPgPool = pool;
}

if (pool) {
  pool.on('error', (err) => console.warn('PG pool error:', err.message));
}

/**
 * Runs a parameterised query. Throws if the database is not configured so that
 * route handlers surface a clear 503 instead of crashing.
 */
export async function q<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<{ rows: T[]; rowCount: number | null }> {
  if (!pool) {
    throw Object.assign(new Error('Database is not configured.'), { status: 503 });
  }
  const result = await pool.query<T>(text, params as never[]);
  return { rows: result.rows, rowCount: result.rowCount };
}

/** Runs several statements inside a single transaction. */
export async function withTransaction<T>(
  fn: (client: import('pg').PoolClient) => Promise<T>
): Promise<T> {
  if (!pool) {
    throw Object.assign(new Error('Database is not configured.'), { status: 503 });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
