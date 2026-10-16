import fs from 'fs';
import path from 'path';
import { getPool, closePool } from './index';
import { verifyDatabaseSafety, sanitizeErrorMessage } from './safety';

async function runMigrations() {
  let pool: any = null;
  let client: any = null;

  try {
    console.log('[Migration] Initializing migration runner...');
    pool = getPool();
    client = await pool.connect();

    // 1. Database Safety Guard Check:
    // Requires MUTATIONGUARD_ALLOW_DB_WRITE=true and verifies connected DB is antigravity_dev (or antigravity_test)
    const currentDb = await verifyDatabaseSafety(client, {
      requireWriteConfirmation: true,
    });
    console.log(`[Migration] Database verified: "${currentDb}". Write confirmation confirmed.`);

    // 2. Create migration tracking table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const migrationsDir = path.resolve(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      const alreadyApplied = await client.query(
        'SELECT id FROM schema_migrations WHERE filename = $1;',
        [file]
      );

      if (alreadyApplied.rowCount && alreadyApplied.rowCount > 0) {
        console.log(`[Migration] Skipping ${file} (already applied)`);
        continue;
      }

      console.log(`[Migration] Applying ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1);',
        [file]
      );
      await client.query('COMMIT');
      console.log(`[Migration] Successfully applied ${file}`);
    }

    console.log('[Migration] All migrations completed successfully.');
  } catch (error: any) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    // Never log connection URLs, passwords, or secrets
    console.error('[Migration Error]', sanitizeErrorMessage(error.message || String(error)));
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await closePool().catch(() => {});
  }
}

// Only execute when run directly from CLI
if (require.main === module) {
  runMigrations();
}

export { runMigrations };
