/**
 * Single source of truth for the backend service-account password.
 *
 * The value comes ONLY from the environment (`BACKEND_SERVICE_PASSWORD`):
 *
 * - In PRODUCTION (`NODE_ENV=production` OR a `DATABASE_URL` is configured) the
 *   variable is MANDATORY. {@link getServicePassword} throws a fatal startup
 *   error if it is missing, so a misconfigured deploy fails closed instead of
 *   ever falling back to a public/default credential.
 * - In local DEVELOPMENT (SQLite / no DB env vars) an obvious, clearly-insecure
 *   placeholder is allowed so `npm run start:dev` works with zero setup.
 *
 * Do NOT inline `process.env.BACKEND_SERVICE_PASSWORD || '<fallback>'` anywhere —
 * that pattern silently re-introduces a public, hardcoded credential. Use this
 * helper (mirrors `common/config/jwt-secret.ts`). The frontend keeps its own copy
 * of the same logic in `apps/web/src/lib/backendAuth.ts`; both must read the same
 * `BACKEND_SERVICE_PASSWORD` for the service login to succeed.
 */

/** Explicit dev/test-only default — clearly a placeholder, NEVER returned in prod. */
export const DEV_SERVICE_PASSWORD = 'dev-only-change-me';

/** Message used when the credential is required but absent. */
export const SERVICE_PASSWORD_MISSING_MESSAGE =
  'BACKEND_SERVICE_PASSWORD es obligatoria; configúrala en el entorno';

/**
 * True when the process runs against a real/production database, where a
 * hardcoded credential must never be used. Matches the task's definition
 * (`NODE_ENV=production` or a `DATABASE_URL` is present); a bare `DB_HOST` is
 * treated as local dev (see `orm.options.ts`).
 */
export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || !!process.env.DATABASE_URL;
}

/**
 * Raw env value with surrounding whitespace trimmed, or `null` when unset/blank.
 * No fallback and never throws — for callers that must DECIDE what to do when the
 * password is absent (e.g. skip an optional seed) rather than fail closed.
 */
export function servicePasswordFromEnv(): string | null {
  const value = process.env.BACKEND_SERVICE_PASSWORD?.trim();
  return value ? value : null;
}

/**
 * The service password to use. Returns the env value when set; otherwise throws
 * in production (fail-closed) and returns the dev-only placeholder in local dev.
 */
export function getServicePassword(): string {
  const fromEnv = servicePasswordFromEnv();
  if (fromEnv) return fromEnv;
  if (isProductionRuntime()) {
    throw new Error(SERVICE_PASSWORD_MISSING_MESSAGE);
  }
  return DEV_SERVICE_PASSWORD;
}
