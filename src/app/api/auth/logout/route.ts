import { NextResponse } from 'next/server';
import { DEMO_COOKIE_NAME } from '@/lib/auth-types';

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  });

  // Clear cookie
  response.cookies.set({
    name: DEMO_COOKIE_NAME,
    value: '',
    path: '/',
    maxAge: 0,
  });

  return response;
}
