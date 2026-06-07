/**
 * Bootstrap DI smoke test (compiled-artifact gate).
 *
 * Boots the FULL compiled application graph (NestFactory.create + app.init),
 * which instantiates every provider and resolves every controller's route
 * guards. This catches bootstrap-time dependency-injection failures — e.g. a
 * controller using `@UseGuards(PermissionsGuard)` where the guard's
 * `AuditService` dependency isn't reachable in that module — which `tsc` and
 * isolated unit tests do NOT detect (they only surface when the app starts).
 *
 * Why a compiled script instead of a Jest test: the app uses postgres-only
 * column types and TypeScript design-type metadata, and ts-jest (isolatedModules)
 * does not emit decorator metadata the same way `nest build` (tsc) does, so a
 * Jest boot produces false failures. Running the real dist/ build against a real
 * Postgres mirrors production exactly.
 *
 * Usage (mandatory pre-merge gate):
 *   npm run build
 *   DATABASE_URL=postgres://user:pass@host:5432/db node scripts/bootstrap-smoke.js
 *
 * Exits 0 on a clean boot, 1 on any DI/bootstrap error.
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
  console.error(
    '[bootstrap-smoke] FAIL: set DATABASE_URL (or DB_HOST) to a Postgres database — the app uses postgres-only column types.',
  );
  process.exit(1);
}

(async () => {
  // Quiet the verbose route mapping; keep warnings/errors.
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../dist/app.module');

  let app;
  try {
    app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
    await app.init(); // resolves providers + route guards — where DI bugs surface
    console.log('[bootstrap-smoke] OK — application graph initialized cleanly.');
    await app.close();
    process.exit(0);
  } catch (err) {
    console.error('[bootstrap-smoke] FAIL — bootstrap error:\n', err && err.message ? err.message : err);
    try {
      if (app) await app.close();
    } catch {
      /* ignore */
    }
    process.exit(1);
  }
})();
