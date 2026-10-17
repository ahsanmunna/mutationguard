import { NextRequest, NextResponse } from 'next/server';
import { DEMO_COOKIE_NAME } from './lib/auth-types';

/**
 * MutationGuard Access Control Middleware (Stage A Auth Stub)
 *
 * Public routes:
 *   - / (Home)
 *   - /login
 *   - /verify/* (Public verification page)
 *   - /api/public/*
 *   - /api/auth/*
 *   - /_next/*, /favicon.ico, static assets
 *
 * Protected routes:
 *   - /dashboard
 *   - /transfers/*
 *   - /integrity
 *   - /demo
 *   - /api/transfers/*
 *   - /api/audit/*
 *   - /api/parcels/*
 *   - /api/deeds/*
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Allow static Next.js assets and favicon
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // 2. Allow public routes
  if (
    pathname === '/' ||
    pathname === '/login' ||
    pathname.startsWith('/verify') ||
    pathname.startsWith('/api/public') ||
    pathname.startsWith('/api/auth')
  ) {
    return NextResponse.next();
  }

  // 3. Check for demo session cookie
  const authCookie = req.cookies.get(DEMO_COOKIE_NAME);

  if (!authCookie || !authCookie.value) {
    // If API route: return 401 Unauthorized
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED: Please log in with a demo account' },
        { status: 401 }
      );
    }

    // If browser page: redirect to /login
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/auth|api/public|_next/static|_next/image|favicon.ico).*)'],
};
