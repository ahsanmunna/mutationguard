import { NextRequest, NextResponse } from 'next/server';
import { DEMO_COOKIE_NAME, SEEDED_USERS } from '@/lib/auth-types';
import { getPool } from '@/../db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username } = body;

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Verify user exists in DB or SEEDED_USERS fallback
    let userExists = false;
    try {
      const pool = getPool();
      const res = await pool.query('SELECT username FROM users WHERE username = $1;', [username]);
      userExists = res.rowCount !== null && res.rowCount > 0;
    } catch {
      userExists = Boolean(SEEDED_USERS[username]);
    }

    if (!userExists && !SEEDED_USERS[username]) {
      return NextResponse.json({ error: `Unknown user: ${username}` }, { status: 404 });
    }

    const response = NextResponse.json({
      success: true,
      message: `Logged in as ${username}`,
      username,
    });

    // Set HTTP cookie
    response.cookies.set({
      name: DEMO_COOKIE_NAME,
      value: username,
      path: '/',
      httpOnly: false, // Accessible to client-side demo switcher
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
