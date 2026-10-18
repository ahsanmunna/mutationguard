/**
 * Environment checks used by authentication.
 * Plain TypeScript with no Node-only imports, so it also runs in the Edge middleware.
 */

const PLACEHOLDER_HINTS = ['change', 'example', 'placeholder', 'replace', 'your_', 'your-', 'secret_here'];

/**
 * Returns the secret that signs session cookies, or throws a clear error.
 *   - always: must exist and be at least 32 characters
 *   - in production: must not look like a placeholder copied from .env.example
 */
export function getSessionSecret(env: Record<string, string | undefined> = process.env): string {
  const secret = env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      'SESSION_SECRET is not set. Generate one with: ' +
        'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  if (secret.length < 32) {
    throw new Error('SESSION_SECRET is too short: it must be at least 32 characters.');
  }
  if (env.NODE_ENV === 'production') {
    const lower = secret.toLowerCase();
    if (PLACEHOLDER_HINTS.some((hint) => lower.includes(hint))) {
      throw new Error('SESSION_SECRET looks like a placeholder. Use a long random value in production.');
    }
  }
  return secret;
}

/** One-click demo login and the demo panel only work when DEMO_MODE=true. */
export function isDemoMode(env: Record<string, string | undefined> = process.env): boolean {
  return env.DEMO_MODE === 'true';
}
