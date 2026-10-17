import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  verifyDatabaseSafety,
  checkWriteConfirmation,
  sanitizeErrorMessage,
  WRITE_CONFIRMATION_ENV_VAR,
  ALLOWED_DATABASES,
} from '../../db/safety';
import { getDatabaseUrl, setPool, closePool, withTransaction, query, getClient } from '../../db/index';
import { runSeed } from '../../db/seed';

describe('Database Safety Guard Unit Tests (Mocked - No Database Connection)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    setPool(null);
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await closePool();
    vi.restoreAllMocks();
  });

  describe('1. Missing Test URL and Test-Mode Fail Closed', () => {
    it('fails closed when NODE_ENV=test and TEST_DATABASE_URL is missing', () => {
      (process.env as any).NODE_ENV = 'test';
      delete process.env.TEST_DATABASE_URL;
      delete process.env.DATABASE_URL;

      expect(() => getDatabaseUrl()).toThrowError(
        /FATAL: TEST_DATABASE_URL is required when NODE_ENV=test/
      );
    });

    it('never falls back to DATABASE_URL in test mode even if DATABASE_URL is set', () => {
      (process.env as any).NODE_ENV = 'test';
      delete process.env.TEST_DATABASE_URL;
      process.env.DATABASE_URL = 'postgresql://postgres:secret@localhost:5432/antigravity_dev';

      // Must NOT return DATABASE_URL; must fail closed
      expect(() => getDatabaseUrl()).toThrowError(
        /Never falling back to DATABASE_URL in test mode/
      );
    });

    it('returns TEST_DATABASE_URL when NODE_ENV=test and TEST_DATABASE_URL is provided', () => {
      (process.env as any).NODE_ENV = 'test';
      process.env.TEST_DATABASE_URL = 'postgresql://postgres:secret@localhost:5432/antigravity_test';
      process.env.DATABASE_URL = 'postgresql://postgres:secret@localhost:5432/antigravity_dev';

      expect(getDatabaseUrl()).toBe(
        'postgresql://postgres:secret@localhost:5432/antigravity_test'
      );
    });
  });

  describe('2. Absent Write Confirmation Requirement for CLI Migrations/Seeds', () => {
    it('refuses write operations when MUTATIONGUARD_ALLOW_DB_WRITE is missing', () => {
      delete process.env[WRITE_CONFIRMATION_ENV_VAR];

      expect(() => checkWriteConfirmation()).toThrowError(
        /SAFETY VIOLATION: Database write operation refused/
      );
    });

    it('refuses write operations when MUTATIONGUARD_ALLOW_DB_WRITE is set to false or 0', () => {
      process.env[WRITE_CONFIRMATION_ENV_VAR] = 'false';
      expect(() => checkWriteConfirmation()).toThrowError(/SAFETY VIOLATION/);

      process.env[WRITE_CONFIRMATION_ENV_VAR] = '0';
      expect(() => checkWriteConfirmation()).toThrowError(/SAFETY VIOLATION/);
    });

    it('permits write operations only when MUTATIONGUARD_ALLOW_DB_WRITE is strictly "true"', () => {
      process.env[WRITE_CONFIRMATION_ENV_VAR] = 'true';
      expect(() => checkWriteConfirmation()).not.toThrow();
    });

    it('verifyDatabaseSafety refuses operation without querying DB if write confirmation is missing', async () => {
      delete process.env[WRITE_CONFIRMATION_ENV_VAR];
      const mockClient = { query: vi.fn() };

      await expect(
        verifyDatabaseSafety(mockClient, { requireWriteConfirmation: true })
      ).rejects.toThrowError(/SAFETY VIOLATION: Database write operation refused/);

      // Verify no SQL query was even sent
      expect(mockClient.query).not.toHaveBeenCalled();
    });
  });

  describe('3. Wrong Database Name Rejection', () => {
    it('rejects if development mode connects to antigravity_test or production', async () => {
      const mockTestDbClient = {
        query: vi.fn().mockResolvedValue({
          rows: [{ db_name: ALLOWED_DATABASES.test }],
        }),
      };

      await expect(
        verifyDatabaseSafety(mockTestDbClient, { mode: 'development' })
      ).rejects.toThrowError(
        /FATAL SAFETY VIOLATION: Connected to database "antigravity_test", but expected "antigravity_dev"/
      );

      const mockProdClient = {
        query: vi.fn().mockResolvedValue({
          rows: [{ db_name: 'production_db' }],
        }),
      };

      await expect(
        verifyDatabaseSafety(mockProdClient, { mode: 'development' })
      ).rejects.toThrowError(
        /FATAL SAFETY VIOLATION: Connected to database "production_db", but expected "antigravity_dev"/
      );
    });

    it('rejects if test mode connects to antigravity_dev or default postgres', async () => {
      const mockDevClient = {
        query: vi.fn().mockResolvedValue({
          rows: [{ db_name: ALLOWED_DATABASES.development }],
        }),
      };

      await expect(
        verifyDatabaseSafety(mockDevClient, { mode: 'test' })
      ).rejects.toThrowError(
        /FATAL SAFETY VIOLATION: Connected to database "antigravity_dev", but expected "antigravity_test"/
      );

      const mockPostgresClient = {
        query: vi.fn().mockResolvedValue({
          rows: [{ db_name: 'postgres' }],
        }),
      };

      await expect(
        verifyDatabaseSafety(mockPostgresClient, { mode: 'test' })
      ).rejects.toThrowError(
        /FATAL SAFETY VIOLATION: Connected to database "postgres", but expected "antigravity_test"/
      );
    });
  });

  describe('4. Allowed Database Selection', () => {
    it('allows antigravity_dev in development mode when write confirmation is true', async () => {
      process.env[WRITE_CONFIRMATION_ENV_VAR] = 'true';
      const mockClient = {
        query: vi.fn().mockResolvedValue({
          rows: [{ db_name: 'antigravity_dev' }],
        }),
      };

      const selectedDb = await verifyDatabaseSafety(mockClient, {
        mode: 'development',
        requireWriteConfirmation: true,
      });

      expect(selectedDb).toBe('antigravity_dev');
      expect(mockClient.query).toHaveBeenCalledWith('SELECT current_database() as db_name;');
    });

    it('allows antigravity_test in test mode when write confirmation is true', async () => {
      process.env[WRITE_CONFIRMATION_ENV_VAR] = 'true';
      const mockClient = {
        query: vi.fn().mockResolvedValue({
          rows: [{ db_name: 'antigravity_test' }],
        }),
      };

      const selectedDb = await verifyDatabaseSafety(mockClient, {
        mode: 'test',
        requireWriteConfirmation: true,
      });

      expect(selectedDb).toBe('antigravity_test');
      expect(mockClient.query).toHaveBeenCalledWith('SELECT current_database() as db_name;');
    });
  });

  describe('5. Runtime Write Safety Guards (withTransaction & query)', () => {
    it('withTransaction verifies database name on the exact checked-out connection and executes write', async () => {
      (process.env as any).NODE_ENV = 'development';
      const executedQueries: string[] = [];

      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          executedQueries.push(sql);
          if (sql.includes('current_database')) {
            return Promise.resolve({ rows: [{ db_name: 'antigravity_dev' }] });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
        end: vi.fn(),
      };
      setPool(mockPool as any);

      // Perform runtime transaction write
      const result = await withTransaction(async (client) => {
        await client.query('INSERT INTO transfers (id) VALUES ($1);', ['TR-001']);
        return 'success';
      });

      expect(result).toBe('success');

      // Verify execution order on the EXACT SAME client connection:
      // 1. SELECT current_database()
      // 2. BEGIN
      // 3. INSERT INTO transfers ...
      // 4. COMMIT
      expect(executedQueries[0]).toBe('SELECT current_database() as db_name;');
      expect(executedQueries[1]).toBe('BEGIN');
      expect(executedQueries[2]).toBe('INSERT INTO transfers (id) VALUES ($1);');
      expect(executedQueries[3]).toBe('COMMIT');

      // Verify client was cleanly released
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('withTransaction strictly rejects and aborts before BEGIN when connected to wrong database (e.g. production)', async () => {
      (process.env as any).NODE_ENV = 'development';
      const executedQueries: string[] = [];

      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          executedQueries.push(sql);
          if (sql.includes('current_database')) {
            return Promise.resolve({ rows: [{ db_name: 'production_main_db' }] });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
        end: vi.fn(),
      };
      setPool(mockPool as any);

      const writeCallback = vi.fn();

      await expect(
        withTransaction(async (client) => {
          writeCallback();
          await client.query('INSERT INTO transfers (id) VALUES ($1);', ['TR-001']);
        })
      ).rejects.toThrowError(
        /FATAL SAFETY VIOLATION: Connected to database "production_main_db", but expected "antigravity_dev"/
      );

      // Verify that callback and writes were NEVER called
      expect(writeCallback).not.toHaveBeenCalled();
      expect(executedQueries.some((sql) => /BEGIN|INSERT|COMMIT/i.test(sql))).toBe(false);

      // Verify client was cleanly released
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('withTransaction enforces antigravity_test when NODE_ENV=test', async () => {
      (process.env as any).NODE_ENV = 'test';

      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('current_database')) {
            // Unexpected dev DB in test mode
            return Promise.resolve({ rows: [{ db_name: 'antigravity_dev' }] });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
        end: vi.fn(),
      };
      setPool(mockPool as any);

      await expect(
        withTransaction(async (client) => {
          await client.query('INSERT INTO transfers (id) VALUES ($1);');
        })
      ).rejects.toThrowError(
        /FATAL SAFETY VIOLATION: Connected to database "antigravity_dev", but expected "antigravity_test"/
      );

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('query helper verifies connection before executing query and releases client', async () => {
      (process.env as any).NODE_ENV = 'development';

      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('current_database')) {
            return Promise.resolve({ rows: [{ db_name: 'antigravity_dev' }] });
          }
          return Promise.resolve({ rows: [{ count: 42 }] });
        }),
        release: vi.fn(),
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
        end: vi.fn(),
      };
      setPool(mockPool as any);

      const res = await query('SELECT count(*) FROM parcels;');
      expect(res.rows[0].count).toBe(42);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('ordinary runtime requests do NOT require MUTATIONGUARD_ALLOW_DB_WRITE=true', async () => {
      (process.env as any).NODE_ENV = 'development';
      delete process.env[WRITE_CONFIRMATION_ENV_VAR]; // Not set

      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('current_database')) {
            return Promise.resolve({ rows: [{ db_name: 'antigravity_dev' }] });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
        end: vi.fn(),
      };
      setPool(mockPool as any);

      // withTransaction without options must succeed without confirmation env var
      await expect(
        withTransaction(async (client) => {
          await client.query('SELECT 1;');
          return 'ok';
        })
      ).resolves.toBe('ok');

      // However, if requireWriteConfirmation is passed (like in CLI commands), it must fail
      await expect(
        withTransaction(async () => {}, { requireWriteConfirmation: true })
      ).rejects.toThrowError(/SAFETY VIOLATION: Database write operation refused/);
    });
  });

  describe('6. Seed Script Destructive Action Refusal', () => {
    it('refuses to delete or reset data when MUTATIONGUARD_ALLOW_DB_WRITE is missing', async () => {
      delete process.env[WRITE_CONFIRMATION_ENV_VAR];
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [{ db_name: 'antigravity_dev' }] }),
        release: vi.fn(),
      };
      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
        end: vi.fn(),
      };

      await expect(runSeed(mockPool)).rejects.toThrowError(
        /SAFETY VIOLATION: Database write operation refused/
      );

      // Verify that NO destructive queries (DELETE, TRUNCATE, BEGIN) were ever executed
      const calls = mockClient.query.mock.calls.map((c) => c[0]);
      expect(calls.some((sql: string) => /DELETE|TRUNCATE|BEGIN/i.test(sql))).toBe(false);

      // Clean release must be called
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('refuses to delete or reset data when connected database is not allowed', async () => {
      process.env[WRITE_CONFIRMATION_ENV_VAR] = 'true';
      const mockClient = {
        // Simulates connection to an unintended database (e.g. production)
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('current_database')) {
            return Promise.resolve({ rows: [{ db_name: 'production_server' }] });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
      };
      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
        end: vi.fn(),
      };

      await expect(runSeed(mockPool)).rejects.toThrowError(
        /FATAL SAFETY VIOLATION: Connected to database "production_server"/
      );

      // Verify that NO destructive queries (DELETE, TRUNCATE, BEGIN) were ever executed
      const calls = mockClient.query.mock.calls.map((c) => c[0]);
      expect(calls.some((sql: string) => /DELETE|TRUNCATE/i.test(sql))).toBe(false);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('7. Credentials and Secret Redaction in Error Messages', () => {
    it('redacts credentials and connection URLs from error strings', () => {
      const sensitive =
        'Error: connect to postgresql://postgres:super_secret_pw@db.example.com:5432/antigravity_dev failed';
      const sanitized = sanitizeErrorMessage(sensitive);

      expect(sanitized).not.toContain('super_secret_pw');
      expect(sanitized).not.toContain('postgres:');
      expect(sanitized).toContain('postgresql://***:***@');
    });
  });
});
