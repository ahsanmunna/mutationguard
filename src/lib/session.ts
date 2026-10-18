/**
 * Signed session tokens (no extra library).
 *
 * A token looks like:  <payload>.<signature>   (both base64url)
 *   payload   = JSON { u: username, r: role, iat: issued-at, exp: expires-at }  (seconds)
 *   signature = HMAC-SHA256(payload, SESSION_SECRET)
 *
 * Anyone can READ the payload, but nobody can change it without the secret: a changed
 * payload or signature fails verification. The token is stored in an httpOnly cookie, so
 * browser JavaScript cannot read it at all.
 *
 * It uses the Web Crypto API, which exists in BOTH the Edge middleware and Node, so the
 * same code protects pages (middleware) and APIs (route handlers).
 * crypto.subtle.verify compares signatures in constant time.
 */
import type { UserRole } from './auth-types';

export const SESSION_COOKIE_NAME = 'mg_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

export type SessionRole = Exclude<UserRole, 'system'>; // the system user can never log in

export interface SessionPayload {
  u:   string;       // username
  r:   SessionRole;  // role (used for page redirects; APIs re-read the role from the database)
  iat: number;
  exp: number;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array | null {
  try {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function createSessionToken(
  username: string,
  role: SessionRole,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Promise<string> {
  const payload: SessionPayload = { u: username, r: role, iat: nowSeconds, exp: nowSeconds + SESSION_MAX_AGE_SECONDS };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await importKey(secret), encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

/** Returns the payload if the token is genuine and not expired, otherwise null. Never throws. */
export async function verifySessionToken(
  token: unknown,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Promise<SessionPayload | null> {
  try {
    if (typeof token !== 'string' || token.length === 0 || token.length > 2048) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [body, signatureText] = parts;

    const signature = fromBase64Url(signatureText);
    if (!signature) return null;

    const valid = await crypto.subtle.verify('HMAC', await importKey(secret), signature as BufferSource, encoder.encode(body));
    if (!valid) return null;

    const payloadBytes = fromBase64Url(body);
    if (!payloadBytes) return null;
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes));

    if (typeof payload.u !== 'string' || payload.u.length === 0 || payload.u.length > 100) return null;
    if (payload.r !== 'applicant' && payload.r !== 'reviewer') return null;
    if (typeof payload.iat !== 'number' || typeof payload.exp !== 'number') return null;
    if (payload.exp <= nowSeconds) return null;       // expired
    if (payload.iat > nowSeconds + 60) return null;   // issued in the future (clock tampering)

    return payload as SessionPayload;
  } catch {
    return null;
  }
}
