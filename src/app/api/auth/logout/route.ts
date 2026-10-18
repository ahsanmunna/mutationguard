/** POST /api/auth/logout: clears the session cookie. */
import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/session-cookie';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  clearSessionCookie(response);
  return response;
}
