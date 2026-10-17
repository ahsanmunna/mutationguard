import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import {
  UserRole,
  UserSession,
  DEMO_COOKIE_NAME,
  SEEDED_USERS,
} from './auth-types';
import { getPool } from '../../db';

export * from './auth-types';

/**
 * =========================================================================
 * STAGE A TEMPORARY AUTHENTICATION STUB (Server-side)
 * =========================================================================
 * Loads authenticated demo user from cookie and resolves profile from
 * the PostgreSQL users table.
 *
 * SAFETY RULES:
 * 1. NEVER SELECT private_key or password_hash in this auth lookup.
 * 2. If no cookie is present, returns null (NO automatic fallback).
 * 3. requireAuth throws UNAUTHORIZED (401).
 * 4. requireRole throws FORBIDDEN (403) and logs a FORBIDDEN_ACCESS audit event.
 * =========================================================================
 */

/**
 * Resolves current user session from the demo cookie.
 * Queries PostgreSQL `users` table for live profile data.
 * Falls back to in-memory dictionary during unit tests when DB is unavailable.
 */
export async function getCurrentUser(req?: Request | NextRequest): Promise<UserSession | null> {
  let username: string | undefined;

  if (req) {
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader.match(new RegExp(`(?:^|; )${DEMO_COOKIE_NAME}=([^;]*)`));
    if (match) {
      username = decodeURIComponent(match[1]);
    }
  } else {
    try {
      const cookieStore = await cookies();
      username = cookieStore.get(DEMO_COOKIE_NAME)?.value;
    } catch {
      // Outside Next.js server context (e.g. test environment)
    }
  }

  // Phase 4: Do NOT fall back to officer_farhan. No cookie = unauthenticated (null).
  if (!username) {
    return null;
  }

  // Attempt live DB resolution first (NEVER select private_key or password_hash)
  try {
    const pool = getPool();
    const res = await pool.query(
      'SELECT username, full_name, role, nid FROM users WHERE username = $1 LIMIT 1;',
      [username]
    );
    if (res.rowCount && res.rowCount > 0) {
      const row = res.rows[0];
      return {
        username: row.username,
        fullName: row.full_name,
        role: row.role as UserRole,
        nid: row.nid || undefined,
      };
    }
  } catch {
    // If DB is offline / during test runs without DB connection, check SEEDED_USERS
  }

  // Fallback for tests/mocking
  return SEEDED_USERS[username] || null;
}

/**
 * Custom error class for HTTP 401 Unauthorized
 */
export class UnauthorizedError extends Error {
  statusCode = 401;
  constructor(message = 'UNAUTHORIZED: Please select a demo user') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Custom error class for HTTP 403 Forbidden
 */
export class ForbiddenError extends Error {
  statusCode = 403;
  constructor(message = 'FORBIDDEN: User does not have sufficient privileges') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Requires user to be authenticated. Throws UnauthorizedError (401).
 */
export async function requireAuth(req?: Request | NextRequest): Promise<UserSession> {
  const user = await getCurrentUser(req);
  if (!user) {
    throw new UnauthorizedError('UNAUTHORIZED: Authentication required. Please log in.');
  }
  return user;
}

/**
 * Requires user to have one of the specified roles.
 * Throws ForbiddenError (403) and writes a FORBIDDEN_ACCESS audit event.
 */
export async function requireRole(
  allowedRoles: UserRole[],
  req?: Request | NextRequest
): Promise<UserSession> {
  const user = await requireAuth(req);

  if (!allowedRoles.includes(user.role)) {
    console.warn(
      `[AUTH STUB 403 FORBIDDEN] User "${user.username}" (${user.role}) attempted access requiring [${allowedRoles.join(', ')}]`
    );

    // Asynchronously log audit event for forbidden attempt (best-effort, non-blocking)
    try {
      const pool = getPool();
      // Fetch system audit key to sign the security event
      const sysKeyRes = await pool.query(
        "SELECT private_key FROM users WHERE username = 'system_audit';"
      );
      if (sysKeyRes.rows[0]?.private_key) {
        const { appendAuditEvent } = await import('./audit/ledger');
        const client = await pool.connect();
        try {
          await appendAuditEvent(
            client,
            {
              event_type: 'FORBIDDEN_ACCESS_ATTEMPT',
              entity_id: user.username,
              entity_type: 'security',
              actor_username: user.username,
              actor_role: user.role,
              payload: {
                user: user.username,
                role: user.role,
                required_roles: allowedRoles,
                timestamp: new Date().toISOString(),
              },
            },
            sysKeyRes.rows[0].private_key
          );
        } finally {
          client.release();
        }
      }
    } catch {
      // Don't fail the request if audit logging fails
    }

    throw new ForbiddenError(
      `FORBIDDEN: Role "${user.role}" does not have required permissions (${allowedRoles.join(', ')})`
    );
  }

  return user;
}
