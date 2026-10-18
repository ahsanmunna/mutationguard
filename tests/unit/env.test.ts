import { describe, it, expect } from 'vitest';
import { getSessionSecret, isDemoMode } from '../../src/lib/env';

const GOOD = 'f'.repeat(64);

describe('getSessionSecret', () => {
  it('throws when the secret is missing or too short', () => {
    expect(() => getSessionSecret({})).toThrow(/not set/);
    expect(() => getSessionSecret({ SESSION_SECRET: 'short' })).toThrow(/too short/);
  });

  it('accepts a long random secret', () => {
    expect(getSessionSecret({ SESSION_SECRET: GOOD, NODE_ENV: 'production' })).toBe(GOOD);
  });

  it('rejects the placeholder from .env.example in production only', () => {
    const placeholder = 'replace-with-a-long-random-value-of-at-least-32-characters';
    expect(() => getSessionSecret({ SESSION_SECRET: placeholder, NODE_ENV: 'production' })).toThrow(/placeholder/);
    expect(getSessionSecret({ SESSION_SECRET: placeholder, NODE_ENV: 'development' })).toBe(placeholder);
  });
});

describe('isDemoMode', () => {
  it("is true only for the exact string 'true'", () => {
    expect(isDemoMode({ DEMO_MODE: 'true' })).toBe(true);
    for (const v of [undefined, 'false', 'TRUE', '1', 'yes', '']) {
      expect(isDemoMode({ DEMO_MODE: v })).toBe(false);
    }
  });
});
