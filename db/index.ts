import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { sanitizeErrorMessage } from './safety';

// Ensure environment variables are loaded
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Resolves the database connection URL strictly according to NODE_ENV:
 * - When NODE_ENV=test: strictly requires TEST_DATABASE_URL and fails closed if missing.
 *   Never falls back to DATABASE_URL in test mode.
 * - In non-test environments: requires DATABASE_URL.
 */
export function getDatabaseUrl(): string {
  const isTestEnv = process.env.NODE_ENV === 'test';

  if (isTestEnv) {
    const testUrl = process.env.TEST_DATABASE_URL;
    if (!testUrl || testUrl.trim() === '') {
      throw new Error(
        'FATAL: TEST_DATABASE_URL is required when NODE_ENV=test. Failing closed. ' +
        'Never falling back to DATABASE_URL in test mode.'
      );
    }
    return testUrl;
  }

  const devUrl = process.env.DATABASE_URL;
  if (!devUrl || devUrl.trim() === '') {
    throw new Error('FATAL: DATABASE_URL is not defined in environment.');
  }
  return devUrl;
}

// Global pool instance to prevent multiple connections in Next.js development HMR
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = getDatabaseUrl();

    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('[PostgreSQL Pool Error]', sanitizeErrorMessage(err.message || String(err)));
    });
  }
  return pool;
}

/**
 * Cleanly closes the active pool and resets reference.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    const p = pool;
    pool = null;
    await p.end().catch(() => {});
  }
}

/**
 * Execute parameterized query safely using the connection pool
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const currentPool = getPool();
  return currentPool.query<T>(text, params);
}

/**
 * Get dedicated client for transactions
 */
export async function getClient(): Promise<PoolClient> {
  const currentPool = getPool();
  return currentPool.connect();
}

/**
 * Helper to execute a callback within a managed transaction
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
