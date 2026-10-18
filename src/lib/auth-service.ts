/**
 * Password checking against the users table (server only).
 *
 * - Passwords are stored as bcrypt hashes. We never log or return them.
 * - The 'system' user (which signs automatic audit events) can NEVER log in.
 * - If the username does not exist we still run a bcrypt comparison against a dummy
 *   hash, so the response time does not reveal which usernames exist.
 */
import bcrypt from 'bcryptjs';
import type { Pool } from 'pg';
import type { UserSession } from './auth-types';

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 8);

export async function verifyLogin(pool: Pool, username: string, password: string): Promise<UserSession | null> {
  const res = await pool.query(
    `SELECT username, full_name, role, nid, password_hash
     FROM users
     WHERE username = $1 AND role IN ('applicant', 'reviewer')
     LIMIT 1;`,
    [username]
  );
  const row = res.rows[0];
  const passwordOk = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !passwordOk) return null;

  return {
    username: row.username,
    fullName: row.full_name,
    role:     row.role,
    nid:      row.nid || undefined,
  };
}

/** Looks a user up WITHOUT a password. Only the DEMO_MODE one-click login uses this. */
export async function findLoginUser(pool: Pool, username: string): Promise<UserSession | null> {
  const res = await pool.query(
    `SELECT username, full_name, role, nid
     FROM users
     WHERE username = $1 AND role IN ('applicant', 'reviewer')
     LIMIT 1;`,
    [username]
  );
  const row = res.rows[0];
  if (!row) return null;
  return { username: row.username, fullName: row.full_name, role: row.role, nid: row.nid || undefined };
}
