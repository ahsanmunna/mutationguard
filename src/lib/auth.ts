import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { UserRole, UserSession } from './auth-types';
import { getPool } from '../../db';
import { UnauthorizedError, ForbiddenError } from './errors';
import { logAuditEventSafe } from './audit/log-event';
import { SESSION_COOKIE_NAME, verifySessionToken } from './session';
import { getSessionSecret } from './env';
import { sanitizeErrorMessage } from '../../db/safety';

export * from './auth-types';
export { UnauthorizedError, ForbiddenError } from './errors';

/**
 * =========================================================================
 * AUTHENTICATION (server side)
 * =========================================================================
 * Identity comes from a SIGNED, httpOnly session cookie (see src/lib/session.ts).
 * After the signature is verified we re-read the user from PostgreSQL, so the role used
 * for authorization is always the CURRENT database role, never a value from the browser.
 *
 * SAFETY RULES:
 * 1. NEVER SELECT private_key or password_hash in this lookup.
 * 2. No cookie, a forged/expired token, or a broken SESSION_SECRET all mean "not logged in".
 * 3. requireAuth throws UnauthorizedError (401).
 * 4. requireRole throws ForbiddenError (403) and logs a FORBIDDEN_ACCESS_ATTEMPT audit event.
 * =========================================================================
 */

async function readSessionToken(req?: Request | NextRequest): Promise<string | undefined> {
  if (req) {
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader.match(new RegExp(`(?:^|; )${SESSION_COOKIE_NAME}=([^;]*)`));
    return match ? match[1] : undefined;
  }
  try {
    const cookieStore = await cookies();
    return cookieStore.get(SESSION_COOKIE_NAME)?.value;
  } catch {
    return undefined; // outside a Next.js request (e.g. tests)
  }
}

/** The logged-in user for this request, or null. */
export async function getCurrentUser(req?: Request | NextRequest): Promise<UserSession | null> {
  const token = await readSessionToken(req);
  if (!token) return null;

  let secret: string;
  try {
    secret = getSessionSecret();
  } catch (err: any) {
    console.error('[AUTH] session secret problem:', sanitizeErrorMessage(err?.message || String(err)));
    return null; // fail closed
  }

  const payload = await verifySessionToken(token, secret);
  if (!payload) return null;

  try {
    const pool = getPool();
    const res = await pool.query(
      `SELECT username, full_name, role, nid
       FROM users
       WHERE username = $1 AND role IN ('applicant', 'reviewer')
       LIMIT 1;`,
      [payload.u]
    );
    const row = res.rows[0];
    if (!row) return null; // user was deleted or reseeded away
    return {
      username: row.username,
      fullName: row.full_name,
      role:     row.role as UserRole,
      nid:      row.nid || undefined,
    };
  } catch {
    return null; // database problem: never authenticate from a fallback
  }
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
