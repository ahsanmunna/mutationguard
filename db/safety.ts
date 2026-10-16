export type DatabaseMode = 'development' | 'test';

export interface SafetyCheckOptions {
  mode?: DatabaseMode;
  requireWriteConfirmation?: boolean;
}

export const ALLOWED_DATABASES = {
  development: 'antigravity_dev',
  test: 'antigravity_test',
} as const;

export const WRITE_CONFIRMATION_ENV_VAR = 'MUTATIONGUARD_ALLOW_DB_WRITE';

/**
 * Returns the expected database name based on the specified mode or NODE_ENV.
 */
export function getExpectedDatabaseName(mode?: DatabaseMode): string {
  const isTest = mode ? mode === 'test' : process.env.NODE_ENV === 'test';
  return isTest ? ALLOWED_DATABASES.test : ALLOWED_DATABASES.development;
}

/**
 * Verifies that the explicit write confirmation variable MUTATIONGUARD_ALLOW_DB_WRITE=true is set.
 * Throws a fatal safety violation if absent or not set to 'true'.
 */
export function checkWriteConfirmation(): void {
  const confirmation = process.env[WRITE_CONFIRMATION_ENV_VAR];
  if (confirmation !== 'true') {
    throw new Error(
      `SAFETY VIOLATION: Database write operation refused. ` +
      `Explicit confirmation required: set ${WRITE_CONFIRMATION_ENV_VAR}=true to proceed.`
    );
  }
}

/**
 * Sanitizes any error message by redacting connection strings, passwords, and credentials.
 */
export function sanitizeErrorMessage(message: string): string {
  return message.replace(/postgresql:\/\/[^@]+@/gi, 'postgresql://***:***@');
}

/**
 * Shared database safety guard.
 * Queries `SELECT current_database()` and rejects any database other than
 * `antigravity_dev` (development) or `antigravity_test` (test).
 * If requireWriteConfirmation is enabled, requires MUTATIONGUARD_ALLOW_DB_WRITE=true.
 */
export async function verifyDatabaseSafety(
  target: { query: (text: string, params?: any[]) => Promise<any> },
  options?: SafetyCheckOptions
): Promise<string> {
  const isTest = options?.mode ? options.mode === 'test' : process.env.NODE_ENV === 'test';
  const expectedDb = getExpectedDatabaseName(options?.mode);

  // 1. Check write confirmation if required
  if (options?.requireWriteConfirmation) {
    checkWriteConfirmation();
  }

  // 2. Query actual connected database
  const res = await target.query('SELECT current_database() as db_name;');
  const actualDb = res.rows?.[0]?.db_name;

  if (!actualDb) {
    throw new Error('SAFETY VIOLATION: Unable to determine current database name.');
  }

  // 3. Reject any unauthorized database name
  if (actualDb !== expectedDb) {
    throw new Error(
      `FATAL SAFETY VIOLATION: Connected to database "${actualDb}", ` +
      `but expected "${expectedDb}" for ${isTest ? 'test' : 'development'} operations. ` +
      `Operation rejected before any writes.`
    );
  }

  return actualDb;
}
