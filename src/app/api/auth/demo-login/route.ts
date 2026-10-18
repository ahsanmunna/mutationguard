/**
 * POST /api/auth/demo-login   body: { username }
 *
 * One-click login for the hackathon demo. It needs NO password, so it only works when
 * DEMO_MODE=true (403 otherwise). It still creates the same signed session cookie, and the
 * 'system' user can never be used. Everything in this prototype is synthetic data.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/../db';
import { findLoginUser } from '@/lib/auth-service';
import { createSessionToken } from '@/lib/session';
import { setSessionCookie } from '@/lib/session-cookie';
import { getSessionSecret, isDemoMode } from '@/lib/env';
import { logAuditEventSafe } from '@/lib/audit/log-event';
import { handleApiError } from '@/lib/api-errors';
import { BadRequestError, NotFoundError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  if (!isDemoMode()) {
    return NextResponse.json({ error: 'Demo login is disabled', code: 'DEMO_DISABLED' }, { status: 403 });
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      throw new BadRequestError('Request body must be valid JSON.');
    }
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    if (!username || username.length > 100) {
      throw new BadRequestError('Username is required.');
    }

    const user = await findLoginUser(getPool(), username);
    if (!user) {
      throw new NotFoundError('Unknown demo user');
    }

    const token = await createSessionToken(user.username, user.role as 'applicant' | 'reviewer', getSessionSecret());

    await logAuditEventSafe({
      event_type:     'LOGIN_SUCCEEDED',
      entity_id:      user.username,
      entity_type:    'security',
      actor_username: user.username,
      actor_role:     user.role,
      payload:        { method: 'demo' },
    });

    const response = NextResponse.json({
      success: true,
      user: { username: user.username, fullName: user.fullName, role: user.role },
    });
    setSessionCookie(response, token);
    return response;
  } catch (err) {
    return handleApiError(err, 'POST /api/auth/demo-login');
  }
}
