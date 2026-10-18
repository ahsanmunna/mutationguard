import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from './lib/session';
import { getSessionSecret } from './lib/env';

/**
 * MutationGuard access control (runs before every page and API request).
 *
 * Public:     /, /login, /verify/*, /api/public/*, /api/auth/*, static assets
 * Protected:  everything else. The session cookie must carry a valid SIGNATURE and not be
 *             expired (a forged or edited cookie is rejected right here).
 * Reviewer-only PAGES (/demo, /integrity): other roles are redirected to the dashboard.
 *
 * Fine-grained authorization (roles, ownership) is enforced again in each API route
 * handler from the DATABASE role, so hiding pages here is only a convenience.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/static') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  if (
    pathname === '/' ||
    pathname === '/login' ||
    pathname.startsWith('/verify') ||
    pathname.startsWith('/api/public') ||
    pathname.startsWith('/api/auth')
  ) {
    return NextResponse.next();
  }

  const isApi = pathname.startsWith('/api/');
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  let payload = null;
  if (token) {
    let secret: string;
    try {
      secret = getSessionSecret();
    } catch {
      // Misconfigured server: fail closed, do not leak details.
      return isApi
        ? NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
        : new NextResponse('Server configuration error', { status: 500 });
    }
    payload = await verifySessionToken(token, secret);
  }

  if (!payload) {
    if (isApi) {
      return NextResponse.json({ error: 'Authentication required', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if ((pathname.startsWith('/demo') || pathname.startsWith('/integrity')) && payload.r !== 'reviewer') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/auth|api/public|_next/static|_next/image|favicon.ico).*)'],
};
