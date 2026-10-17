import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { getDatabaseUrl } from '../db';

// Load test environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Extracts database name from connection URL.
 */
function extractDatabaseName(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\//, '');
  } catch {
    const match = url.match(/\/([^/?#]+)(?:\?.*)?$/);
    return match ? match[1] : '';
  }
}

/**
 * GENERIC TEST DATABASE SAFETY GUARD:
 * 1. Refuses to run if TEST_DATABASE_URL equals DATABASE_URL.
 * 2. Refuses to run if connected database name does not end with '_test'.
 * Never hardcodes any specific database name like 'antigravity_test'.
 */
export async function assertTestDatabaseSafety(pool: Pool): Promise<string> {
  const devUrl = process.env.DATABASE_URL;
  const testUrl = process.env.TEST_DATABASE_URL || getDatabaseUrl();

  if (devUrl && testUrl && devUrl.trim() === testUrl.trim()) {
    throw new Error(
      'FATAL TEST SAFETY VIOLATION: TEST_DATABASE_URL must not equal DATABASE_URL. Test operations refused.'
    );
  }

  const res = await pool.query('SELECT current_database() as db_name;');
  const dbName = res.rows?.[0]?.db_name;

  if (!dbName || !dbName.endsWith('_test')) {
    throw new Error(
      `FATAL TEST SAFETY VIOLATION: Connected to test database "${dbName}", but all test databases must end with "_test". Test operations refused.`
    );
  }

  return dbName;
}

/**
 * Creates a dedicated connection pool to test database with generic safety enforcement.
 */
export function getTestPool(): Pool {
  const devUrl = process.env.DATABASE_URL;
  const testDbUrl = getDatabaseUrl();

  if (devUrl && testDbUrl && devUrl.trim() === testDbUrl.trim()) {
    throw new Error(
      'FATAL CONFIGURATION ERROR: TEST_DATABASE_URL must never equal DATABASE_URL!'
    );
  }

  const dbNameFromUrl = extractDatabaseName(testDbUrl);
  if (dbNameFromUrl && !dbNameFromUrl.endsWith('_test')) {
    throw new Error(
      `FATAL CONFIGURATION ERROR: Test database "${dbNameFromUrl}" in TEST_DATABASE_URL must end with "_test"!`
    );
  }

  return new Pool({
    connectionString: testDbUrl,
  });
}
