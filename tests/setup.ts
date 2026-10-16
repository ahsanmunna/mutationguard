import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { verifyDatabaseSafety } from '../db/safety';
import { getDatabaseUrl } from '../db';

// Load test environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * STRICT SAFETY GUARD FOR TESTS:
 * Verifies that the test database connection points explicitly to 'antigravity_test'.
 * Immediately aborts execution if connected to 'antigravity_dev' or any non-test database.
 */
export async function assertTestDatabaseSafety(pool: Pool): Promise<void> {
  await verifyDatabaseSafety(pool, { mode: 'test' });
}

/**
 * Creates a dedicated connection pool to antigravity_test with safety enforcement.
 */
export function getTestPool(): Pool {
  const testDbUrl = getDatabaseUrl();

  // Double check URL does not contain antigravity_dev
  if (testDbUrl.includes('antigravity_dev')) {
    throw new Error(
      'FATAL CONFIGURATION ERROR: TEST_DATABASE_URL must never point to "antigravity_dev"!'
    );
  }

  return new Pool({
    connectionString: testDbUrl,
  });
}
