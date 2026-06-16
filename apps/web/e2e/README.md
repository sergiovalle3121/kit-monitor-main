# E2E (Playwright) — Golden path

Suite end-to-end del **golden path** de AXOS, contra el **dev server real** de
Next, logueada como el **admin Master** (owner). El backend se **mockea en la
frontera de red** para que sea determinista, rápido y hermético (sin NestJS, sin
base de datos).

## Correr

```bash
npm install -w web                 # deps (una vez)
npx playwright install chromium    # navegador (una vez) — ver nota de versión abajo
npm run e2e -w web                 # corre todo (Playwright levanta/apaga el dev server)
```

Variantes útiles:

```bash
npm run e2e -w web -- --headed         # ver el navegador
npm run e2e -w web -- --ui             # modo UI interactivo
npm run e2e -w web -- -g "NPI"         # filtrar por nombre
npm run e2e -w web -- --repeat-each=3  # probar flakiness
```

Reporte HTML tras una corrida: `npx playwright show-report e2e/.report`.

> **Versión del navegador.** Se pineó `@playwright/test@1.56.0` porque el entorno
> restringe `cdn.playwright.dev` y trae preinstalado Chromium 141 (build 1194),
> que casa con 1.56. Si tu entorno tiene egress abierto puedes subir a la última
> Playwright y reinstalar el navegador.

## Cómo está armado

```
e2e/
├─ fixtures/
│  ├─ constants.ts     # BASE_URL, API_ORIGIN (origen del fake), SESSION_SECRET, OWNER_EMAIL
│  ├─ session.ts       # loginAsMaster(): cookie axos_session firmada (HMAC) + JWT en localStorage
│  └─ mock-backend.ts  # fake en memoria con estado; intercepta API_ORIGIN/** y /api/backend/token
└─ golden/             # un spec por flujo del golden path (01..05)
```

- **Backend mockeado** (`mock-backend.ts`): `playwright.config.ts` arranca
  `next dev` con `NEXT_PUBLIC_API_URL=http://localhost:4010`; todas las llamadas
  de datos del cliente van ahí y las responde el fake (que mantiene estado entre
  páginas: modelo → BOM → activar → WO → paso → NCR). Para añadir cobertura, casi
  siempre basta con un handler nuevo en el router de `handleApi()` y un spec.
- **Sesión Master** (`session.ts`): `loginAsMaster(context)` forja la sesión del
  owner (acceso total, nunca read-only). El spec `01-login-hub` es la excepción:
  maneja el formulario real y stubea `POST /api/auth/login`.
- **Selectores**: se prefieren `data-testid` (añadidos en los componentes solo
  como atributos, sin cambiar lógica) y texto visible estable; nunca esperas por
  tiempo.

Artefactos (`.report/`, `.test-results/`, `.cache/`) están git-ignored aquí.

Detalle completo, hallazgos y notas de CI: `../../NIGHT_LOG_E2E.md`.
