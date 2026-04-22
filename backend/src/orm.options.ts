import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { join } from "path";

/**
 * Database strategy:
 *
 *  PRODUCTION (DATABASE_URL set)
 *    → PostgreSQL via connection URL
 *    → synchronize: true by default to bootstrap Railway-managed schemas
 *      on fresh databases (override with SYNCHRONIZE=false)
 *    → SSL enabled when sslmode=require or NODE_ENV=production
 *
 *  DEVELOPMENT with explicit PG creds (DB_HOST set)
 *    → PostgreSQL via host/port/user/pass
 *    → synchronize: true by default (override with SYNCHRONIZE=false)
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
  const syncOverride = process.env.SYNCHRONIZE;
  const synchronize =
    syncOverride === "true"
      ? true
      : syncOverride === "false"
        ? false
        : url
          ? false
          : !isProd;

  const pgBase: Partial<TypeOrmModuleOptions> = {
    type: "postgres",
    autoLoadEntities: true,
    synchronize,
    migrationsRun: isProd || process.env.MIGRATIONS_RUN === "true",
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
