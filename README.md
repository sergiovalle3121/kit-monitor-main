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

## Build

```bash
npm --prefix frontend run build
npm --prefix backend run build
```

## Tests

```bash
npm --prefix backend test
npm --prefix frontend test
```

### Backend test (Jest)

- El backend usa Jest (`backend/package.json` -> script `test`).
- Los specs se descubren por regex `.*\.spec\.ts$` bajo `backend/src` (config `jest.rootDir = src`).
- Si no hay archivos `*.spec.ts`, Jest reportara "No tests found".

### Frontend test (Karma headless)

- El frontend usa Angular + Karma en modo headless.
- El comando `npm --prefix frontend test` ejecuta `frontend/scripts/run-headless-tests.cjs`, que intenta resolver `CHROME_BIN` automaticamente.
- Orden de resolucion:
  1. `CHROME_BIN` ya definido en el entorno.
  2. Ejecutable de Puppeteer (si Puppeteer esta instalado).
  3. Rutas comunes de Chrome/Chromium del sistema operativo.
- Si no hay navegador disponible y no se puede usar Puppeteer, el fallo es de entorno (infra), no de la app.

## Troubleshooting / Solucion de problemas

- **CHROME_BIN missing / No binary for ChromeHeadless**
  - Verifica que haya Chrome/Chromium instalado o exporta `CHROME_BIN` con la ruta correcta.
- **No Chrome/Chromium installed**
  - Instala Chrome/Chromium en el agente CI o en tu maquina local.
- **Puppeteer no disponible por red/politica**
  - Si tu entorno bloquea descargas npm (por ejemplo 403 al registry), usa un Chrome/Chromium preinstalado y define `CHROME_BIN`.
- **Backend tests sin specs**
  - Agrega archivos `*.spec.ts` dentro de `backend/src`; de lo contrario Jest finaliza sin encontrar pruebas.

## Cobertura actual (alto nivel)

- **Backend**: hay base de pruebas unitarias sobre parser de BOM y reglas clave relacionadas al runtime de produccion segun los specs existentes.
- **Frontend**: hay pruebas unitarias sobre comportamiento critico del monitor/panel MES (agregacion de datos por bahia y reglas de expansion).

## Notas

- El backend puede usar una base SQLite local para desarrollo.
- Los archivos generados, logs, caches y bases locales estan excluidos del control de versiones.
- El modulo de Ayudas Visuales permite almacenar referencia/contenido PDF en base de datos para evitar dependencia de almacenamiento local efimero.
