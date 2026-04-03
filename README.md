# Kit Monitor

Monorepo con frontend en Angular y backend en NestJS para seguimiento operativo de planes, kits, BOM y monitoreo de produccion.

## Estructura

```text
frontend/   Aplicacion Angular
backend/    API NestJS
```

## Requisitos

- Node.js 18+
- npm 10+

## Desarrollo local

Frontend:

```bash
cd frontend
npm install
npm start
```

Backend:

```bash
cd backend
npm install
npm run start:dev
```

URLs locales:

- Frontend: http://localhost:4200
- Backend: http://localhost:3000

## Notas

- El backend puede usar una base SQLite local para desarrollo.
- Los archivos generados, logs, caches y bases locales estan excluidos del control de versiones.
