import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';
import { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });

  // Prefijo global: todas las rutas bajo /api
  app.setGlobalPrefix('api');

  // Seguridad y compresión
  app.use(helmet());
  app.use(compression());

  // ---------------------------
  // CORS
  // ---------------------------
  const env = process.env.NODE_ENV || 'development';

  // Permite pasar varios orígenes separados por coma en ALLOWED_ORIGIN
  // Ej: "https://mi-front.app,https://admin.mi-front.app"
  const allowedOriginEnv =
    process.env.ALLOWED_ORIGIN ||
    (env === 'production'
      ? 'https://your-frontend.up.railway.app'
      : 'http://localhost:4200,http://localhost:5173');

  const allowedOrigins = allowedOriginEnv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
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
      // Deja libre el healthcheck
      if (req.path === '/api/health') return next();

      const got = req.header('x-frontend-key');
      if (got !== sharedKey) {
        return res.status(403).json({ error: 'Forbidden' });
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
    `API listening on :${port} (NODE_ENV=${env}) allowedOrigins=${allowedOrigins.join(
      ', '
    )}`
  );
}

bootstrap();
