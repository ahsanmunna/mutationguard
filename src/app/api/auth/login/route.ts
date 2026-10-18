/**
 * POST /api/auth/login   body: { username, password }
 *
 * - Passwords are checked with bcrypt (src/lib/auth-service.ts).
 * - Success: sets the signed httpOnly session cookie.
 * - Failure: generic 401 (never says whether the username or the password was wrong),
 *   a LOGIN_FAILED audit event (under the system actor), and after 5 failures a 429.
 * - The attempted username is NOT written to the audit chain (people sometimes type a
 *   password into that box and the chain can never be edited). Only a short hash is kept.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/../db';
import { verifyLogin } from '@/lib/auth-service';
import { createSessionToken } from '@/lib/session';
import { setSessionCookie } from '@/lib/session-cookie';
import { getSessionSecret } from '@/lib/env';
import { checkLoginRateLimit, recordLoginFailure, clearLoginFailures } from '@/lib/rate-limit';
import { logAuditEventSafe } from '@/lib/audit/log-event';
import { handleApiError } from '@/lib/api-errors';
import { BadRequestError } from '@/lib/errors';
import { sha256 } from '@/lib/crypto/hasher';

function clientAddress(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
}

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      throw new BadRequestError('Request body must be valid JSON.');
    }

    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!username || !password || username.length > 100 || password.length > 200) {
      throw new BadRequestError('Username and password are required.');
    }

    const limiterKey = `${clientAddress(req)}|${username.toLowerCase()}`;
    const limit = checkLoginRateLimit(limiterKey);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many failed attempts. Please wait a few minutes and try again.', code: 'RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
      );
    }

    const user = await verifyLogin(getPool(), username, password);

    if (!user) {
      recordLoginFailure(limiterKey);
      await logAuditEventSafe({
        event_type:     'LOGIN_FAILED',
        entity_id:      'AUTH',
        entity_type:    'security',
        actor_username: 'system_audit',
        actor_role:     'system',
        payload:        { username_hash: sha256(username.toLowerCase()).slice(0, 12) },
      });
      return NextResponse.json(
        { error: 'Invalid username or password', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }

    clearLoginFailures(limiterKey);
    const token = await createSessionToken(user.username, user.role as 'applicant' | 'reviewer', getSessionSecret());

    await logAuditEventSafe({
      event_type:     'LOGIN_SUCCEEDED',
      entity_id:      user.username,
      entity_type:    'security',
      actor_username: user.username,
      actor_role:     user.role,
      payload:        { method: 'password' },
    });

    const response = NextResponse.json({
      success: true,
      user: { username: user.username, fullName: user.fullName, role: user.role },
    });
    setSessionCookie(response, token);
    return response;
  } catch (err) {
    return handleApiError(err, 'POST /api/auth/login');
  }
}
