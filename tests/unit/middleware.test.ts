import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../../src/middleware';

process.env.SESSION_SECRET = 'm'.repeat(64);

const call = (path: string) => middleware(new NextRequest(`http://localhost:3000${path}`));
const passesThrough = (res: Response) => res.headers.get('x-middleware-next') === '1';

describe('middleware access rules', () => {
  it('lets logged-out visitors load the logo and icons (so the brand image can render)', async () => {
    expect(passesThrough(await call('/brand/logo-mark.png'))).toBe(true);
    expect(passesThrough(await call('/icon.png'))).toBe(true);
    expect(passesThrough(await call('/apple-icon.png'))).toBe(true);
  });

  it('lets logged-out visitors open the public pages', async () => {
    for (const path of ['/', '/login', '/verify/TR-2026-0001', '/api/public/verify/TR-2026-0001']) {
      expect(passesThrough(await call(path))).toBe(true);
    }
  });

  it('still protects app pages and APIs without a session', async () => {
    const page = await call('/dashboard');
    expect(passesThrough(page)).toBe(false);
    expect(page.headers.get('location')).toContain('/login');
    expect((await call('/api/transfers')).status).toBe(401);
    expect((await call('/brandx/secret')).status).not.toBe(200);
  });
});