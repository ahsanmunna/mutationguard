/**
 * Tiny login rate limiter: at most 5 FAILED attempts per 10 minutes for each
 * (client address + username). It lives in server memory, so on serverless hosting each
 * instance counts separately. It is a best-effort brake on password guessing, not a
 * replacement for a shared store (documented limitation).
 */
interface Entry { count: number; resetAt: number }

const failures = new Map<string, Entry>();
const MAX_FAILURES = 5;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_TRACKED = 5000;

export function checkLoginRateLimit(key: string, now: number = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
  const entry = failures.get(key);
  if (!entry || entry.resetAt <= now) return { allowed: true, retryAfterSeconds: 0 };
  if (entry.count >= MAX_FAILURES) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordLoginFailure(key: string, now: number = Date.now()): void {
  if (failures.size > MAX_TRACKED) failures.clear(); // never grow without bound
  const entry = failures.get(key);
  if (!entry || entry.resetAt <= now) {
    failures.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function clearLoginFailures(key: string): void {
  failures.delete(key);
}

export function resetRateLimiterForTests(): void {
  failures.clear();
}
