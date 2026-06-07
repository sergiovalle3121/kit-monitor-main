/**
 * Single source of truth for the JWT signing secret.
 *
 * - Returns `JWT_SECRET` when it is set and strong enough (>= 16 chars).
 * - In production a strong secret is MANDATORY: if it is missing or too short
 *   this throws, so the app refuses to boot rather than signing tokens with an
 *   insecure, guessable fallback.
 * - In development/test it falls back to an explicit, clearly-insecure default
 *   (never used in production).
 *
 * Do NOT inline `process.env.JWT_SECRET || '<fallback>'` anywhere — that pattern
 * silently re-introduces an insecure secret. Use this helper. A guard test
 * (`jwt-secret.spec.ts`) fails if any hardcoded secret fallback reappears.
 */

const MIN_LENGTH = 16;

/** Explicit dev/test-only default — clearly insecure, never returned in prod. */
export const DEV_JWT_SECRET = 'axos-dev-only-insecure-jwt-secret-change-me';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  if (typeof secret === 'string' && secret.length >= MIN_LENGTH) {
    return secret;
  }

  if (isProd) {
    throw new Error(
      `JWT_SECRET is required in production and must be at least ${MIN_LENGTH} characters. ` +
        'Set a strong JWT_SECRET environment variable before deploying.',
    );
  }

  return DEV_JWT_SECRET;
}
