import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import compression from 'compression';
import { Request, Response, NextFunction } from 'express';
import { UsersService } from './modules/users/users.service';
import { UserRole } from './modules/users/entities/user.entity';
import { AuthService } from './modules/auth/auth.service';
import { ensurePersistentJwtSecret } from './common/config/jwt-secret';
import { getServicePassword } from './common/config/service-password';
import { scanForbidden, formatScanReport } from './seed/forbidden-scan';

function parseAllowedOrigins(raw: string): string[] {
  const value = (raw || '').trim();
  if (!value) return [];

  // Accept JSON array or plain comma/newline/semicolon separated values.
  if (value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => String(entry).trim())
          .map((entry) => entry.replace(/^['"]|['"]$/g, ''))
          .map((entry) => entry.replace(/\/+$/, ''))
          .filter(Boolean);
      }
    } catch {
      // Fall through to delimiter-based parsing.
    }
  }

  return value
    .split(/[,\n;]+/)
    .map((entry) => entry.trim())
    .map((entry) => entry.replace(/^['"]|['"]$/g, ''))
    .map((entry) => entry.replace(/\/+$/, ''))
    .filter(Boolean);
}

/**
 * Idempotently ensure an Admin account exists and is active. Each call is
 * isolated (its own try/catch) so a failure seeding one admin never blocks the
 * others. On first creation the given password is set; on an existing account
 * the role/active flags are re-asserted and the password is only re-synced when
 * `forcePassword` is true (env-as-source-of-truth), so a self-chosen password is
 * never clobbered.
 */
async function ensureAdmin(
  usersService: UsersService,
  params: {
    email: string;
    password: string;
    name: string;
    forcePassword: boolean;
    label: string;
  },
): Promise<void> {
  const email = (params.email ?? '').trim().toLowerCase();
  if (!email) return;
  try {
    const existing = await usersService.findOneByEmail(email);
    if (!existing) {
      await usersService.create({
        email,
        username: email,
        name: params.name,
        password: params.password,
        role: UserRole.ADMIN,
        isActive: true,
        status: 'active',
        permissions: [],
      });
      console.log(`✅ ${params.label} created: ${email}`);
    } else {
      await usersService.update(existing.id, {
        role: UserRole.ADMIN,
        name: params.name,
        isActive: true,
        status: 'active',
        ...(params.forcePassword ? { password: params.password } : {}),
      });
      console.log(`ℹ️ ${params.label} ensured: ${email}`);
    }
  } catch (err) {
    console.error(`❌ ${params.label} seed failed for ${email}:`, err);
  }
}

/**
 * Ensure the platform admins exist. Runs AFTER app.listen() so the database
 * connection + schema sync are fully ready (writes issued before the server is
 * listening can fail silently). Ends with a self-check that exercises the real
 * login path, so the deploy log proves whether the owner can sign in.
 */
async function seedAdmins(app: INestApplication): Promise<void> {
  const usersService = app.get(UsersService);

  const masterEmail = process.env.MASTER_ADMIN_EMAIL?.trim().toLowerCase();
  const masterPassword = process.env.MASTER_ADMIN_PASSWORD;
  const ownerEmails = (
    process.env.OWNER_ADMIN_EMAILS || 'sergiovallezarate@gmail.com'
  )
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const ownerPasswordEnv = process.env.OWNER_ADMIN_PASSWORD;
  // Owner seed password: OWNER_ADMIN_PASSWORD when set, else the service password
  // (env-only; fatal in prod if missing). Never a hardcoded default.
  const ownerSeedPassword = ownerPasswordEnv || getServicePassword();

  console.log(
    `[seed] masterEmail=${masterEmail ?? '(none)'} masterPwLen=${
      masterPassword?.length ?? 0
    }(trim=${masterPassword?.trim().length ?? 0}) owners=${
      ownerEmails.join('|') || '(none)'
    }`,
  );

  // Service account (frontend-bridge fallback). Created if missing, otherwise
  // kept as an active admin (its password is not touched).
  await ensureAdmin(usersService, {
    email: process.env.BACKEND_SERVICE_EMAIL || 'admin@example.com',
    password: getServicePassword(),
    name: 'Service Admin',
    forcePassword: false,
    label: 'Service admin',
  });

  // Master (human) admin — credentials come ONLY from env, never hardcoded.
  // Env is the source of truth, so the password is re-synced on every boot.
  if (masterEmail && masterPassword) {
    await ensureAdmin(usersService, {
      email: masterEmail,
      password: masterPassword,
      name: process.env.MASTER_ADMIN_NAME || 'Sergio',
      forcePassword: true,
      label: 'Master admin',
    });
  }

  // Owner admin(s) — the product owner. ALWAYS ensured as an active Admin so the
  // owner can sign in even with no MASTER_ADMIN_* env. Emails are identity (not
  // secrets), overridable with OWNER_ADMIN_EMAILS. The password comes from env
  // (OWNER_ADMIN_PASSWORD, else the service password); a self-chosen password is
  // only re-synced when OWNER_ADMIN_PASSWORD is set.
  for (const email of ownerEmails) {
    if (email === masterEmail) continue; // already ensured above
    await ensureAdmin(usersService, {
      email,
      password: ownerSeedPassword,
      name: process.env.OWNER_ADMIN_NAME || 'Sergio',
      forcePassword: !!ownerPasswordEnv,
      label: 'Owner admin',
    });
  }

  console.log('✅ Auto-seed complete (service + master + owner admins).');

  // Self-check: run the REAL login path so the deploy log proves whether the
  // owner can sign in (and, if not, exactly why).
  const checkEmail = masterEmail || ownerEmails[0];
  const checkPassword = masterEmail ? masterPassword : ownerSeedPassword;
  if (checkEmail && checkPassword) {
    try {
      const u = await app.get(AuthService).validateUser(checkEmail, checkPassword);
      console.log(
        `✅ Admin login self-check OK: ${checkEmail} (role=${u.role}, active=${u.isActive}).`,
      );
    } catch (e) {
      console.error(
        `❌ Admin login self-check FAILED for ${checkEmail}: ${
          (e as Error).message
        }`,
      );
    }
  }
}

/**
 * Candado de DOMINIO PÚBLICO en arranque (Fase 1, paso 3). OPT-IN para no pegarle
 * a la disponibilidad de prod (escanear toda la base en cada boot es caro; ver
 * DECISIONS §10 — disponibilidad > hard-fail). Sólo corre con
 * `CHECK_PUBLIC_DOMAIN=true`; reporta RUIDOSAMENTE si encuentra datos de cliente
 * real (prefijo OP-/empresa real) y, sólo con `STRICT_PUBLIC_DOMAIN=true`, aborta
 * el arranque. Nunca tumba el boot por sí solo (default = no-op).
 */
async function checkPublicDomainAtStartup(app: INestApplication): Promise<void> {
  if (process.env.CHECK_PUBLIC_DOMAIN !== 'true') return;
  const strict = process.env.STRICT_PUBLIC_DOMAIN === 'true';
  try {
    const res = await scanForbidden(app.get(DataSource));
    if (res.totalMatchedRows === 0) {
      console.log('✅ [public-domain] Base limpia: 0 prefijos OP-/empresas reales.');
      return;
    }
    console.error('🚫🚫🚫 [public-domain] DATOS PROHIBIDOS EN LA BASE 🚫🚫🚫');
    console.error(formatScanReport(res, { examplesPerTable: 3 }));
    console.error('   → npm run seed:audit-forbidden (reporte) · npm run seed:purge-clients -- --apply (purga)');
    if (strict) {
      console.error('   STRICT_PUBLIC_DOMAIN=true → abortando arranque.');
      await app.close();
      process.exit(1);
    }
  } catch (err) {
    // Nunca fatal por sí mismo: un fallo del chequeo no debe tumbar el arranque.
    console.error('[public-domain] Chequeo de arranque falló (no fatal):', (err as Error).message);
  }
}

async function bootstrap() {
  // Fail-closed on the service credential BEFORE doing any work: in production
  // (NODE_ENV=production or a DATABASE_URL is configured) BACKEND_SERVICE_PASSWORD
  // is mandatory. getServicePassword() throws a clear fatal error if it is missing,
  // so a misconfigured deploy crashes loudly at boot instead of ever seeding admins
  // with a public default. (Single source of truth: common/config/service-password.)
  getServicePassword();

  // Resolve a STABLE JWT secret before the DI graph builds (JwtModule + JwtStrategy
  // read it synchronously). Persists one in the DB if no env secret is set, so a
  // redeploy no longer logs everyone out. Never throws — boot is unaffected.
  await ensurePersistentJwtSecret();

  const app = await NestFactory.create(AppModule, { cors: false });
  app.useWebSocketAdapter(new IoAdapter(app));

  // Prefijo global: todas las rutas bajo /api
  app.setGlobalPrefix('api');

  // Validación/saneo global de entrada (anti mass-assignment). whitelist quita
  // propiedades sin decorador class-validator de los DTOs; transform las hidrata
  // a la clase DTO. forbidNonWhitelisted:false mantiene compatibles a clientes
  // laxos: los campos extra se descartan en silencio en vez de devolver 400.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Seguridad y compresión
  app.use(
    helmet({
      frameguard: false,
    }),
  );
  app.use(compression());

  // ---------------------------
  // CORS
  // ---------------------------
  const env = process.env.NODE_ENV || 'development';
  const allowedOriginEnv = process.env.ALLOWED_ORIGIN || '';

  const allowedOrigins = parseAllowedOrigins(allowedOriginEnv);

  const defaultDevOrigins = [
    'http://localhost:4200',
    'http://localhost:5173',
    'http://127.0.0.1:4200',
    'http://127.0.0.1:5173',
  ];
  const defaultProdOrigins = ['https://axonos.up.railway.app'];
  const originsToValidate =
    allowedOrigins.length > 0
      ? allowedOrigins
      : env === 'development'
        ? defaultDevOrigins
        : defaultProdOrigins;

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const normalizedOrigin = origin.replace(/\/+$/, '');

      if (originsToValidate.length === 0) {
        console.error(
          '[CORS] Sin orígenes permitidos configurados; se rechaza la solicitud cross-origin.',
        );
        return callback(new Error('CORS not configured'), false);
      }

      // Exact match or protocol-agnostic match (e.g. //domain.com matches http://domain.com and https://domain.com)
      const isAllowed = originsToValidate.some((allowed) => {
        if (allowed === normalizedOrigin) return true;
        if (
          allowed.startsWith('//') &&
          normalizedOrigin.endsWith(allowed.substring(2))
        ) {
          // Ensure it's not a subdomain mismatch (e.g. //os.app shouldn't match xos.app)
          const domain = allowed.substring(2);
          return (
            normalizedOrigin === `http://${domain}` ||
            normalizedOrigin === `https://${domain}`
          );
        }
        return false;
      });

      if (isAllowed) {
        return callback(null, true);
      }

      console.error(
        `[CORS] Origin rejected: ${normalizedOrigin}. Expected one of: ${JSON.stringify(originsToValidate)}`,
      );
      return callback(
        new Error(`Origin not allowed by CORS: ${normalizedOrigin}`),
        false,
      );
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-frontend-key',
      'X-Building-Id',
      'X-Project-Id',
    ],
  });

  // ---------------------------
  // Gate opcional con llave compartida desde el frontend (solo prod)
  // ---------------------------
  const sharedKey = process.env.FRONTEND_SHARED_KEY;
  if (env === 'production' && sharedKey) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      // Deja libres endpoints críticos para autenticación y salud
      if (
        req.path === '/api/health' ||
        req.path === '/api/auth/login' ||
        req.path === '/api/auth/register'
      )
        return next();
      if (req.method === 'OPTIONS') return next();

      // /api/auth/sync emite JWTs y no tiene guard de ruta: SIEMPRE debe presentar
      // la llave compartida y nunca pasar por un header Authorization (posiblemente
      // forjado), que de otro modo saltaría este muro en una ruta sin guard.
      if (req.path === '/api/auth/sync') {
        if (req.header('x-frontend-key') !== sharedKey) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Missing or invalid x-frontend-key',
          });
        }
        return next();
      }

      // Si el request ya trae Authorization, el JWT guard hará la validación real
      if (req.header('authorization')) return next();

      const got = req.header('x-frontend-key');
      if (got !== sharedKey) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Missing or invalid x-frontend-key',
        });
      }
      next();
    });
  }

  // ---------------------------
  // Arranque
  // ---------------------------
  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port, '0.0.0.0');

  // Seed admins AFTER the server is listening so the DB connection + schema sync
  // are fully ready (writes issued before listen can fail silently). seedAdmins
  // isolates each admin and self-checks the login path, logging the outcome.
  try {
    await seedAdmins(app);
  } catch (err) {
    console.error('❌ Auto-seed failed:', err);
  }

  // Candado legal opcional de arranque (off por default; ver función arriba).
  await checkPublicDomainAtStartup(app);

  console.log(
    `[CORS] NODE_ENV=${env} ALLOWED_ORIGIN_RAW="${allowedOriginEnv}" ALLOWED_ORIGINS_RESOLVED=${JSON.stringify(originsToValidate)}`,
  );
  console.log(
    `API listening on :${port} (NODE_ENV=${env}) allowedOrigins=${originsToValidate.join(
      ', ',
    )}`,
  );
}

bootstrap().catch((err) => {
  console.error(`❌ Fatal startup error: ${(err as Error).message}`);
  process.exit(1);
});
