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

function sslFor(url?: string): false | { rejectUnauthorized: boolean } {
  const isProd = process.env.NODE_ENV === 'production';
  return isProd || url?.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false;
}

/**
 * Ensure a STABLE JWT secret across deploys without hardcoding anything.
 *
 * Call this once at bootstrap BEFORE NestFactory.create so getJwtSecret() (read
 * synchronously by JwtModule + JwtStrategy) returns the persisted value:
 *   - If a strong JWT_SECRET env is set → use it (nothing to persist).
 *   - Else, on a Postgres deploy → load a secret from the `app_settings`
 *     singleton table; if none exists, generate a strong random one ONCE and
 *     persist it. On the next deploy it is read back → sessions survive restarts.
 *   - On local SQLite dev (no DB env) → no-op (getJwtSecret returns the dev default).
 *
 * Defensive: any failure is swallowed so the app still boots (getJwtSecret then
 * falls back to a per-process random secret — available, just not stable).
 * NOTE: setting JWT_SECRET in the host (Railway) is still ideal; this only makes
 * the no-env case stop logging everyone out on each deploy.
 */
export async function ensurePersistentJwtSecret(): Promise<void> {
  const current = process.env.JWT_SECRET;
  if (typeof current === 'string' && current.length >= MIN_LENGTH) return;

  const url = process.env.DATABASE_URL;
  const host = process.env.DB_HOST;
  if (!url && !host) return; // SQLite dev — dev default is fine

  try {
    // Lazy require so non-PG/dev paths never need the driver loaded.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Client } = require('pg');
    const client = url
      ? new Client({ connectionString: url, ssl: sslFor(url) })
      : new Client({
          host,
          port: Number(process.env.DB_PORT ?? 5432),
          user: process.env.DB_USERNAME,
          password: String(process.env.DB_PASSWORD ?? ''),
          database: process.env.DB_DATABASE,
          ssl: sslFor(),
        });
    await client.connect();
    // Additive + idempotent: brand-new singleton table, created only if missing.
    await client.query(
      `CREATE TABLE IF NOT EXISTS "app_settings" (
         "key" varchar(120) PRIMARY KEY,
         "value" text NOT NULL,
         "updated_at" TIMESTAMP NOT NULL DEFAULT now()
       )`,
    );
    const sel = await client.query(
      `SELECT "value" FROM "app_settings" WHERE "key" = 'jwt_secret' LIMIT 1`,
    );
    let secret: string | undefined = sel.rows?.[0]?.value;
    if (!secret || secret.length < MIN_LENGTH) {
      secret = randomBytes(48).toString('base64url');
      await client.query(
        `INSERT INTO "app_settings" ("key", "value") VALUES ('jwt_secret', $1)
         ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = now()`,
        [secret],
      );
      // eslint-disable-next-line no-console
      console.warn(
        '🔐 JWT_SECRET not set — generated and PERSISTED a strong secret in ' +
          'app_settings (stable across deploys). Set a JWT_SECRET env for full control.',
      );
    } else {
      // eslint-disable-next-line no-console
      console.log('🔐 Loaded persisted JWT secret from app_settings (stable across deploys).');
    }
    process.env.JWT_SECRET = secret;
    await client.end();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      '[jwt] Could not persist/load JWT secret; falling back to a per-process ' +
        `secret (not stable): ${(err as Error)?.message}`,
    );
  }
}
