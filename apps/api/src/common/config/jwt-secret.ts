import { randomBytes } from 'crypto';

/**
 * Single source of truth for the JWT signing secret.
 *
 * - Returns `JWT_SECRET` when it is set and strong enough (>= 16 chars).
 * - In production WITHOUT a valid secret: generates a strong RANDOM secret once
 *   per process and logs a loud warning, instead of crashing. This keeps the app
 *   available while never using a guessable/hardcoded value. Because the random
 *   secret rotates on every restart (invalidating sessions), a fixed JWT_SECRET
 *   should still be configured for stable, secure auth.
 * - In development/test it falls back to an explicit, clearly-insecure default.
 *
 * Do NOT inline `process.env.JWT_SECRET || '<fallback>'` anywhere — that pattern
 * silently re-introduces an insecure, guessable secret. Use this helper. A guard
 * test (`jwt-secret.spec.ts`) fails if any hardcoded secret fallback reappears.
 */

const MIN_LENGTH = 16;

/** Explicit dev/test-only default — clearly insecure, never returned in prod. */
export const DEV_JWT_SECRET = 'axos-dev-only-insecure-jwt-secret-change-me';

/**
 * Cached per-process secret used when prod has no valid JWT_SECRET. Cached so
 * every caller (JwtModule signing + JwtStrategy verifying) gets the SAME value
 * within a process — otherwise tokens would be unverifiable.
 */
let generatedProdSecret: string | null = null;

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  if (typeof secret === 'string' && secret.length >= MIN_LENGTH) {
    return secret;
  }

  if (isProd) {
    if (!generatedProdSecret) {
      generatedProdSecret = randomBytes(48).toString('base64url');
      // eslint-disable-next-line no-console
      console.error(
        '⚠️  JWT_SECRET is not set (or < 16 chars) in production. Generated a ' +
          'RANDOM per-process secret so the app can boot — sessions are invalidated ' +
          'on every restart. Set a strong JWT_SECRET env var for stable, secure auth.',
      );
    }
    return generatedProdSecret;
  }

  return DEV_JWT_SECRET;
}

/** Test-only: reset the cached generated secret so cases are independent. */
export function __resetGeneratedProdSecretForTests(): void {
  generatedProdSecret = null;
}
