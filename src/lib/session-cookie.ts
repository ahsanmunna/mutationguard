/**
 * The ONE place that decides how the session cookie is set and cleared.
 *   httpOnly : browser JavaScript can not read it (protects against XSS theft)
 *   sameSite : 'lax' (not sent on cross-site POSTs, which blocks CSRF on our POST routes)
 *   secure   : only over HTTPS in production
 */
import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from './session';

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    name:     SESSION_COOKIE_NAME,
    value:    token,
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name:     SESSION_COOKIE_NAME,
    value:    '',
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   0,
  });
}
