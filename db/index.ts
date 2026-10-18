import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { verifyDatabaseSafety, sanitizeErrorMessage, SafetyCheckOptions } from './safety';

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

  // Serverless hosting (Vercel) starts many small instances, so keep each pool small.
    const isProduction = process.env.NODE_ENV === 'production';
    pool = new Pool({
      connectionString,
      max: isProduction ? 3 : 10,
      idleTimeoutMillis: isProduction ? 10000 : 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('[PostgreSQL Pool Error]', sanitizeErrorMessage(err.message || String(err)));
    });
  }
  return pool;
}

/**
 * Injects or resets the active pool instance (for mock testing and resource management).
 */
export function setPool(customPool: Pool | null): void {
  pool = customPool;
}

/**
 * Cleanly closes the active pool and resets reference.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    const p = pool;
    pool = null;
    if (typeof p.end === 'function') {
      await Promise.resolve(p.end()).catch(() => {});
    }
  }
}

/**
 * Checks out a client from the pool and immediately verifies that its actual
 * connected database (SELECT current_database()) matches the allowed database name
 * ('antigravity_dev' in development, 'antigravity_test' in test).
 *
 * If verification fails, the client is immediately released and an error is thrown.
 * Verification and subsequent writes are guaranteed to run on the EXACT SAME checked-out client.
 */
export async function getClient(options?: SafetyCheckOptions): Promise<PoolClient> {
  const currentPool = getPool();
  const client = await currentPool.connect();

  try {
    // Verifies connected database on this exact checked-out connection
    await verifyDatabaseSafety(client, options);
    return client;
  } catch (err) {
    client.release();
    throw err;
  }
}

/**
 * Execute parameterized query safely on a verified client from the connection pool.
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const client = await getClient();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}

/**
 * Helper to execute a callback within a managed transaction on a safety-verified connection.
 * Verification, BEGIN, callback writes, and COMMIT run on the exact same client.
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  options?: SafetyCheckOptions
): Promise<T> {
  const client = await getClient(options);
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
