# AXOS OS — Reporte de Auditoría de Hardening

- **Fecha:** 2026-06-24
- **Rama de trabajo:** `claude/confident-cori-l1pima` (ver nota de ramas abajo)
- **Alcance:** auditoría profunda sin features nuevas — multi-tenancy, conectividad front↔back, auth/RBAC, production readiness, cascarones, runtime/build/lint/test, contratos.
- **Método:** diagnóstico con evidencia real `file:line`. Las afirmaciones P0 fueron verificadas leyendo los archivos directamente.

> **Nota de ramas.** La REGLA #0 del encargo pedía una rama `audit/app-hardening-YYYYMMDD`. Las instrucciones del harness de esta sesión designan `claude/confident-cori-l1pima` y prohíben empujar a otra rama sin permiso explícito. Para respetar ambas, la auditoría (de solo lectura) y este reporte viven en `claude/confident-cori-l1pima`. No hubo cambios en `main`. No se hizo merge ni force-push.

---

## 1. Resumen ejecutivo

**Estado general: la app compila, construye y pasa pruebas (verde de build), pero tiene riesgos de seguridad/multi-tenancy P0 de runtime que deben atenderse antes de tratarla como SaaS multi-tenant productivo.**

Salud de build (todo verde — ver §8):
- API `tsc --noEmit`: **OK (0 errores)**
- Web `next build`: **OK**
- Web `lint`: **OK (0 errores, 81 warnings)**
- API `jest`: **153 suites / 1044 tests PASS**

Los 6 hallazgos más graves (P0):

| ID | Hallazgo | Por qué importa |
|---|---|---|
| **P0-AUTH-001** | `UsersController` (`/api/users`) está **sin ningún guard** + no hay `ValidationPipe` global → `POST /api/users {"role":"Admin",...}` **sin autenticar crea un admin**. | Toma de control total de la plataforma por un anónimo. |
| **P0-AUTH-003** | `CancellationRequestsController` **público**: crear y **aprobar/rechazar** cancelaciones de órdenes sin auth. | Bypass de aprobaciones de negocio por un anónimo. |
| **P0-AUTH-002** | `SuppliersController` **público**: crear/editar proveedores, AVL y SCARs sin auth. | Integridad de cadena de suministro. |
| **P0-AUTH-007** | `SignalGateway` (WebSocket `/signals`) **sin autenticación**; cualquiera se une a `tenant:<x>` y recibe eventos críticos/propuestas de otros tenants. | Fuga cross-tenant en tiempo real. |
| **P0-AUTH-010** | Cookie de sesión del front **falsificable**: el secreto cae a `"axos-dev-secret-change-me-in-production"` si `AXOS_SESSION_SECRET` no está seteada. | Forjar sesión admin → el bridge emite JWT de backend. |
| **P0-TENANT-001/003** | **Modelo de tenant fracturado**: `TenantBaseEntity` (snake `tenant_id`) vs `TenantSubscriber` (camel `tenantId`/`buildingId`) vs **51 entidades de negocio sin ninguna columna de scope**. Las **lecturas no se filtran** por tenant a nivel DB. | Fuga cross-tenant de lectura/escritura en gran parte del dominio. |

Lo que **sí está bien** (para no romperlo): manejo de secretos `JWT_SECRET` y `BACKEND_SERVICE_PASSWORD` (fail-closed en prod), gateways `chat`/`live` autenticados con `jwt.verify`, RBAC correcto en `governance`/`roles`/`user-roles`/`plants`, helmet+compression activos, CI con build/test/lint/smoke contra Postgres efímero, y el frontend principal está realmente cableado al backend (no son cascarones).

**Recomendación de orden de ataque:** (1) tapar los controladores públicos (Users/Suppliers/Cancellation/VisualAids/EventLedger) y el `SignalGateway`; (2) `ValidationPipe` global con `whitelist`; (3) `AXOS_SESSION_SECRET` fail-closed; (4) decidir estrategia de tenant (es un proyecto, no un PR chico) y apagar `synchronize` en prod con migraciones. Los puntos 1–3 son chicos y aditivos pero **tocan auth**, así que (por REGLA #0) se documentan aquí y se proponen como PRs DRAFT a confirmar — no se aplicaron automáticamente.

---

## 2. Mapa de arquitectura

- **Monorepo Turborepo**: `apps/api` (NestJS), `apps/web` (Next.js App Router), `packages/contracts` (tipos compartidos, hoy casi vacío).
- **Backend**: NestJS 11 + TypeORM 0.3 + PostgreSQL (SQLite fallback local). **103 controllers, 878 rutas** bajo prefijo global `/api`. ~199 entities TypeORM en ~80 módulos de dominio. 3 WebSocket gateways (`/chat`, `/live`, `/signals`).
- **Frontend**: Next 16 + React 19 + Tailwind 4. **113 `page.tsx`**, **18 route handlers** Next (`apps/web/src/app/**/route.ts`) que actúan como proxy/auth bridge. ~285 rutas de backend distintas consumidas.
- **Auth**: JWT (passport-jwt) **opt-in por controller** (no hay `APP_GUARD` global). RBAC vía `PermissionsGuard` + `@RequirePermission`. Bridge cookie-sesión↔JWT en `apps/web/src/app/api/backend/token/route.ts`.
- **Tenancy (intención vs realidad)**: la doc describe row-level `tenant_id` desde el JWT; la implementación real usa scope por *building/program/line* en `User.scopes` (JSONB) aplicado por `TenantSubscriber` solo en escrituras. Ver §4.

---

## 3. Comandos ejecutados (con resultado real)

| Comando | Resultado |
|---|---|
| `git status` / `git fetch` | Working tree limpio en `claude/confident-cori-l1pima`; sin cambios locales ajenos. |
| `npm install` (raíz) | OK (exit 0). |
| `npm run typecheck --workspace=axos-os-backend` | **OK — 0 errores** (`tsc --noEmit`). |
| `npm run lint --workspace=web` | **OK — 0 errores, 81 warnings** (img/`<Image>`, react-hooks set-state-in-effect, tanstack memo). |
| `npm run build --workspace=web` | **OK** — build de producción completo. |
| `npm run test --workspace=axos-os-backend` | **OK — 153 suites / 1044 tests PASS** (17.4s). |
| Lint API | No ejecutado con `--fix` (modificaría archivos; REGLA #0). CI lo marca **no-bloqueante (~2.9k hallazgos de formato)**. |
| e2e Playwright / smoke bootstrap | No ejecutado (requiere Postgres/entorno; el smoke corre en CI). |

---

## 4. Multi-tenancy (P0)

### 4.1 El problema raíz: modelo de tenant fracturado (P0-TENANT-001)

Coexisten **tres** modelos en la misma base:

1. **`TenantBaseEntity`** (`apps/api/src/common/entities/tenant-base.entity.ts:10-36`): columnas snake `tenant_id`, `organization_id`, `plant_id`, `created_by`, soft-delete `deleted_at`. **73** entidades la extienden.
2. **Scope por building** (`TenantSubscriber`, `apps/api/src/common/database/tenant.subscriber.ts`): opera sobre propiedades **camelCase** `tenantId`/`buildingId`/`building` y `ctx.scopes.buildings/programs/lines`. **No** toca el `tenant_id` snake de `TenantBaseEntity`.
3. **Sin scope**: **51** entidades de negocio sin ninguna columna de tenant/org/building.

Consecuencias verificadas:
- **Lecturas no se filtran por tenant a nivel DB** (P0-TENANT-003). `TenantSubscriber.afterLoad` (`tenant.subscriber.ts:116-135`) **solo loguea** en debug; no filtra. No existe `beforeFind`. El helper `withTenantScope` (`tenant.subscriber.ts:176-213`) es **opt-in** y filtra por `buildingId`/`program`, no por `tenant_id`.
- **Las escrituras solo se validan** si el usuario tiene `scopes.buildings/programs/lines` Y la entidad declara `buildingId`/`building`/`tenantId` camel (`tenant.subscriber.ts:85-112`). Un admin o cualquier usuario sin scopes → **todas** las validaciones de escritura se saltan.
- El `beforeInsert` autollena `ent.tenantId` (camel) pero **nunca** el `tenant_id` (snake) de `TenantBaseEntity` → las entidades "migradas" no reciben tenant automáticamente.
- El front manda `X-Building-Id`/`X-Project-Id` (`apps/web/src/lib/apiFetch.ts:41-42`) pero el backend **los ignora** (`TenantInterceptor` lee solo `req.user`, `apps/api/src/common/tenant/tenant.interceptor.ts:16-27`). El cambio de "workspace" en la UI no cambia el scope server-side (P1-TENANT-010).

### 4.2 Inventario de entidades (resumen de las 199)

Se produjo la matriz completa entidad-por-entidad (199 filas). Resumen:

- **Total entities:** 199 (excluye 2 clases base abstractas).
- **Extienden `TenantBaseEntity`:** 73 → scoping snake presente (nullable, fase de migración).
- **Scoping camel (building/program/line/tenantId):** ~24 entidades (Plan, Kit→no, ProductionWip, NCR, CAPA, WorkOrderExecution, erp-journal-entry, cost-item, ledger-event, etc.).
- **GLOBAL-JUSTIFIED** (config/catálogo/infra intencionalmente global): 49 (roles, permissions, tenants, plant, sequences, enterprise topology, messaging infra, semantic, suppliers-catalog, etc.).
- **Business-critical SIN ninguna columna de scope: 51** ← riesgo máximo.

**Las 51 entidades de negocio sin scope (P0-TENANT-002)** — clusters financiero/inventario/producción que la doc llama críticos:

- **erp-core (16):** erp-invoice, erp-invoice-line, erp-journal-line, erp-material-valuation, erp-mrp-result, erp-mrp-run, erp-payment, erp-planned-order, erp-purchase-order, erp-purchase-order-line, erp-purchase-requisition, erp-sales-order, erp-sales-order-line, erp-supplier-price, erp-valuation-layer. (`apps/api/src/modules/erp-core/entities/*.entity.ts`)
- **inventory (5):** inventory-position, inventory-movement, replenishment-rule, warehouse-task, material-return. (`apps/api/src/modules/inventory/entities/*`)
- **mes-execution (7):** andon-call, execution-event, execution-step, execution-step-material, mes-downtime, station-assignment, station-incident. (`apps/api/src/modules/mes-execution/entities/*`)
- **quality (5):** disposition, final-inspection, iqc-inspection (solo `warehouseId`), quality-hold, quarantine-transfer. (`apps/api/src/modules/quality/entities/*`)
- **shipping (3):** shipment (legacy), shipment-item, packing-list. (`apps/api/src/modules/shipping/entities/*`)
- **bom (3):** bom-header, bom-item, bom-component. (`apps/api/src/modules/bom/entities/*`)
- **decision-intelligence (4):** plan-scenario, plan-publication, plan-actual-outcome, scenario-simulation-result. (`apps/api/src/modules/decision-intelligence/entities/*`)
- **kits/exceptions/material-requests (4):** kit, kit-material, kit-exception, material-request.
- **otros (4):** advance, bay-layout, cancellation-request, enterprise-plan-link, engineering-document (scope solo en JSONB embebido), scar, receiving-event, resupply. *(varios; ver matriz completa.)*

### 4.3 Queries/escrituras riesgosas (muestra verificada)

| Servicio | Método | `file:line` | Tipo | Filtro tenant | Riesgo | Sev |
|---|---|---|---|---|---|---|
| ShippingService | findAll | `shipping.service.ts:30-33` | `find()` (tiene `// TODO: Apply scope filtering`) | NINGUNO | lista todos los envíos de todos los tenants | **P0** |
| ShippingService | dispatch / addItem / startLoading | `shipping.service.ts:139-192 / 51-106 / 127-137` | `findOne(id)+save` | NINGUNO | despachar/editar envío de otro tenant | **P0** |
| MaintenanceService | updateOrder / transitionOrder / updateAsset | `maintenance.service.ts:197-244 / 126-137` | `findOne(id)+save` (no aplica `scope()`) | NINGUNO | completar/cancelar/editar OT de otro tenant | **P0** |
| DecisionIntelligenceService | getSiteOverview | `decision-intelligence.service.ts:500-574` | `find()` sobre 11 entidades | NINGUNO | snapshot agregado cross-tenant de toda la planta | **P0** |
| ProductionRuntimeService | (update kit) | `production-runtime.service.ts:59-63` | `kitRepo.update(kitId,…)` (user solo para audit) | NINGUNO | escritura cross-tenant | **P1** |
| KitsService | findOne | `kits.service.ts:108-117` (`// TODO: Verify organizational scope`) | `findOne(id)` | NINGUNO | lectura by-id cross-tenant | **P1** |
| SuppliersService | findAll/update/updateScar/removeAvlPart… | `suppliers.service.ts:47-578` | `find()/qb/findOne+save/delete` | NINGUNO (sin columna tenant) | lectura/escritura global de proveedores | **P1** |
| EngineeringService | findAll/findOne/update/remove | `engineering.service.ts:20-51` | `find()/findOne(id)` | NINGUNO (scope solo en JSONB, opt-in) | lectura/escritura cross-tenant de documentos | **P1** |
| PermissionsGuard | scope check | `permissions.guard.ts:67-101` | — | Solo si el cliente manda `buildingId/programId/line` | omitir el param → no hay chequeo de scope | **P1** |

Cobertura: se auditaron a fondo los módulos de mayor valor (shipping, maintenance, decision-intelligence, suppliers, engineering, messaging, ai, plans, kits, production-runtime, receiving). **Messaging** es el módulo bien aislado (todo by-id pasa por `assertMember`, `messaging.service.ts`). **AI** filtra por `tenantId` y ownership por email. No se cubrieron los 80 módulos exhaustivamente.

---

## 5. Conectividad frontend ↔ backend

La mayoría de las ~285 llamadas mapean limpio contra las 878 rutas backend (vía `apiFetch`/`useApi` contra `NEXT_PUBLIC_API_URL`). Hallazgos de rutas muertas / contrato:

| ID | Front `file:line` | Ruta llamada | Backend | Estado | Sev |
|---|---|---|---|---|---|
| **P1-ROUTE-001** | `intelligence/page.tsx:220-309` (+ `intelligence/editor`, `object/[key]`) | `fetch('/api/semantic/*')`, `/api/analytics/*`, `/api/autopilot/*` (mismo-origen) | Existen en backend (`@Controller('semantic'|'analytics'|'autopilot')` → `/api/...` en **origen del backend**) | **`next.config.ts` está vacío (sin rewrites)** y `middleware.ts:39-41` solo matchea `/dashboard/*`. No hay route handler. → En el origen de Next dan **404**. La pantalla de Intelligence carga pero sus datos fallan (a menos que un proxy externo mapee `/api`→backend). | **P1** |
| P1-ROUTE-002 | `useWebPush.ts:43,103,123` | `apiFetch('/api/notifications/push/*')` (mismo-origen; `apiFetch` no prepende base) | Existe en backend en `/api/notifications/push/*` (otro origen) | Probable 404 en origen Next → push no funciona. | P1 |
| P1-ROUTE-003 | `useCostRollup.ts:67`; `ThemeContext.tsx:160-168` | `${API_BASE_URL}/api/cost-rollup`; branding | Inconsistencia de convención de base URL: el resto usa `NEXT_PUBLIC_API_URL` que ya termina en `/api` → riesgo de `/api/api/...` o de prefijo faltante. | Verificar `API_BASE_URL` real. | P1 |
| **P2-ROUTE-004** | (n/a — backend) | `/api/api/plants`, `/api/api/roles`, `/api/api/seed/roles`, `/api/api/users/:userId/roles` | `@Controller('api/...')` + prefijo global `api` → **doble prefijo**. `roles.controller.ts:24`, `seed.controller.ts:13`, `user-roles.controller.ts`, `plants.controller.ts`. | El front nunca llama esos paths → controladores huérfanos/mal ruteados. | P2 |
| P2-ROUTE-005 | — | `/api/users` (UsersController) vs `/api/governance/users` (lo que usa el front, `settings/users/page.tsx`) | Superficies duplicadas de gestión de usuarios; la real va por governance + `/api/admin/*` (Next). `/api/users` queda como superficie paralela **sin guard** (ver P0-AUTH-001). | P2 (limpieza) |

---

## 6. Auth / RBAC / Security

### 6.1 Controladores totalmente públicos (sin `@UseGuards` en todo el archivo — verificado por diferencia de conjuntos)

| ID | Controller | Rutas | `file:line` | Riesgo | Sev |
|---|---|---|---|---|---|
| **P0-AUTH-001** | `UsersController` | POST/GET/GET:id/PUT:id/DELETE:id `/api/users` | `users.controller.ts:10-47`; `users.service.ts:15-23,88-99` | `POST` con `role/permissions/isActive` (mass-assignment, sin `ValidationPipe`) = **admin sin autenticar**; `PUT` promueve/resetea contraseña de cualquiera; `DELETE` borra cualquiera. | **P0** |
| **P0-AUTH-002** | `SuppliersController` | 23 rutas (POST/PATCH/DELETE incl.) | `suppliers.controller.ts` (sin `@UseGuards`) | Crear/editar proveedores, AVL, SCARs sin auth (`dto: any`). | **P0** |
| **P0-AUTH-003** | `CancellationRequestsController` | POST, PATCH `:id/respond` | `cancellation-requests.controller.ts:10,25` | Crear y **aprobar/rechazar** cancelaciones de WO sin auth. | **P0** |
| **P1-AUTH-004** | `VisualAidsController` | POST (upload 12MB), GET file, PATCH, DELETE | `visual-aids.controller.ts:32,59,64,69-83` | Upload sin auth; el `GET file` **quita `X-Frame-Options` y pone `frame-ancestors *`** (clickjacking). | P1 |
| **P1-AUTH-005** | `EventLedgerController` | GET `/api/ledger`, `/reference/:t/:id`, `/work-order/:wo` | `event-ledger.controller.ts:10,16,24` | Lectura sin auth de todo el ledger de actividad de negocio (cross-tenant). | P1 |

*(El sexto sin guard es `HealthController` — intencional.)*

### 6.2 Lecturas públicas en controladores parcialmente protegidos

| ID | Endpoint | `file:line` | Sev |
|---|---|---|---|
| P1-AUTH-006 | `GET /api/enterprise/*` (buildings/customers/programs/lines/stations/campus-state) — reads sin guard; writes con `JwtAuthGuard` a nivel handler | `enterprise-campus.controller.ts:25-63` | P1 |
| P1-AUTH-006b | `GET /api/process/routes` sin guard; writes con `JwtAuthGuard` handler | `process-routing.controller.ts:13` | P1 |

### 6.3 WebSocket

| ID | Gateway | Estado | `file:line` |
|---|---|---|---|
| **P0-AUTH-007** | `SignalGateway` (`/signals`) | **Sin auth.** `handleConnection` solo loguea; `join-tenant` une a `tenant:<cualquiera>` → recibe `signal:new-proposal` y `signal:critical-event`. CORS `origin:'*'`. | `signal.gateway.ts:54-72` |
| OK | `ChatGateway` (`/chat`) | Autenticado (`jwt.verify`, disconnect si inválido). | `chat.gateway.ts:101-109` |
| OK | `LiveGateway` (`/live`) | Autenticado (`jwt.verify`, tenant desde claim). | `live.gateway.ts:66-72` |

### 6.4 Sistémicos

| ID | Hallazgo | Evidencia | Sev |
|---|---|---|---|
| **P0-AUTH-010** | Cookie de sesión **falsificable**: `getSecret()` cae a `"axos-dev-secret-change-me-in-production"` si `AXOS_SESSION_SECRET` no está. Forjar sesión (cualquier email/rol) → middleware pasa, `/api/auth/me` confía, el bridge emite JWT de backend. Fail-**open** (a diferencia de JWT_SECRET/service-password). | `apps/web/src/lib/session.ts:19-24` | **P0** (condicional a env) |
| P1-AUTH-008 | ~50 controllers con `JwtAuthGuard` pero **sin `@RequirePermission`** (o `PermissionsGuard` sin permisos = no-op) → cualquier usuario autenticado (incl. auto-provisionado) puede mutar. Ej.: `POST /api/bom/import` (sobre-escribe BOMs en bulk), bay-layout, kit-materials, resupplies, advances, office, notifications, decision-intelligence, semantic, `tcode/execute`, `import-data/commit`. | `bom.controller.ts:38`, `import-data.controller.ts:54`, etc. | P1 |
| P1-AUTH-009 | **No hay `ValidationPipe` global** (`main.ts` no llama `useGlobalPipes`) → mass-assignment en DTOs laxos/`any`. Solo `forecast` define el suyo. | `main.ts`; `forecast.controller.ts:32` | P1 |
| P1-AUTH-011 | `POST /api/auth/sync` emite JWT activo con rol elegido por el cliente (`isAppRole`, hasta `executive`), gated **solo** por `FRONTEND_SHARED_KEY` (abierto si no está; `main.ts` además deja pasar cualquier request con `Authorization`). | `auth.service.ts:125-169`; `main.ts:316-339` | P1 |
| OK | `register` no permite auto-asignarse `admin` (status forzado `pending`); user-mgmt en governance/roles/user-roles/plants correctamente permission-gated; owner override por email. | `auth.service.ts:91-117`; `permissions.guard.ts:39-44` | — |

---

## 7. Production readiness

| ID | Área | Estado | Riesgo | `file:line` | Sev |
|---|---|---|---|---|---|
| **P0-PROD-001** | TypeORM `synchronize` | **ON por defecto en prod** (con `DATABASE_URL`). | Auto-sync de esquema en prod = drift/pérdida de datos. El propio CI lo llama peligroso. | `orm.options.ts:38-46`; `ci.yml:7-9` | **P0** |
| **P0-PROD-002** | Migraciones | `migrationsRun: !synchronize && …` → con synchronize ON, **nunca corren** las 80+ migraciones en prod. | El esquema real lo dicta el auto-sync de entities, no las migraciones (que quedan muertas). | `orm.options.ts:52` | **P0** |
| P1-PROD-003 | DB SSL | `rejectUnauthorized:false` en prod. | Acepta cualquier cert de DB (MITM). | `orm.options.ts:54-57` | P1 |
| P1-PROD-004 | CORS / cookie | CORS cae abierto si `originsToValidate` queda vacío (defaults lo cubren, pero `ALLOWED_ORIGIN` mal seteado → permisivo). Cookie `secure` solo si `NODE_ENV=production`. | Config-dependiente. | `main.ts:268-270`; `session.ts` | P1 |
| P2-PROD-005 | Lint API | No-bloqueante (~2.9k hallazgos de formato). | Deuda; no rompe. | `ci.yml:72-76` | P2 |
| OK | helmet, compression, health (`/api/health`), CI (build/test/lint/smoke vs Postgres efímero), persistencia de `JWT_SECRET` (`jwt-secret.ts`), `BACKEND_SERVICE_PASSWORD` fail-closed (`service-password.ts`). | — | — | — | — |

---

## 8. Cascarones / inconclusos

- **Hallazgo principal: prácticamente no hay cascarones.** Se revisaron a fondo 15 de 113 `page.tsx` (dashboard, production, planning, quality, crm, finance, admin, warehouse, operador, materials, bom, etc.) y **todas** consumen el backend (`useApi`/`apiFetch`/WebSocket) con formularios y mutaciones reales.
- Barrido de marcadores (`TODO|FIXME|coming soon|mock|placeholder|…`): 710 coincidencias en 210 archivos, **dominadas por** atributos `placeholder` de inputs, la suite *office*, y archivos `.spec` (baja señal). No revela features falsas.
- **P2-SHELL-001**: `/dashboard/settings/permissions` es una matriz RBAC **solo lectura** (sin edición) — `settings/permissions/page.tsx`. Por diseño, se nota.
- **Cascarón funcional por ruteo (no por mock)**: las páginas de `/dashboard/intelligence/*` renderizan pero sus datos fallan en runtime (ver **P1-ROUTE-001**).
- Caveat de cobertura: ~98 páginas no se leyeron a fondo; el patrón es consistente, confianza media-alta de que no hay cascarones mayores.

---

## 9. Build / lint / test

Ver §3 — **todo verde**. Clasificación:
- **P0/P1 de build:** ninguno.
- **P2:** web lint 81 warnings (`<img>` vs `<Image>`, `react-hooks/set-state-in-effect` en `SlidesEditor.tsx:2117`, `useWebPush.ts:79`, tanstack memo en `DataTable.tsx:186`); deuda de formato en API (~2.9k, no-bloqueante).

---

## 10. Contratos / Types / DTOs

`packages/contracts` hoy solo contiene tipos de *Readiness*. Duplicación relevante:

| ID | Contrato | Front | Back | ¿Divergen? | Sev |
|---|---|---|---|---|---|
| **P1-CONTRACT-001** | `ShipmentStatus` | `shipping/shipping.types.ts:10-15` (lower) + `reports/reports.types.ts:33-38` (UPPER) | `shipping/entities/shipment.entity.ts:3-9` (lower) **vs** `outbound/shipment-state.ts:11-16` (UPPER) | **Sí — dos definiciones backend en conflicto** | P1 |
| P1-CONTRACT-002 | `AppRole` (21 roles) | `settings/_lib/rbac.ts:19-41` | `auth/rbac.ts:9-31` | No (espejo a mano; comentario dice "mantener en sync") | P1 |
| P1-CONTRACT-003 | `UserRole` | `lib/store.ts:7` (string) | `users/entities/user.entity.ts:11-20` (enum 8 roles) | Sí (front sin type safety) | P1 |
| P2-CONTRACT-004 | `PlanStatus`, `KitStatus`, NCR/Quality enums | varios `*.types.ts` o ausente | entities respectivas | parcial | P2 |

Recomendación: mover enums compartidos a `packages/contracts` (refactor documentado, **no** ejecutado ahora).

---

## 11. Backlog priorizado

| ID | Prioridad | Hallazgo | Impacto | Esfuerzo | ¿Fix chico? | PR sugerido / acción |
|---|---|---|---|---|---|---|
| P0-AUTH-001 | P0 | `UsersController` público + mass-assignment | Toma de control total anónima | S | Sí* (toca auth) | PR-1 (DRAFT): guards en UsersController |
| P0-AUTH-003 | P0 | Cancellation-requests público | Bypass de aprobaciones | S | Sí* | PR-1 |
| P0-AUTH-002 | P0 | Suppliers público | Integridad supply chain | S | Sí* | PR-1 |
| P1-AUTH-004 | P1 | Visual-aids público (upload/serve, XFO) | Upload anónimo/clickjacking | S | Sí* | PR-1 |
| P1-AUTH-005 | P1 | Event-ledger público | Fuga de actividad de negocio | S | Sí* | PR-1 |
| P0-AUTH-007 | P0 | SignalGateway WS sin auth | Fuga cross-tenant en vivo | M | Parcial* | PR-2 (DRAFT): auth en handleConnection |
| P0-AUTH-010 | P0 | Secreto de sesión fail-open | Forjar sesión admin | S | Sí* | PR-3 (DRAFT): exigir `AXOS_SESSION_SECRET` |
| P1-AUTH-009 | P1 | Sin `ValidationPipe` global | Mass-assignment generalizado | M | Parcial* | Documentado (riesgo de romper DTOs laxos) |
| P0-PROD-001/002 | P0 | `synchronize` ON + migraciones muertas | Drift/pérdida de datos en prod | M | No (infra/decisión) | Documentado |
| P0-TENANT-001..006 | P0 | Modelo de tenant fracturado; 51 entidades sin scope; lecturas no filtradas | Fuga cross-tenant | XL | No (proyecto) | Documentado (decisión de producto/arquitectura) |
| P1-ROUTE-001 | P1 | Intelligence llama `/api/*` mismo-origen sin proxy | Pantalla rota en runtime | S–M | Sí | PR-4 (DRAFT): usar `apiFetch`+base, o rewrite Next |
| P2-ROUTE-004 | P2 | Doble prefijo `/api/api/*` | Controllers huérfanos | S | Sí | Documentado |
| P1-CONTRACT-001 | P1 | `ShipmentStatus` en conflicto | Bugs de estado de envío | M | No | Documentado |
| P2-* | P2 | Lint warnings, settings/permissions read-only, contratos duplicados | Deuda | — | — | Documentado |

`*` = "fix chico" pero **toca auth** → por REGLA #0 se documenta y se ofrece como PR DRAFT a confirmar, no se aplica automáticamente.

---

## 12. PRs DRAFT candidatos (a confirmar — NO aplicados)

Todos chicos, aditivos, ≤5 archivos. **Ninguno fue implementado** porque tocan `auth` (REGLA #0: documentar, no ejecutar sin decisión). Se listan para que el owner elija.

- **PR-1 — Cerrar controladores públicos.** Agregar `@UseGuards(JwtAuthGuard, PermissionsGuard)` (+ `@RequirePermission` apropiado) a `UsersController`, `SuppliersController`, `CancellationRequestsController`, `VisualAidsController`, `EventLedgerController`. Riesgo: si algún flujo legítimo dependía de que fueran públicos (p.ej. `/api/users` usado por seed), hay que validar; el front real usa `/api/governance/users`, así que el riesgo es bajo. Build/test/lint antes de push.
- **PR-2 — Autenticar `SignalGateway`.** Replicar el patrón de `chat`/`live` (`jwt.verify` en `handleConnection`, derivar tenant del claim, ignorar `join-tenant` con tenant arbitrario). 1 archivo.
- **PR-3 — `AXOS_SESSION_SECRET` fail-closed en prod.** Reemplazar el fallback hardcodeado por error fatal en prod (espejo de `service-password.ts`). 1 archivo + test.
- **PR-4 — Arreglar rutas muertas de Intelligence/push.** Cambiar `fetch('/api/semantic|analytics|autopilot|notifications/push/*')` a `apiFetch` contra `NEXT_PUBLIC_API_URL` (como el resto), o agregar `rewrites()` en `next.config.ts`. 3–4 archivos front.

**No-PR (documentar, decisión humana):** P0-TENANT-* (estrategia de tenancy — proyecto), P0-PROD-001/002 (`synchronize`/migraciones — infra), P1-AUTH-009 (ValidationPipe global — puede romper DTOs `any`), P1-CONTRACT-001 (resolver `ShipmentStatus` canónico).

---

## 13. Pendiente para decisión humana

1. **Estrategia de tenancy** (P0-TENANT): ¿row-level `tenant_id` desde JWT (como dice la doc) o scope por building (como hace el subscriber)? Unificar a uno. Es un proyecto, no un PR.
2. **`synchronize: false` en prod + correr migraciones** (P0-PROD): requiere snapshot/migración de baseline y validación contra la DB real.
3. **Confirmar qué PRs DRAFT (1–4) abrir** dado que tocan auth.
4. **`ValidationPipe` global con `whitelist`**: alto valor anti-mass-assignment, pero hay que revisar DTOs `any` que hoy dependen de pasar campos extra.

---

## Criterios de DONE — estado

- [x] `docs/AUDIT-REPORT.md` con hallazgos y `file:line`.
- [x] Backlog priorizado P0/P1/P2.
- [x] P0 chicos: explicados y propuestos como PR DRAFT (no aplicados por tocar auth — REGLA #0).
- [x] Sin cambios a `main`. Sin refactors masivos. Sin features nuevas.
- [x] Comandos ejecutados documentados con resultado (§3).
- [x] Pendientes para decisión humana (§13).
