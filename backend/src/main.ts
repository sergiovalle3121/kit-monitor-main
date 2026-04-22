import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';
import { Request, Response, NextFunction } from 'express';

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

  // Prefijo global: todas las rutas bajo /api
  app.setGlobalPrefix('api');

  // Seguridad y compresión
  app.use(helmet({
    frameguard: false,
  }));
  app.use(compression());

  // ---------------------------
  // CORS
  // ---------------------------
  const env = process.env.NODE_ENV || 'development';
  const allowedOriginEnv = process.env.ALLOWED_ORIGIN || '';

  const allowedOrigins = parseAllowedOrigins(allowedOriginEnv);

  const defaultDevOrigins = ['http://localhost:4200', 'http://localhost:5173'];
  const defaultProdOrigins = ['https://axonos.up.railway.app'];
  const originsToValidate = allowedOrigins.length > 0
    ? allowedOrigins
    : (env === 'development' ? defaultDevOrigins : defaultProdOrigins);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const normalizedOrigin = origin.replace(/\/+$/, '');

      if (originsToValidate.length === 0) {
        return callback(null, true);
      }

      if (originsToValidate.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin not allowed by CORS: ${normalizedOrigin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-frontend-key'],
  });

  // ---------------------------
  // Gate opcional con llave compartida desde el frontend (solo prod)
  // ---------------------------
  const sharedKey = process.env.FRONTEND_SHARED_KEY;
  if (env === 'production' && sharedKey) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      // Deja libres endpoints críticos para autenticación y salud
      if (req.path === '/api/health' || req.path === '/api/auth/login') return next();
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

  console.log(
    `[CORS] NODE_ENV=${env} ALLOWED_ORIGIN_RAW="${allowedOriginEnv}" ALLOWED_ORIGINS_RESOLVED=${JSON.stringify(originsToValidate)}`
  );
  console.log(
    `API listening on :${port} (NODE_ENV=${env}) allowedOrigins=${originsToValidate.join(
      ', '
    )}`
  );
}

bootstrap();
