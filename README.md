# AXOS OS

Monorepo con frontend Next.js y backend NestJS para gestión operativa de producción, planes, kits, BOM, calidad, inventario y analítica en tiempo real.

## Estructura

```
apps/
  api/   API NestJS (backend)
  web/   Aplicación Next.js (frontend)
docs/    Documentación de arquitectura
```

## Requisitos

- Node.js 18+
- npm 10+
- PostgreSQL (producción) / SQLite (desarrollo local)

## Desarrollo local

Desde la raíz del monorepo:

```bash
npm install
npm run dev
```

O por separado:

```bash
# Backend
cd apps/api
npm install
npm run start:dev   # http://localhost:3000

# Frontend
cd apps/web
npm install
npm run dev         # http://localhost:3001
```

## Build

```bash
npm run build
```

## Tests

```bash
cd apps/api && npm test
```

## Variables de entorno

Copia `apps/api/.env.example` a `apps/api/.env` y ajusta los valores:

```
NODE_ENV=development
PORT=3000
ALLOWED_ORIGIN=http://localhost:3001
DATABASE_URL=postgres://user:pass@localhost:5432/axos
JWT_SECRET=your_secret
```

## Notas

- Los archivos generados, logs, caches y bases locales están excluidos del control de versiones.
- El módulo de Ayudas Visuales permite almacenar referencias PDF en base de datos.
- WebSockets habilitados para eventos en tiempo real (Autopilot HUD, Mission Control).
