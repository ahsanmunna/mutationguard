import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import {
  UserRole,
  UserSession,
  DEMO_COOKIE_NAME,
  SEEDED_USERS,
} from './auth-types';
import { getPool } from '../../db';
import { UnauthorizedError, ForbiddenError } from './errors';
import { logAuditEventSafe } from './audit/log-event';

export * from './auth-types';
export { UnauthorizedError, ForbiddenError } from './errors';

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

  // Hard-coded fallback ONLY under the test runner. Never in dev/production, so a
  // database outage can not silently authenticate anyone from a code dictionary.
  if (process.env.NODE_ENV === 'test') {
    return SEEDED_USERS[username] || null;
  }
  return null;
}

function describeRequest(req?: Request | NextRequest): { path: string; method: string } {
  if (!req) return { path: 'unknown', method: 'unknown' };
  try {
    return { path: new URL(req.url).pathname, method: req.method };
  } catch {
    return { path: 'unknown', method: req.method };
  }
}

/**
 * Requires user to be authenticated. Throws UnauthorizedError (401).
 * The attempt is logged (path + method only, no personal data) under the system actor.
 * NOTE: requests with NO cookie are already stopped by middleware.ts before they get here.
 */
export async function requireAuth(req?: Request | NextRequest): Promise<UserSession> {
  const user = await getCurrentUser(req);
  if (!user) {
    if (req) {
      await logAuditEventSafe({
        event_type:     'UNAUTHENTICATED_ACCESS_ATTEMPT',
        entity_id:      'API',
        entity_type:    'security',
        actor_username: 'system_audit',
        actor_role:     'system',
        payload:        describeRequest(req),
      });
    }
    throw new UnauthorizedError();
  }
  return user;
}

/**
 * Requires user to have one of the specified roles.
 * Throws ForbiddenError (403) AFTER writing a FORBIDDEN_ACCESS_ATTEMPT audit event
 * that is signed by the offending user's own key (so the chain stays valid).
 */
export async function requireRole(
  allowedRoles: UserRole[],
  req?: Request | NextRequest
): Promise<UserSession> {
  const user = await requireAuth(req);

  if (!allowedRoles.includes(user.role)) {
    const { path, method } = describeRequest(req);
    await logAuditEventSafe({
      event_type:     'FORBIDDEN_ACCESS_ATTEMPT',
      entity_id:      user.username,
      entity_type:    'security',
      actor_username: user.username,
      actor_role:     user.role,
      payload:        { path, method, required_roles: allowedRoles },
    });
    throw new ForbiddenError();
  }

  return user;
}
