/**
 * GET /api/auth/me
 * Tells the browser who is logged in (the session cookie is httpOnly, so page code can not
 * read it itself) and whether demo mode is on. Safe to call without logging in.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isDemoMode } from '@/lib/env';
import { handleApiError } from '@/lib/api-errors';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    return NextResponse.json(
      {
        user: user ? { username: user.username, fullName: user.fullName, role: user.role } : null,
        demo_mode: isDemoMode(),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return handleApiError(err, 'GET /api/auth/me');
  }
}
