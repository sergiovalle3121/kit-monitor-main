import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { join } from "path";

/**
 * Database strategy:
 *
 *  PRODUCTION (NODE_ENV=production)
 *    → PostgreSQL via connection URL / creds
 *    → synchronize: ALWAYS false (SYNCHRONIZE no puede forzarlo) → migrationsRun: true
 *      Las migraciones son la única vía de cambiar el esquema en prod.
 *    → SSL enabled when sslmode=require or NODE_ENV=production
 *
 *  DEVELOPMENT with explicit PG creds (DB_HOST set)
 *    → PostgreSQL via host/port/user/pass
 *    → synchronize: true by default (override with SYNCHRONIZE=false) → migrationsRun: false
 *
 *  LOCAL / no DB env vars
 *    → SQLite file at backend/dev.sqlite
 *    → synchronize: true always (schema auto-created on startup)
 *    → zero setup required — dev.sqlite is git-ignored
 */
export function ormOptions(): TypeOrmModuleOptions {
  const isProd = process.env.NODE_ENV === "production";
  const url    = process.env.DATABASE_URL;
  const dbHost = process.env.DB_HOST;

  // ── SQLite fallback (local dev, no PG credentials) ──────────────────────
  if (!url && !dbHost) {
    return {
      type: "sqlite",
      database: process.env.SQLITE_PATH || "dev.sqlite",
      autoLoadEntities: true,
      synchronize: true, // safe: dev only, no production data at risk
    };
  }

  // ── Shared PostgreSQL base ───────────────────────────────────────────────
  // En PRODUCCIÓN nunca auto-sincronizamos el esquema: synchronize:true puede
  // destruir datos. Las migraciones son la única vía. `SYNCHRONIZE=true` NO
  // puede forzar el sync en prod (solo tiene efecto en desarrollo). En dev el
  // default es true (apágalo con SYNCHRONIZE=false). migrationsRun = !synchronize,
  // así en prod corren las migraciones y en dev no.
  const synchronize = isProd
    ? false
    : process.env.SYNCHRONIZE === "false"
      ? false
      : true;

  const pgBase: Partial<TypeOrmModuleOptions> = {
    type: "postgres",
    autoLoadEntities: true,
    synchronize,
    migrationsRun: !synchronize,
    migrations: [join(__dirname, "migrations", "*.{ts,js}")],
    ssl:
      isProd || url?.includes("sslmode=require")
        ? { rejectUnauthorized: false }
        : false,
  };

  // ── PostgreSQL via DATABASE_URL (Railway / production) ───────────────────
  if (url) {
    return { ...pgBase, url } as TypeOrmModuleOptions;
  }

  // ── PostgreSQL via individual env vars (explicit dev/staging) ────────────
  return {
    ...pgBase,
    host:     dbHost,
    port:     Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME,
    password: String(process.env.DB_PASSWORD ?? ""),
    database: process.env.DB_DATABASE,
  } as TypeOrmModuleOptions;
}
