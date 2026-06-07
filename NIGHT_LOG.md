# AXOS OS — Night Log

Bitácora cronológica del trabajo autónomo. Entrada por ítem: timestamp, área,
archivos, decisiones, endpoints/pantallas, KPIs, siguiente paso / bloqueos.

> **Modo de trabajo de esta sesión:** todo el desarrollo ocurre en la rama
> `claude/pensive-wright-cbkuE` (rama designada por el entorno). NO se hace
> auto-merge a `main`/producción sin revisión: cada bloque queda commiteado y
> pusheado a la rama para que el equipo lo revise y mergee. Ver `DECISIONS.md §1`.

---

## 2026-06-07

### [setup] Baseline verde + arranque de plataforma (P0.1)
- **Estado inicial verificado:** monorepo Turborepo con 37 módulos en
  `apps/api/src/modules` y app Next.js en `apps/web`. Infra de multi-tenencia
  (TenantBaseEntity, TenantContextService, TenantSubscriber, TenantInterceptor)
  ya presente. `apps/api` compila limpio (`npm run build`).
- **Fix de baseline (`fix(governance)`):** los smoke tests
  `governance.controller.spec.ts` y `governance.service.spec.ts` eran stubs del
  CLI de Nest sin dependencias inyectadas → fallaban por DI. Reparados con
  mocks de proveedores y override de guards. Suite de API ahora **verde**:
  5 suites / 14 tests.
- **Archivos:** `apps/api/src/modules/governance/governance.{service,controller}.spec.ts`
- **Tracking creado:** `NIGHT_LOG.md`, `DECISIONS.md`, `THIRD_PARTY_NOTICES.md`.

### [numbering] Capacidad transversal de folios (T2 / P0.8) — FUNCIONAL
- **Qué:** servicio central `DocumentNumberingService` + tabla nueva
  `document_sequences` (extiende `TenantBaseEntity`, scope tenant+planta). Antes
  la numeración era ad-hoc por módulo (p.ej. `plans` consultaba todas las WO para
  sacar el máximo). Ahora cualquier módulo pide su folio: `allocate('PURCHASE_ORDER')`.
- **Lógica real (no CRUD vacío):** formato por tokens (`{PREFIX} {YYYY} {YY} {MM}
  {DD} {SEQ}`), relleno configurable, política de reinicio NUNCA/ANUAL/MENSUAL con
  `periodKey`, asignación atómica en transacción (lock pesimista en Postgres),
  reserva de bloques contiguos, alta perezosa desde un registro de defaults EMS
  (WO, PO, SO, NCR, CAPA, ASN, RFQ…), y guardia anti-reúso (no se mueve el
  contador hacia atrás). Eventos de config al Event Ledger (dominio SYSTEM).
- **Backend:** `apps/api/src/modules/numbering/` (entity, dto, format, defaults,
  service, controller, module) + `migrations/20260607120000-CreateDocumentSequences.ts`
  (aditiva, idempotente) + registro en `app.module.ts`.
- **Endpoints:** `GET /numbering/sequences`, `GET /numbering/kpis`,
  `GET /numbering/sequences/:docType`, `GET /numbering/sequences/:docType/preview`,
  `POST /numbering/sequences`, `PATCH /numbering/sequences/:id`,
  `POST /numbering/allocate` (Swagger `Numbering`, guard JWT + `MANAGE_MASTER_DATA`
  en mutaciones).
- **Frontend:** `dashboard/admin/numbering` — KPIs, lista con vista previa de
  folio en vivo, alta/edición (prefijo, patrón, relleno, reinicio, contador),
  activar/desactivar; estados loading/empty/forbidden + toasts. Enlace en el
  buscador Cmd-K (`SearchPalette`).
- **KPIs:** tipos de documento (activos), folios emitidos (total y del periodo),
  tipo más usado.
- **Tests:** `numbering.format.spec.ts` (formato/reset/validación) +
  `document-numbering.service.spec.ts` (flujo crítico contra SQLite en memoria:
  alta perezosa, incremento, bloques contiguos, preview sin consumo, KPIs,
  guardia anti-reúso). Suite API: **7 suites / 35 tests verdes**. Build API limpio.
  Web: typecheck + lint limpios.
- **Pendiente/siguiente:** integrar `allocate()` en los módulos que hoy numeran a
  mano (plans/WO, kits, NCR, receiving, shipping) — cambio incremental por módulo.

### [improvement] Mejora Continua / OpEx — Kaizen (P2.13) — FUNCIONAL
- **Qué:** módulo nuevo, 100% aditivo, autocontenido, que además ESTRENA el
  servicio de numeración (`allocate('IMPROVEMENT')` → folios `CI-2026-00001`).
- **Backend** (`apps/api/src/modules/improvement/`): entidad
  `ImprovementInitiative` (extiende `TenantBaseEntity`, scope tenant+planta,
  `program_id` de primera clase), máquina de estados pura
  (DRAFT→IN_PROGRESS→IMPLEMENTED→VERIFIED→CLOSED, + rework y CANCELLED), servicio
  con captura de ahorros (estimado vs realizado, multimoneda), KPIs de OpEx, y
  eventos al Event Ledger. Controller REST (Swagger `Improvement`).
- **Endpoints:** `GET /improvement` (filtros status/methodology/area/programId),
  `GET /improvement/kpis`, `GET /improvement/:id`, `POST /improvement`,
  `PATCH /improvement/:id`, `POST /improvement/:id/transition`.
- **Migración:** `20260607130000-CreateImprovementInitiatives` (aditiva,
  idempotente). Registrado en `app.module.ts`. Añadido docType `IMPROVEMENT`
  (prefijo `CI`) a los defaults de numeración.
- **Frontend** (`dashboard/improvement`): tablero por estado, KPIs (iniciativas,
  en progreso, implementadas+, ahorro realizado vs estimado), alta de iniciativa,
  y botones de transición que respetan la máquina de estados. Enlace Cmd-K.
- **KPIs:** total, por fase, en progreso, implementadas+, ahorro estimado y
  realizado (formato moneda).
- **Tests:** `initiative-state.spec.ts` (máquina de estados) +
  `improvement.service.spec.ts` (flujo crítico en SQLite: folio CI, ciclo de
  vida con timestamps, transición ilegal rechazada, KPIs de ahorro). API:
  **9 suites / 45 tests verdes**. Build API limpio. Web typecheck + lint limpios.
- **Decisión:** la captura de ideas (POST/PATCH/transition) está abierta a
  cualquier usuario autenticado (sistema de ideas/Kaizen es participativo);
  admin omite scope. Ver `DECISIONS.md §4`.

### [ehs] EHS / Seguridad y Medio Ambiente (P2.10) — FUNCIONAL
- **Qué:** módulo nuevo, 100% aditivo, autocontenido; consume numeración
  (`allocate('EHS_INCIDENT')` → `INC-2026-00001`).
- **Backend** (`apps/api/src/modules/ehs/`): entidad `SafetyIncident` (extiende
  `TenantBaseEntity`, scope tenant+planta, `program_id`), máquina de estados pura
  (REPORTED→INVESTIGATING→ACTION_PENDING→CLOSED, + cierre rápido, rework,
  CANCELLED), servicio con tipos (near-miss/first-aid/recordable/lost-time/
  environmental/property), severidad, causa raíz, acción correctiva, días
  perdidos, y KPIs de seguridad. Controller REST (Swagger `EHS`). Reporte abierto
  a usuarios autenticados (reportar debe ser sin fricción).
- **Endpoints:** `GET /ehs/incidents` (filtros), `GET /ehs/kpis`,
  `GET /ehs/incidents/:id`, `POST /ehs/incidents`, `PATCH /ehs/incidents/:id`,
  `POST /ehs/incidents/:id/transition`.
- **Migración:** `20260607140000-CreateSafetyIncidents` (aditiva, idempotente).
  Registrado en `app.module.ts`. Añadido docType `EHS_INCIDENT` (prefijo `INC`).
- **Frontend** (`dashboard/ehs`): KPI estrella "días sin registrable", incidentes
  abiertos, registrables (con tiempo perdido), días perdidos; reporte de
  incidente, lista por estado con chips de tipo/severidad y transiciones que
  respetan la máquina de estados (captura causa raíz / acción / días perdidos por
  prompt). Enlace Cmd-K.
- **KPIs:** total, abiertos, registrables, tiempo perdido, casi-accidentes, días
  perdidos, **días desde el último registrable**.
- **Tests:** `incident-state.spec.ts` + `ehs.service.spec.ts` (SQLite: folio INC,
  ciclo de investigación con timestamps, transición ilegal, KPIs incl. días sin
  registrable). API: **11 suites / 56 tests verdes**. Build limpio. Web tsc+lint
  limpios.

<!-- Próximas entradas arriba de esta línea, orden cronológico inverso por bloque -->

---

## ▶ RETOMAR AQUÍ (handoff para la próxima sesión)

- **Último ítem terminado:** `feat(ehs)` — EHS / Seguridad y Medio Ambiente
  (P2.10), mergeado a `main` vía PR (squash). `main` verde.
- **Estado de plataforma:** baseline verde; en producción: **numeración de
  folios** (T2), **Mejora Continua** (P2.13) y **EHS** (P2.10). API: 11 suites /
  56 tests. Migraciones solo aditivas. `synchronize:true` en prod materializa las
  tablas nuevas desde las entidades (las migraciones son artefacto/red de
  seguridad e idempotentes).
- **Siguiente ítem exacto a hacer:** **Mantenimiento / TPM (CMMS) (P2.7)** como
  rebanada vertical aditiva — entidades `Asset` (equipo: código, ubicación,
  criticidad, estado) y `MaintenanceOrder` (folio vía `allocate('MAINTENANCE_
  ORDER')` → `MO-…`; tipo PREVENTIVE/CORRECTIVE/PREDICTIVE; máquina de estados
  OPEN→IN_PROGRESS→COMPLETED + CANCELLED; ligable a un activo y a un paro de MES
  futuro). KPIs: órdenes abiertas, % PM cumplido, órdenes vencidas, MTTR rough
  (de created→completed). Pantalla `dashboard/maintenance` + enlace Cmd-K. Tests
  de máquina de estados + servicio en SQLite. `MAINTENANCE_ORDER` (prefijo `MO`)
  YA existe en `numbering.defaults.ts`; añadir `ASSET` (prefijo `EQ`) si se
  numera el activo. Patrón a copiar: el módulo `ehs` (el más reciente y limpio).
- **Cómo construir (receta probada):** entity → state machine (puro) + spec →
  dto → service (scope tenant+plant; usa `DocumentNumberingService`) → controller
  (`@UseGuards(JwtAuthGuard, PermissionsGuard)`) → module → migración aditiva
  idempotente → registrar en `app.module.ts` → `npx tsc --noEmit` + `npx jest
  src/modules/<x>` → build → frontend page (mirar `improvement/page.tsx`) +
  entrada en `SearchPalette.tsx` → web tsc + eslint → commit/push → PR → merge.
- **Notas/trampas:** fechas en entidades usar `DATE_COLUMN_TYPE` (no `timestamp`,
  rompe SQLite). Tipos en firmas decoradas → `import type`. Dinero → `float`.
  Rutas frontend sin prefijo `/api` (lo añade `NEXT_PUBLIC_API_URL`).
- **Pendiente transversal (cuando haya tiempo):** cablear `allocate()` en módulos
  que numeran a mano (WO/plans, kits, NCR, receiving, shipping) — cambio
  incremental por módulo, cuidando no romper parsers de folios existentes en prod.
