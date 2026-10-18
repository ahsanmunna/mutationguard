/**
 * DATABASE + ROUTE TESTS for authentication (real PostgreSQL; run with: npm run test:db)
 * The test database is re-seeded before every test.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { Pool } from 'pg';
import { NextRequest } from 'next/server';
import { assertTestDatabaseSafety, getTestPool } from '../setup';
import { runSeed } from '../../db/seed';
import { closePool } from '../../db';
import { verifyLogin } from '../../src/lib/auth-service';
import { verifyAuditChain } from '../../src/lib/audit/ledger';
import { getCurrentUser, requireRole, ForbiddenError } from '../../src/lib/auth';
import { createSessionToken, verifySessionToken, SESSION_COOKIE_NAME } from '../../src/lib/session';
import { resetRateLimiterForTests } from '../../src/lib/rate-limit';
import { POST as loginPost } from '../../src/app/api/auth/login/route';
import { POST as demoLoginPost } from '../../src/app/api/auth/demo-login/route';

const SECRET = 'c'.repeat(64);
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo123';

function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function withCookie(token: string, url = '/api/transfers'): Request {
  return new Request(`http://localhost${url}`, { headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` } });
}

describe('Authentication (real PostgreSQL)', () => {
  let pool: Pool;
  const savedSecret = process.env.SESSION_SECRET;
  const savedDemo = process.env.DEMO_MODE;

  beforeAll(async () => {
    pool = getTestPool();
    await assertTestDatabaseSafety(pool);
    const tableCheck = await pool.query(`SELECT to_regclass('public.transfers') AS t;`);
    if (!tableCheck.rows[0]?.t) {
      throw new Error('DATABASE TEST FAILURE: tables are not migrated. Run "npm run db:migrate" against the test database first.');
    }
    if (process.env.MUTATIONGUARD_ALLOW_DB_WRITE !== 'true') {
      throw new Error('DATABASE TEST FAILURE: set MUTATIONGUARD_ALLOW_DB_WRITE=true so the tests may re-seed the TEST database.');
    }
  });

  beforeEach(async () => {
    process.env.SESSION_SECRET = SECRET;
    process.env.DEMO_MODE = 'true';
    resetRateLimiterForTests();
    await runSeed(pool);
  });

  afterAll(async () => {
    process.env.SESSION_SECRET = savedSecret;
    process.env.DEMO_MODE = savedDemo;
    if (pool) await pool.end();
    await closePool();
  });

  async function countEvents(type: string): Promise<number> {
    const res = await pool.query('SELECT count(*)::int AS n FROM audit_ledger WHERE event_type = $1', [type]);
    return res.rows[0].n;
  }

  // ---------------- password check ----------------
  it('verifyLogin accepts the right password and rejects everything else', async () => {
    const ok = await verifyLogin(pool, 'officer_farhan', DEMO_PASSWORD);
    expect(ok?.username).toBe('officer_farhan');
    expect(ok?.role).toBe('reviewer');

    expect(await verifyLogin(pool, 'officer_farhan', 'wrong-password')).toBeNull();
    expect(await verifyLogin(pool, 'nobody_here', DEMO_PASSWORD)).toBeNull();
    // the system user can never log in, whatever the password
    expect(await verifyLogin(pool, 'system_audit', DEMO_PASSWORD)).toBeNull();
    expect(await verifyLogin(pool, 'system_audit', 'anything')).toBeNull();
  });

  it('stored passwords are bcrypt hashes, not plain text', async () => {
    const res = await pool.query(`SELECT password_hash FROM users WHERE username = 'officer_farhan'`);
    expect(res.rows[0].password_hash).toMatch(/^\$2[aby]\$/);
    expect(res.rows[0].password_hash).not.toContain(DEMO_PASSWORD);
  });

  // ---------------- login route ----------------
  it('POST /api/auth/login: success sets a signed httpOnly cookie for the right user', async () => {
    const res = await loginPost(jsonRequest('/api/auth/login', { username: 'officer_farhan', password: DEMO_PASSWORD }));
    expect(res.status).toBe(200);

    const setCookie = res.headers.get('set-cookie') || '';
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie.toLowerCase()).toContain('httponly');
    expect(setCookie.toLowerCase()).toContain('samesite=lax');

    const token = res.cookies.get(SESSION_COOKIE_NAME)?.value as string;
    const payload = await verifySessionToken(token, SECRET);
    expect(payload?.u).toBe('officer_farhan');
    expect(payload?.r).toBe('reviewer');

    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain('password');
    expect(await countEvents('LOGIN_SUCCEEDED')).toBe(1);
  });

  it('POST /api/auth/login: wrong password gives a generic 401, no cookie, and a LOGIN_FAILED event that keeps the chain valid', async () => {
    const res = await loginPost(jsonRequest('/api/auth/login', { username: 'officer_farhan', password: 'nope' }));
    expect(res.status).toBe(401);
    expect(res.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
    expect((await res.json()).error).toBe('Invalid username or password');

    expect(await countEvents('LOGIN_FAILED')).toBe(1);
    // the attempted username must not be stored in the chain
    const payload = (await pool.query(`SELECT payload FROM audit_ledger WHERE event_type = 'LOGIN_FAILED'`)).rows[0].payload;
    expect(payload).not.toContain('officer_farhan');
    expect(((await verifyAuditChain(pool)) as any).valid).toBe(true);
  });

  it('POST /api/auth/login: missing fields give 400; the 6th wrong attempt is rate limited (429)', async () => {
    expect((await loginPost(jsonRequest('/api/auth/login', { username: 'officer_farhan' }))).status).toBe(400);

    for (let i = 0; i < 5; i++) {
      expect((await loginPost(jsonRequest('/api/auth/login', { username: 'rahim_uddin', password: 'bad' }))).status).toBe(401);
    }
    const blocked = await loginPost(jsonRequest('/api/auth/login', { username: 'rahim_uddin', password: DEMO_PASSWORD }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
  });

  // ---------------- demo login ----------------
  it('POST /api/auth/demo-login: works only in DEMO_MODE, never for the system user', async () => {
    const ok = await demoLoginPost(jsonRequest('/api/auth/demo-login', { username: 'karim_chowdhury' }));
    expect(ok.status).toBe(200);
    expect(ok.cookies.get(SESSION_COOKIE_NAME)?.value).toBeTruthy();

    expect((await demoLoginPost(jsonRequest('/api/auth/demo-login', { username: 'system_audit' }))).status).toBe(404);
    expect((await demoLoginPost(jsonRequest('/api/auth/demo-login', { username: 'ghost' }))).status).toBe(404);

    process.env.DEMO_MODE = 'false';
    const disabled = await demoLoginPost(jsonRequest('/api/auth/demo-login', { username: 'karim_chowdhury' }));
    expect(disabled.status).toBe(403);
    expect(disabled.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  // ---------------- session -> user ----------------
  it('getCurrentUser trusts only a valid signed cookie, and uses the DATABASE role', async () => {
    const good = await createSessionToken('officer_farhan', 'reviewer', SECRET);
    expect((await getCurrentUser(withCookie(good)))?.role).toBe('reviewer');

    // token claims "reviewer" for an applicant: the database role wins
    const lying = await createSessionToken('rahim_uddin', 'reviewer', SECRET);
    expect((await getCurrentUser(withCookie(lying)))?.role).toBe('applicant');

    // forged: signed with another secret; unknown user; garbage; no cookie
    expect(await getCurrentUser(withCookie(await createSessionToken('officer_farhan', 'reviewer', 'd'.repeat(64))))).toBeNull();
    expect(await getCurrentUser(withCookie(await createSessionToken('ghost_user', 'reviewer', SECRET)))).toBeNull();
    expect(await getCurrentUser(withCookie('not-a-token'))).toBeNull();
    expect(await getCurrentUser(new Request('http://localhost/api/transfers'))).toBeNull();
  });

  it('an applicant calling a reviewer-only guard gets ForbiddenError and the chain stays valid', async () => {
    const token = await createSessionToken('rahim_uddin', 'applicant', SECRET);
    await expect(requireRole(['reviewer'], withCookie(token, '/api/audit/verify'))).rejects.toBeInstanceOf(ForbiddenError);

    expect(await countEvents('FORBIDDEN_ACCESS_ATTEMPT')).toBe(1);
    expect(((await verifyAuditChain(pool)) as any).valid).toBe(true);
  });
});
