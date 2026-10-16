import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import {
  UserRole,
  UserSession,
  DEMO_COOKIE_NAME,
  SEEDED_USERS,
} from './auth-types';

export * from './auth-types';

/**
 * =========================================================================
 * STAGE A TEMPORARY AUTHENTICATION STUB (Server-side)
 * =========================================================================
 * WARNING: This is a clearly marked temporary stub for development, testing,
 * and academic demonstration purposes only.
 * 
 * In Stage B, this file will be replaced with cryptographically signed,
 * HTTP-only session cookies and production authentication.
 * DO NOT EXPOSE THIS STUB AS PRODUCTION AUTHENTICATION.
 * =========================================================================
 */

/**
 * Resolves current user session from the demo cookie (or request cookie header).
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
      // Outside of Next.js server context (e.g. testing)
    }
  }

  // Fallback default for demo if no cookie is set
  if (!username) {
    username = 'officer_farhan';
  }

  return SEEDED_USERS[username] || null;
}

/**
 * Requires user to be authenticated. Throws 401 message.
 */
export async function requireAuth(req?: Request | NextRequest): Promise<UserSession> {
  const user = await getCurrentUser(req);
  if (!user) {
    console.warn(`[AUTH STUB] Unauthorized access attempt at ${new Date().toISOString()}`);
    throw new Error('UNAUTHORIZED: Please select a demo user');
  }
  return user;
}

/**
 * Requires user to have one of the specified roles. Logs forbidden attempts.
 */
export async function requireRole(
  allowedRoles: UserRole[],
  req?: Request | NextRequest
): Promise<UserSession> {
  const user = await requireAuth(req);

  if (!allowedRoles.includes(user.role)) {
    console.warn(
      `[AUTH STUB FORBIDDEN ATTEMPT] User "${user.username}" (role: ${user.role}) ` +
      `attempted to access resource requiring [${allowedRoles.join(', ')}] at ${new Date().toISOString()}`
    );
    throw new Error(`FORBIDDEN: User does not have sufficient privileges (${user.role})`);
  }

  return user;
}
