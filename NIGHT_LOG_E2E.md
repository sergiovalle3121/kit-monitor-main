# AXOS OS — Night Log · Carril G1 (E2E Playwright)

Bitácora del carril **G1 / E2E end-to-end** del frontend. Rama
`claude/nice-cerf-iva3nk`.

**Alcance de archivos (lo que toqué):**
- `apps/web/e2e/**` — harness completo (config de fixtures, fake backend, specs).
- `apps/web/playwright.config.ts` — config de Playwright.
- `apps/web/package.json` — edición mínima: dep `@playwright/test` + script `e2e`.
- `data-testid` añadidos (solo atributos, **cero cambios de lógica**) en 7
  componentes de feature — ver §5.
- `package-lock.json` — consecuencia obligada de instalar la dependencia.
- `NIGHT_LOG_E2E.md` — esta bitácora.

> **Reglas que seguí:** trabajo solo en mi carril; **no toco** componentes de
> feature salvo para AÑADIR `data-testid`; **no toco** `.github/workflows/ci.yml`
> (lo dejo anotado para que tú lo integres, §8); tests **deterministas y rápidos**
> (espera por selectores, nunca por tiempos). Puertas antes de cerrar: `tsc
> --noEmit` y `eslint` en verde sobre todo lo que toqué.

---

## 1. Qué entregué

Un harness de **Playwright** montado en `apps/web` que cubre el **GOLDEN PATH**
end-to-end contra el **dev server real de Next**, logueado como el **admin
Master** (el owner `sergiovallezarate@gmail.com`, acceso total — nunca
read-only). Seis tests, todos verdes y estables:

| # | Spec | Flujo cubierto |
|---|------|----------------|
| 1 | `01-login-hub` | **Login Master → hub** sin quedar en read-only |
| 2 | `02-npi-model` | **NPI**: crear modelo → BOM → activar |
| 3 | `03-planning-muro` (a) | **Muro**: publicar WO → verla en el Muro → semáforo **Clear-to-Build** |
| 3 | `03-planning-muro` (b) | **Planeación**: publicar un plan → pasa a "Publicado" |
| 4 | `04-operator-terminal` | **Operador**: abrir terminal de estación → ver **paso** + **ayuda visual** |
| 5 | `05-quality-ncr` | **Calidad**: abrir NCR cockpit → crear NCR → ver su detalle |

```
$ npm run e2e -w web
  ✓ 01-login-hub … Master logs in and lands in the hub with full (non read-only) access
  ✓ 02-npi-model … creates a model, adds a BOM line and activates it
  ✓ 03-planning-muro … publishes a WO on the Muro and sees it Clear-to-Build
  ✓ 03-planning-muro … publishes a plan in Planning and sees it become "Publicado"
  ✓ 04-operator-terminal … opens the station terminal and shows the step + visual aid
  ✓ 05-quality-ncr … creates an NCR from the cockpit and opens its detail
  6 passed (~15 s)
```

---

## 2. Arquitectura del harness (y por qué)

El data-layer del web (`hooks/useApi.ts` + `lib/apiFetch.ts`) manda **todas** las
llamadas de datos a `NEXT_PUBLIC_API_URL`. Las páginas de feature no tienen
fallback local: dependen 100% del backend NestJS (+Postgres/SQLite). Para que el
golden path sea **determinista, rápido y hermético** —y dentro del carril
frontend, sin tocar backend ni CI— **stubeo el backend en la frontera de red** y
**falsifico la sesión del Master**:

1. **Dev server real + backend mockeado.** `playwright.config.ts` arranca
   `next dev` con `NEXT_PUBLIC_API_URL=http://localhost:4010` (un origen que nadie
   sirve). `e2e/fixtures/mock-backend.ts` intercepta `http://localhost:4010/**`
   con un **fake en memoria con estado** que implementa justo lo que el golden
   path necesita y **mantiene estado entre páginas** (modelo → BOM → activar →
   WO → paso → NCR). Cero NestJS, cero base de datos. Las formas de respuesta
   reproducen exactamente los campos que leen las páginas.

2. **Sesión Master forjada.** La app deriva el acceso total del **email del
   owner** (`lib/owner.ts`). El gate del hub se decide con la **cookie de sesión**
   firmada (HMAC, `lib/session.ts`), leída por el middleware y `/api/auth/me`.
   `e2e/fixtures/session.ts` **replica esa firma** (mismo secreto que el dev
   server) y siembra:
   - la cookie `axos_session` (gate de servidor → el hub ve todas las áreas), y
   - un JWT decode-only en `localStorage` (`axos_access_token`) para el
     `AuthContext` del cliente, sin viaje al backend.

   El spec de login (01) **no** forja la cookie: maneja el **formulario real** y
   stubea el `POST /api/auth/login` para devolver 200 + `Set-Cookie` firmado, de
   modo que ejercita login → redirect → hub de verdad.

**Por qué mock y no levantar el backend real:** el carril es G1 (frontend), con
prohibición de tocar backend/CI y requisito de determinismo. Levantar NestJS +
DB añade un segundo servidor, tiempos reales y dependencia de que el backend
tenga cableado TODO el golden path (cosas que no puedo arreglar desde aquí). El
mock deja la prueba **enfocada en el cableado de la UI del web**, que es lo que
G1 posee. El §8 explica cómo correr contra el backend real si se quiere.

---

## 3. Qué cubre cada test (aserciones clave)

- **01 · Login Master → hub.** Llena email (owner) + password en el formulario
  real, envía, aterriza en `/dashboard`, saluda "Hola, Master.", ve las áreas del
  hub (Diseño·NPI, Modelos·NPI, Calidad). **Prueba de "no read-only":** navega a
  `/dashboard/admin/approvals` y verifica que **no** lo rebota a
  `?blocked=admin` — ruta que el middleware bloquea para cualquier rol que no sea
  `admin` (un demo/executive read-only sí sería rebotado).
- **02 · NPI.** Crea un modelo DRAFT, va a su detalle, **Crear BOM**, agrega una
  línea de BOM (parte + cantidad), la ve aparecer, **Activar** → el pill de estado
  pasa a **"Activo"**.
- **03a · Muro.** **Publicar WO** para el modelo activo sembrado → la **tarjeta
  WO** aparece en el Muro y su **semáforo Clear-to-Build** lee `go` ("Clear to
  Build" verde). El estado CTB lo computa el cliente con BOM activo + inventario
  (los sirvo coherentes en el mock).
- **03b · Planeación.** Crea un plan para el modelo sembrado, **Publicar**, el
  plan pasa a **"Publicado"** y expone el botón **Solicitar**. *(Nota de realidad
  en §6: "Publicar" en Planeación genera la pick-list de almacén; el WO del Muro
  es otro flujo.)*
- **04 · Operador.** Abre `/dashboard/operator-terminal`, escribe la estación
  (`EST-10`); el contexto carga y se ve el badge **"Paso 1 · EST-10"** y la
  **imagen de ayuda visual** (`alt="Ayuda visual del paso"`). **Sin websockets**:
  esta página renderiza paso + ayuda visual solo con HTTP (lo verifiqué en el
  código; el `operador` —otra página— sí usa sockets y NO es el objetivo).
- **05 · Calidad.** Abre el NCR cockpit, **Nueva NCR**, llena los campos
  requeridos, **Crear NCR**; la fila aparece, hace click y abre el **detalle**
  (`/dashboard/quality/ncr/:id`) verificando número de NCR + número de parte.

---

## 4. Estructura de archivos

```
apps/web/
├─ playwright.config.ts            # testDir e2e/, webServer=next dev, baseURL, env
├─ e2e/
│  ├─ .gitignore                   # ignora .report/ .test-results/ .cache/ (sin tocar el .gitignore raíz)
│  ├─ README.md                    # cómo correr + qué se mockea
│  ├─ fixtures/
│  │  ├─ constants.ts              # BASE_URL, API_ORIGIN, SESSION_SECRET, OWNER_EMAIL
│  │  ├─ session.ts                # firma cookie axos_session + JWT (loginAsMaster)
│  │  └─ mock-backend.ts           # fake en memoria con estado + route handlers
│  └─ golden/
│     ├─ 01-login-hub.spec.ts
│     ├─ 02-npi-model.spec.ts
│     ├─ 03-planning-muro.spec.ts
│     ├─ 04-operator-terminal.spec.ts
│     └─ 05-quality-ncr.spec.ts
```

---

## 5. `data-testid` añadidos (solo atributos, cero lógica)

Donde el DOM era ambiguo (botones/inputs repetidos, pills de estado, tarjetas
dinámicas) añadí `data-testid` (y algún `data-*` de apoyo). Cada edición es un
atributo nuevo sobre un tag existente:

| Archivo | testids añadidos |
|---------|------------------|
| `login/page.tsx` | `login-email`, `login-password`, `login-submit` |
| `dashboard/models/[id]/page.tsx` | `model-status-pill`, `model-activate-btn`, `bom-create-btn`, `bom-part-input`, `bom-qty-input`, `bom-add-btn`, `bom-component-row` (+`data-component`) |
| `dashboard/production-plan/page.tsx` | `wo-publish-open`, `wo-publish-submit`, `wo-model-select`, `wo-model-input`, `wo-card` (+`data-model`/`data-folio`), `wo-ctb` (+`data-ctb-status`) |
| `dashboard/operator-terminal/page.tsx` | `station-input`, `step-badge`, `visual-aid-image` |
| `dashboard/quality/page.tsx` | `ncr-new-trigger`, `ncr-create-submit`, `ncr-field-partNumber`, `ncr-field-category`, `ncr-field-description`, `ncr-row` (+`data-ncr-number`) |
| `dashboard/quality/ncr/[id]/page.tsx` | `ncr-detail` |
| `dashboard/planning/page.tsx` | `plan-new-btn`, `plan-model-select`, `plan-create-submit`, `plan-publish` |

---

## 6. Hallazgos durante el mapeo

- **Planeación vs. Muro están desacoplados.** En la página de **Planeación**,
  "Publicar" llama `POST /pick-lists` (explota el BOM → lista de surtido para
  almacén); **no** crea un WO del Muro. El WO que aparece en el **Muro**
  (`/dashboard/production-plan`) con semáforo Clear-to-Build lo crea el botón
  propio del Muro, **"Publicar WO"** (`POST /production-plan/publish`). Son tablas
  distintas en el backend (`sf_work_orders` vs. la tabla legacy de planes). Por
  eso el test 03 cubre **ambas piernas por separado y de forma honesta**, sin
  inventar un acoplamiento que la app real no tiene.
- **El operador-terminal no necesita websockets** para mostrar paso + ayuda
  visual (sí los usa la página `operador`, que es otra). Mockear HTTP basta.
- **Ningún gate de rol en las páginas de feature.** El único "Sin acceso" viene
  de un 401/403 del API en los GET. Como el mock responde 200, todo el golden
  path está disponible para el Master sin lógica de rol que estorbe.

---

## 7. Reporte de flakiness

**Nada quedó flaky en mis corridas.** Mitigaciones aplicadas:
- Espera **por selectores/estado** (auto-waiting de Playwright), nunca por
  tiempos. Cero `waitForTimeout`.
- **Estado fresco del mock por test** (cada test instala su propio fake), así no
  hay dependencias de orden entre tests.
- Aserciones sobre **estado durable** (pills, atributos `data-ctb-status`,
  navegación, filas) en vez de toasts efímeros (los toasts se auto-descartan a
  3.5 s; los uso solo como señal secundaria).
- `workers: 1` y `fullyParallel: false`: evita la contención del primer compile
  on-demand de `next dev` (que sí podría provocar timeouts si se compilan muchas
  rutas a la vez). Los tests igual son rápidos (~1–4 s c/u).
- `retries: 0`: para que cualquier flake **aflore** en vez de ocultarse.

Evidencia de estabilidad:
- Corrida base: **6/6 verdes** (~15 s).
- `--repeat-each=3` (18 ejecuciones): **18/18 verdes**, tiempos estables.
- Arranque **en frío** (Playwright gestiona el `webServer`, sin server previo):
  **6/6 verdes**.

**Riesgos de flake conocidos (no observados, anotados para honestidad):**
- El primer test tras un dev server frío paga el compile on-demand de la ruta; el
  `webServer.timeout` (180 s) y el auto-wait lo absorben. Si en CI el runner es
  muy lento, subir ese timeout.
- Si algún día se corre contra el **backend real** (no el mock), entran tiempos y
  datos reales → posible flake; eso quedaría fuera del alcance hermético de este
  harness (ver §8).

---

## 8. Integración a CI (NO aplicada — para que tú la metas)

No toqué `.github/workflows/ci.yml`. Notas para integrarlo:

1. **Browsers / egress.** El allowlist de red de este entorno **bloquea
   `cdn.playwright.dev`**, así que no pude bajar el navegador de la última
   Playwright (1.61, build 1228). El entorno ya trae **Chromium build 1194
   (Chromium 141)** preinstalado, que corresponde a **Playwright 1.56.x** — por
   eso **pineé `@playwright/test@1.56.0`** (exacto) en `apps/web/package.json`,
   para correr contra el navegador disponible. Si en CI/GitHub Actions el egress
   es abierto, puedes subir a la última y `npx playwright install --with-deps
   chromium`. Si mantienes el entorno restringido, **añade `cdn.playwright.dev`
   al allowlist** o conserva el pin a 1.56.
2. **Job sugerido** (separado, no bloqueante al inicio; el web ya pasa `Lint web`
   y `Build web` con mis cambios — lo verifiqué con `tsc --noEmit` y `eslint`):

   ```yaml
     e2e-web:
       name: E2E web (golden path)
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: 20, cache: npm }
         - run: npm ci
         - run: npx playwright install --with-deps chromium
           working-directory: apps/web
         - run: npm run e2e
           working-directory: apps/web
         - uses: actions/upload-artifact@v4
           if: failure()
           with:
             name: playwright-report
             path: apps/web/e2e/.report
   ```

   `npm ci` **no** baja navegadores por sí solo (no hay postinstall que toque la
   CDN), así que el install de CI no se rompe aunque el egress esté cerrado; el
   navegador se baja explícitamente en el step de `playwright install`.
3. Los artefactos (`e2e/.report`, `e2e/.test-results`) están **git-ignored** vía
   `apps/web/e2e/.gitignore` (no toqué el `.gitignore` raíz). El `eslint`
   del repo solo los vería si corres lint **después** de los tests en el mismo
   árbol; en un checkout limpio de CI no existen. Recomendación: e2e como job
   aparte (como arriba), o correr lint antes de e2e.

---

## 9. Cómo correr (local)

```bash
# 1) Instalar deps (una vez)
npm install -w web

# 2) Navegador (una vez; requiere cdn.playwright.dev en el allowlist,
#    o usa el preinstalado que ya casa con el pin 1.56)
npx playwright install chromium   # desde apps/web

# 3) Correr el golden path (Playwright levanta y apaga el dev server solo)
npm run e2e -w web
#   variantes: --headed, --ui, --debug, --repeat-each=3, -g "NPI"
```

Más detalle en `apps/web/e2e/README.md`.

---

## 10. Siguientes pasos (fuera de alcance de este turno)

- **Modo backend real (opcional):** apuntar `NEXT_PUBLIC_API_URL` al backend
  (que soporta SQLite sin setup) y dejar de instalar el mock — útil como suite de
  integración nocturna; convivirían con un flag de entorno.
- Ampliar cobertura: rutas alternas (rechazos/holds, NCR→CAPA, transición de WO,
  poka-yoke del operador) una vez estable la base.
- Visual regression / a11y como capas separadas si se quiere.
