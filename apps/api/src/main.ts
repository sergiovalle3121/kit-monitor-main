import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import compression from 'compression';
import { Request, Response, NextFunction } from 'express';
import { UsersService } from './modules/users/users.service';
import { UserRole } from './modules/users/entities/user.entity';

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
  // Auto-seed admins
  // ---------------------------
  try {
    const usersService = app.get(UsersService);

    // Service account (used as the frontend-bridge fallback). Configurable.
    const svcEmail = (
      process.env.BACKEND_SERVICE_EMAIL || 'admin@example.com'
    ).toLowerCase();
    const svcPassword = process.env.BACKEND_SERVICE_PASSWORD || '31218223';
    if (!(await usersService.findOneByEmail(svcEmail))) {
      await usersService.create({
        email: svcEmail,
        username: 'admin',
        name: 'Service Admin',
        password: svcPassword,
        role: UserRole.ADMIN,
        isActive: true,
        status: 'active',
        permissions: [],
      });
      console.log('✅ Auto-seed: service admin created.');
    }

    // Master (human) admin — credentials come ONLY from private env vars, never
    // hardcoded, so they never live in the repo. Set MASTER_ADMIN_EMAIL +
    // MASTER_ADMIN_PASSWORD in the backend service to enable.
    const masterEmail = process.env.MASTER_ADMIN_EMAIL?.trim().toLowerCase();
    const masterPassword = process.env.MASTER_ADMIN_PASSWORD;
    if (masterEmail && masterPassword) {
      const existing = await usersService.findOneByEmail(masterEmail);
      if (!existing) {
        await usersService.create({
          email: masterEmail,
          username: masterEmail,
          name: process.env.MASTER_ADMIN_NAME || 'Master Admin',
          password: masterPassword,
          role: UserRole.ADMIN,
          isActive: true,
          status: 'active',
          permissions: [],
        });
        console.log(`✅ Master admin created: ${masterEmail}`);
      } else {
        // Env is the source of truth: keep role/status and password in sync.
        await usersService.update(existing.id, {
          role: UserRole.ADMIN,
          isActive: true,
          status: 'active',
          password: masterPassword,
        });
        console.log(`ℹ️ Master admin ensured: ${masterEmail}`);
      }
    }
  } catch (err) {
    console.error('❌ Auto-seed failed:', err);
  }

  // ---------------------------
  // Arranque
  // ---------------------------
  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port, '0.0.0.0');

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
