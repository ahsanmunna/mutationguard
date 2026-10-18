import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginFailures,
  resetRateLimiterForTests,
} from '../../src/lib/rate-limit';

describe('login rate limiter', () => {
  beforeEach(() => resetRateLimiterForTests());

  it('allows 5 failures, then blocks with a retry time', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) {
      expect(checkLoginRateLimit('ip|user', t0).allowed).toBe(true);
      recordLoginFailure('ip|user', t0);
    }
    const blocked = checkLoginRateLimit('ip|user', t0 + 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('counts each address+username separately and recovers after the window', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) recordLoginFailure('ip|alice', t0);
    expect(checkLoginRateLimit('ip|alice', t0).allowed).toBe(false);
    expect(checkLoginRateLimit('ip|bob', t0).allowed).toBe(true);
    expect(checkLoginRateLimit('ip|alice', t0 + 10 * 60 * 1000 + 1).allowed).toBe(true);
  });

  it('a successful login clears the counter', () => {
    for (let i = 0; i < 4; i++) recordLoginFailure('ip|user');
    clearLoginFailures('ip|user');
    recordLoginFailure('ip|user');
    expect(checkLoginRateLimit('ip|user').allowed).toBe(true);
  });
});
