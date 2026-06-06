import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import compression from 'compression';
import { Request, Response, NextFunction } from 'express';
import { UsersService } from './modules/users/users.service';
import { UserRole } from './modules/users/entities/user.entity';
import { AuthService } from './modules/auth/auth.service';

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
  const ownerSeedPassword =
    ownerPasswordEnv || process.env.BACKEND_SERVICE_PASSWORD || '31218223';

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
    password: process.env.BACKEND_SERVICE_PASSWORD || '31218223',
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
      name: process.env.MASTER_ADMIN_NAME || 'Master Admin',
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
      name: process.env.OWNER_ADMIN_NAME || 'Owner',
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

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  app.useWebSocketAdapter(new IoAdapter(app));

  // Prefijo global: todas las rutas bajo /api
  app.setGlobalPrefix('api');

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
        return callback(null, true);
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

  console.log(
    `[CORS] NODE_ENV=${env} ALLOWED_ORIGIN_RAW="${allowedOriginEnv}" ALLOWED_ORIGINS_RESOLVED=${JSON.stringify(originsToValidate)}`,
  );
  console.log(
    `API listening on :${port} (NODE_ENV=${env}) allowedOrigins=${originsToValidate.join(
      ', ',
    )}`,
  );
}

bootstrap();
