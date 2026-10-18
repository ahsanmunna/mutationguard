import { describe, it, expect } from 'vitest';
import { createSessionToken, verifySessionToken, SESSION_MAX_AGE_SECONDS } from '../../src/lib/session';

const SECRET = 'a'.repeat(64);
const NOW = 1_800_000_000;

/** Helpers to forge tokens the way an attacker (or a bug) might. */
const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlText = (text: string) => b64url(enc.encode(text));
async function signRaw(payload: object, secret: string): Promise<string> {
  const body = b64urlText(JSON.stringify(payload));
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

describe('signed session tokens', () => {
  it('round-trips username and role', async () => {
    const token = await createSessionToken('officer_farhan', 'reviewer', SECRET, NOW);
    const payload = await verifySessionToken(token, SECRET, NOW + 10);
    expect(payload?.u).toBe('officer_farhan');
    expect(payload?.r).toBe('reviewer');
    expect(payload?.exp).toBe(NOW + SESSION_MAX_AGE_SECONDS);
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await createSessionToken('officer_farhan', 'reviewer', SECRET, NOW);
    expect(await verifySessionToken(token, 'b'.repeat(64), NOW)).toBeNull();
  });

  it('rejects a payload edited after signing (applicant -> reviewer)', async () => {
    const token = await createSessionToken('rahim_uddin', 'applicant', SECRET, NOW);
    const [, signature] = token.split('.');
    const forgedBody = b64urlText(JSON.stringify({ u: 'rahim_uddin', r: 'reviewer', iat: NOW, exp: NOW + 3600 }));
    expect(await verifySessionToken(`${forgedBody}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it('rejects an altered signature', async () => {
    const token = await createSessionToken('rahim_uddin', 'applicant', SECRET, NOW);
    const flipped = token.slice(0, -2) + (token.endsWith('AA') ? 'BB' : 'AA');
    expect(await verifySessionToken(flipped, SECRET, NOW)).toBeNull();
  });

  it('rejects an expired token and a token issued in the future', async () => {
    const token = await createSessionToken('rahim_uddin', 'applicant', SECRET, NOW);
    expect(await verifySessionToken(token, SECRET, NOW + SESSION_MAX_AGE_SECONDS + 1)).toBeNull();
    expect(await verifySessionToken(token, SECRET, NOW - 3600)).toBeNull();
  });

  it('rejects malformed input without throwing', async () => {
    for (const bad of ['', 'abc', 'a.b.c', '.', 'a.', '.b', null, undefined, 42, {}, 'x'.repeat(5000)]) {
      expect(await verifySessionToken(bad, SECRET, NOW)).toBeNull();
    }
  });

  it("never accepts the 'system' role, even if correctly signed", async () => {
    const token = await signRaw({ u: 'system_audit', r: 'system', iat: NOW, exp: NOW + 3600 }, SECRET);
    expect(await verifySessionToken(token, SECRET, NOW)).toBeNull();
  });

  it('rejects a correctly signed payload with missing or wrong-typed fields', async () => {
    expect(await verifySessionToken(await signRaw({ r: 'reviewer', iat: NOW, exp: NOW + 60 }, SECRET), SECRET, NOW)).toBeNull();
    expect(await verifySessionToken(await signRaw({ u: 'x', r: 'reviewer', iat: 'now', exp: NOW + 60 }, SECRET), SECRET, NOW)).toBeNull();
  });
});
