/**
 * Bootstrap compartido para los scripts de semilla DEMO.
 *
 * Arranca un contexto de Nest SIN levantar el servidor HTTP
 * (`NestFactory.createApplicationContext`). Esto IMPORTA `AppModule` pero NO lo
 * edita: los servicios reales se resuelven con `app.get(...)` y se usan tal cual.
 */
import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import {
  TenantContextService,
  TenantContext,
} from '../common/tenant/tenant-context.service';
import { DEMO_ACTOR } from './seed-constants';

/**
 * Salvaguarda anti-producción. La siembra NUNCA debe correr contra prod por
 * accidente. Se permite sólo si la BD es claramente local/efímera o si el dueño
 * pone ALLOW_SEED_DEMO=true de forma explícita.
 */
export function assertNotProduction(): void {
  if (process.env.ALLOW_SEED_DEMO === 'true') return;

  const url = process.env.DATABASE_URL ?? '';
  const isLocal =
    !url || // SQLite local
    /localhost|127\.0\.0\.1|host=\/tmp|@\/|@localhost/.test(url) ||
    process.env.NODE_ENV === 'test';

  if (process.env.NODE_ENV === 'production' || !isLocal) {
    throw new Error(
      [
        'Seguridad: el seed DEMO se bloqueó porque la base de datos no parece local/efímera.',
        'Verifica TODO contra un Postgres local. Si de verdad quieres sembrar este destino,',
        'corre de nuevo con ALLOW_SEED_DEMO=true (el dueño decide cuándo correrlo contra prod).',
        `DATABASE_URL detectada: ${url || '(SQLite local)'}`,
      ].join('\n'),
    );
  }
}

/** Arranca el contexto de aplicación (sin HTTP). */
export async function bootSeedContext(): Promise<INestApplicationContext> {
  return NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
}

/**
 * Ejecuta `fn` dentro de un TenantContext de administrador SIN ámbito
 * (tenant/plant nulos, sin restricción de buildings). Así:
 *   • folios, created_by y auditoría quedan con un actor demo legible;
 *   • el TenantSubscriber no inyecta ni bloquea por ámbito (scopes nulos);
 *   • todo se crea en el mismo ámbito nulo (consistente con el lookup de modelos).
 */
export function runInDemoContext<T>(
  app: INestApplicationContext,
  fn: () => Promise<T>,
): Promise<T> {
  const tenantCtx = app.get(TenantContextService, { strict: false });
  const ctx: TenantContext = {
    tenant_id: null,
    organization_id: null,
    plant_id: null,
    user_email: DEMO_ACTOR,
    role: 'Admin',
    permissions: null,
    scopes: null,
  };
  return tenantCtx.run(ctx, fn);
}
