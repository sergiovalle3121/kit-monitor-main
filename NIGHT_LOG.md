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

<!-- Próximas entradas arriba de esta línea, orden cronológico inverso por bloque -->
