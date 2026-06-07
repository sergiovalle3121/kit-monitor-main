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

### [maintenance] Mantenimiento / TPM (CMMS) (P2.7) — FUNCIONAL
- **Backend** (`apps/api/src/modules/maintenance/`): `Asset` + `MaintenanceOrder`
  (folio `MO-` vía numeración; máquina de estados OPEN→IN_PROGRESS→COMPLETED +
  reopen + CANCELLED), KPIs CMMS (abiertas, vencidas, %PM cumplido, MTTR, downtime
  total, activos parados). Controller `maintenance` (assets + orders). Migración
  aditiva (2 tablas). docType `ASSET` (prefijo `EQ`) añadido.
- **Frontend** (`dashboard/maintenance`): KPIs, tira de activos con alta rápida,
  alta de orden (con selección de activo), tablero por estado con transiciones.
  Enlace Cmd-K.
- **Tests:** `order-state.spec` + `maintenance.service.spec` (SQLite). 

### [hotfix] 🔴→🟢 Prod caída: PermissionsGuard no resolvía AuditService
- **Causa:** los módulos nuevos usaban `@UseGuards(PermissionsGuard)` pero el guard
  inyecta `AuditService` (solo exportado por `GovernanceModule`), que esos módulos
  no importaban → crash al bootstrap. `tsc`/unit tests NO lo detectan.
- **Arreglo sistémico:** `common/security/security.module.ts` `@Global()` que
  provee+exporta `PermissionsGuard` y re-exporta `GovernanceModule`; importado una
  vez en `AppModule`. Ahora cualquier controller usa el guard sin imports extra.
  (Ver `DECISIONS.md §5`.)
- **NUEVA PUERTA DE CALIDAD (obligatoria):** smoke de bootstrap COMPILADO contra
  Postgres: `apps/api/scripts/bootstrap-smoke.js` (`npm run smoke:bootstrap`).
  Hace `NestFactory.create + app.init()` sobre `dist/` → resuelve proveedores y
  guards; atrapa exactamente este fallo. NO se usó test Jest porque `ts-jest`
  (`isolatedModules`) no emite la metadata de decoradores igual que `tsc` y da
  fallos falsos (`MaterialRequest.status` → "Object"). (Ver `DECISIONS.md §6`.)
- **Verificado:** `dist/main.js` arranca limpio contra Postgres local
  ("Nest application successfully started", login self-check OK) y
  `npm run smoke:bootstrap` → OK. Build + 66 unit tests + web tsc/lint verdes.

### [legal] Legal / Compliance / Contratos (P2.14) — FUNCIONAL
- **Backend** (`apps/api/src/modules/legal/`): `Contract` (folio `CON-` vía
  numeración; máquina de estados DRAFT→ACTIVE→EXPIRED↔ACTIVE(renovación)→
  TERMINATED + CANCELLED), tipo (CUSTOMER/SUPPLIER/NDA/LEASE/SERVICE), valor +
  moneda, fechas, auto-renovación, notas. KPIs: activos, por vencer (30/60/90d),
  vencidos, valor activo. Controller `legal`. Migración aditiva. docType
  `CONTRACT` (prefijo `CON`).
- **Frontend** (`dashboard/legal`): KPIs (activos, por vencer 90d, vencidos, valor
  activo), alta de contrato, lista por estado con badge "vence en Nd" y
  transiciones (incl. renovación con nueva fecha). Enlace Cmd-K.
- **Tests:** `contract-state.spec` + `legal.service.spec` (SQLite). Gate completo
  verde: build, 15 suites / 77 tests, web tsc+lint, **bootstrap smoke (Postgres)**.

### [testing] Test Engineering / Yields (P2.8) — FUNCIONAL
- **Backend** (`apps/api/src/modules/testing/`): `TestRecord` inmutable (serie,
  estación ICT/FCT/AOI/FINAL, PASS/FAIL, código de falla, modelo, operador; folio
  `TST-` vía numeración). Sin máquina de estados (registro inmutable). Servicio con
  KPIs: **First-Pass Yield** (primer test por serie), yield total, Pareto de
  códigos de falla (top 10), series distintas. Evento al Event Ledger (QUALITY).
  Controller `testing` (records + recent + kpis). Migración aditiva. docType
  `TEST_RECORD` (prefijo `TST`, reinicio mensual).
- **Frontend** (`dashboard/test-engineering`): captura scanner-friendly (Enter
  para capturar, autofocus en SN), KPIs (FPY, yield, pruebas, fallas), **Pareto**
  de fallas (barras), capturas recientes. Enlace Cmd-K.
- **Tests:** `testing.service.spec` (SQLite): folio, forzar/limpiar failureCode,
  cálculo de yield + FPY + Pareto. Gate completo verde: build, **17 suites /
  80 tests**, web tsc+lint, **bootstrap smoke (Postgres)**.

### [procurement] Compras / Procurement — Órdenes de Compra (P2.4) — FUNCIONAL
- **Backend** (`apps/api/src/modules/procurement/`): `PurchaseOrder` (folio `PO-`
  vía numeración; proveedor denormalizado — NO acoplado a `suppliers`; máquina de
  estados DRAFT→ISSUED→ACKNOWLEDGED→RECEIVED→CLOSED + CANCELLED; fechas
  requerida/prometida/recibida para OTD). KPIs: abiertas, por recibir, vencidas,
  OTD proveedor, valor comprometido. Controller `procurement`. Migración aditiva.
  Evento al Event Ledger (MATERIALS). `PURCHASE_ORDER` ya existía en defaults.
- **Frontend** (`dashboard/procurement`): KPIs, alta de PO, tablero por estado con
  badge "vencida" y transiciones (captura fecha prometida al confirmar). Cmd-K.
- **Tests:** `po-state.spec` + `procurement.service.spec` (SQLite). Gate completo
  verde: build, **19 suites / 90 tests**, web tsc+lint, **bootstrap smoke (PG)**.

### [people] RH / Capital Humano — Skills & Certificaciones (P2.9) — FUNCIONAL
- **Backend** (`apps/api/src/modules/people/`): `Certification` (empleado
  denormalizado — NO acoplado a `users`; skill, área, estación, fechas; folio
  `CERT-`). Estatus **derivado** por fecha (VALID/EXPIRING/EXPIRED/NO_EXPIRY) vía
  helper puro `cert-status.ts`. KPIs: vigentes, por vencer 30/60/90d, vencidas,
  empleados, skills, cobertura por skill. Controller `people`. Migración aditiva.
  docType `CERTIFICATION` (prefijo `CERT`).
- **Frontend** (`dashboard/skills`): KPIs, alta/registro de certificación,
  cobertura por skill (chips), lista con badge de estatus y botón "Recertificar"
  (recaptura fecha de expiración). Enlace Cmd-K.
- **Tests:** `cert-status.spec` (helper puro) + `people.service.spec` (SQLite).
  Gate completo verde: build, **21 suites / 98 tests**, web tsc+lint, **bootstrap
  smoke (PG)**.

### [control-tower] Torre de Control / Cockpit ejecutivo (P3.1/P3.2) — FUNCIONAL
- **Qué:** capstone aditivo SIN tablas propias. `ControlTowerModule` importa las 8
  áreas y `ControlTowerService` inyecta sus servicios, llamando `.kpis()` en
  paralelo (`Promise.all`, defensivo: un área que falle no rompe la vista) y
  deriva un **semáforo** (green/amber/red) por área + estado global (worst-of).
- **Backend** (`apps/api/src/modules/control-tower/`): service + controller
  `GET /control-tower/summary`. Sin entidad, sin migración. Reglas de salud:
  EHS (registrables→rojo), Compras (vencidas→rojo, por recibir→ámbar),
  Mantenimiento (vencidas→rojo), Test (FPY<90→rojo, <97→ámbar), Legal/RH
  (vencidos→rojo, por vencer→ámbar).
- **Frontend** (`dashboard/control-tower`): banner de estado global + tarjetas por
  área con semáforo, headline y 3 métricas, enlazadas a cada área. Refresh. Cmd-K.
- **Tests:** `control-tower.service.spec` (mocks): agregación, bubble-up a rojo,
  resiliencia ante área que falla. Gate completo verde: build, **22 suites /
  101 tests**, web tsc+lint, **bootstrap smoke (PG)** — clave aquí por las 7
  inyecciones cross-módulo.

### [outbound] Logística / Embarque (P2.6) — FUNCIONAL
- **Backend** (`apps/api/src/modules/outbound/`): `Shipment` (tabla
  **`outbound_shipments`** — renombrada para no chocar con la tabla `shipments`
  legacy; cliente/destino denormalizados, incoterm, carrier, tracking, bultos;
  máquina de estados PACKING→READY→SHIPPED→DELIVERED + CANCELLED; **genera ASN**
  (folio `ASN-`) al embarcar). Folio `SHP-` al crear. KPIs: por embarcar, en
  tránsito, vencidas, **OTD a cliente**. Controller `outbound`. Migración aditiva.
  Event Ledger (SHIPPING).
- **Frontend** (`dashboard/outbound`): KPIs, alta de embarque, tablero por estado
  con badges (ASN, vencida) y transiciones (captura tracking al embarcar). Cmd-K.
- **Tests:** `shipment-state.spec` + `outbound.service.spec` (SQLite).
- **⚠️ El smoke de bootstrap atrapó una colisión real de tabla** (`shipments` ya
  existía en el módulo `shipping` legacy con PK integer + FK `shipment_items`).
  Renombrada a `outbound_shipments`. Ver `DECISIONS.md §8`. Gate final verde:
  build, **23 suites / 110 tests**, web tsc+lint, **bootstrap smoke (PG)**.

### [inbound] Recibo / Inbound + IQC (P2.5) — FUNCIONAL
- **Backend** (`apps/api/src/modules/inbound/`): `Receipt` (tabla
  **`inbound_receipts`** prefijada; proveedor/PO denormalizados, parte, cantidad,
  UOM, lote/serie/date-code; flujo IQC RECEIVED→INSPECTING→RELEASED|QUARANTINE,
  QUARANTINE→RELEASED|REJECTED; resultado IQC PASS/FAIL, código de rechazo). Folio
  `RCV-`. KPIs: **dock-to-stock** (h), **% rechazo en recibo**, pendientes IQC, en
  cuarentena. Controller `inbound`. Migración aditiva. Event Ledger (MATERIALS).
- **Frontend** (`dashboard/inbound`): captura scanner-friendly (Enter para
  recibir, autofocus en parte), KPIs, cola por estado con transiciones IQC
  (pasa/cuarentena/rechazo con código). Enlace Cmd-K.
- **Tests:** `receipt-state.spec` + `inbound.service.spec` (SQLite). Gate completo
  verde: build, **25 suites / 121 tests**, web tsc+lint, **bootstrap smoke (PG)**.

### [cycle-counts] Conteos Cíclicos (P2.3) — FUNCIONAL
- **Backend** (`apps/api/src/modules/cycle-counts/`): `CycleCount` (folio `CC-`;
  parte, ubicación, cantidad sistema vs contada, **varianza derivada**; máquina de
  estados OPEN→COUNTED→RECONCILED|ADJUSTED + CANCELLED; `count` calcula varianza y
  pasa a COUNTED; ADJUSTED sincroniza sistema=contado y varianza=0). KPIs:
  **exactitud de inventario** (% conteos sin varianza), abiertos, con varianza,
  varianza absoluta total, ajustes. Controller `cycle-counts`. Migración aditiva.
  Event Ledger (MATERIALS) con `transaction.quantity`.
- **Frontend** (`dashboard/cycle-counts`): KPIs, alta de conteo, captura inline de
  cantidad contada (Enter), badges de varianza/exacto, botones Conciliar/Ajustar.
  Enlace Cmd-K.
- **Tests:** `count-state.spec` + `cycle-counts.service.spec` (SQLite, incl.
  varianza, ajuste, exactitud). Gate completo verde: build, **27 suites /
  131 tests**, web tsc+lint, **bootstrap smoke (PG)**.

### [crm] CRM / Oportunidades (P1.1 SD-CRM) — FUNCIONAL
- **Backend** (`apps/api/src/modules/crm/`): `Opportunity` (tabla
  `crm_opportunities`; cliente/contacto denormalizados, valor estimado + moneda,
  probabilidad %, máquina de estados LEAD→QUALIFIED→PROPOSAL→WON|LOST con
  probabilidad por etapa). Folio `OPP-` (docType añadido a defaults). KPIs:
  **pipeline** (valor abierto), **ponderado** (valor×prob), valor ganado,
  **win-rate**, por etapa. Controller `crm`. Migración aditiva. Event Ledger.
- **Frontend** (`dashboard/crm`): pipeline por etapa con subtotal de valor, KPIs,
  alta de oportunidad, transiciones. Enlace Cmd-K.
- **Tests:** `opportunity-state.spec` + `crm.service.spec` (SQLite, incl. pipeline/
  ponderado/win-rate). Gate completo verde: build, **29 suites / 141 tests**, web
  tsc+lint, **bootstrap smoke (PG)**.

### [fixed-assets] Activos Fijos / Depreciación (P1.1 FIN) — FUNCIONAL
- **Backend** (`apps/api/src/modules/fixed-assets/`): `FixedAsset` (folio `FA-`;
  costo, rescate, vida útil meses, fecha adquisición; estado IN_SERVICE→DISPOSED).
  **Helper puro `depreciation.ts`** (línea recta: dep mensual, acumulada capada,
  valor en libros) + spec. Servicio serializa con campos derivados; baja pone
  valor en libros 0 y bloquea re-baja. KPIs: **valor en libros total**, costo,
  depreciación acumulada, en servicio. Controller `fixed-assets`. Migración
  aditiva. docType `FIXED_ASSET` (prefijo `FA`).
- **Frontend** (`dashboard/fixed-assets`): KPIs, capitalización, lista con barra
  de % depreciado, valor en libros y acción de baja. Enlace Cmd-K.
- **Tests:** `depreciation.spec` (helper puro) + `fixed-assets.service.spec`
  (SQLite). Gate completo verde: build, **31 suites / 149 tests**, web tsc+lint,
  **bootstrap smoke (PG)**.

### [expenses] Gastos / Viáticos (FIN-AP) — FUNCIONAL
- **Backend** (`apps/api/src/modules/expenses/`): `ExpenseReport` (folio `EXP-`;
  empleado denormalizado, categoría, monto + moneda; máquina de estados
  DRAFT→SUBMITTED→APPROVED|REJECTED→REIMBURSED, REJECTED→DRAFT resubmit,
  DRAFT→CANCELLED). KPIs: pendientes de aprobación, aprobados sin pagar (+monto),
  reembolsado, monto promedio. Controller `expenses`. Migración aditiva. docType
  `EXPENSE` (prefijo `EXP`). Event Ledger.
- **Frontend** (`dashboard/expenses`): KPIs, alta de gasto, tablero por estado con
  transiciones (enviar/aprobar/rechazar con motivo/reembolsar). Enlace Cmd-K.
- **Tests:** `expense-state.spec` + `expenses.service.spec` (SQLite). Gate completo
  verde: build, **33 suites / 159 tests**, web tsc+lint, **bootstrap smoke (PG)**.

### [tooling] Tooling / Herramentales (NPI) — FUNCIONAL
- **Backend** (`apps/api/src/modules/tooling/`): `Tool` (tabla `tooling_assets`;
  tipo MOLD/FIXTURE/STENCIL/GAUGE, cavidades, vida en disparos, disparos usados,
  estado AVAILABLE/IN_USE/MAINTENANCE/RETIRED). **Helper puro `tool-life.ts`**
  (%vida, disparos restantes, near-EOL ≥80%) + spec. Endpoints: registrar uso
  (suma disparos) y cambiar estado. KPIs: activos, **vida consumida promedio**,
  próximos a EOL, en mantenimiento. Controller `tooling`. Migración aditiva.
  docType `TOOL` (prefijo `TL`). Event Ledger (ENGINEERING).
- **Frontend** (`dashboard/tooling`): KPIs, alta, lista con barra de %vida (roja
  si EOL), captura inline de disparos y selector de estado. Enlace Cmd-K.
- **Tests:** `tool-life.spec` (helper puro) + `tooling.service.spec` (SQLite).
  Gate completo verde: build, **35 suites / 167 tests**, web tsc+lint, **bootstrap
  smoke (PG)**.

<!-- Próximas entradas arriba de esta línea, orden cronológico inverso por bloque -->

---

## ▶ RETOMAR AQUÍ (handoff para la próxima sesión)

- **Último ítem terminado:** `feat(tooling)` — Tooling / Herramentales (NPI),
  mergeado a `main` vía PR (squash). `main` verde.
- **Estado de plataforma:** en producción 16 entregas nuevas + hotfix:
  **numeración** (T2), **Mejora Continua** (P2.13), **EHS** (P2.10),
  **Mantenimiento/TPM** (P2.7), **Legal** (P2.14), **Test Engineering** (P2.8),
  **Compras** (P2.4), **RH/Skills** (P2.9), **Torre de Control** (P3.1/P3.2),
  **Logística/Embarque** (P2.6), **Recibo/Inbound+IQC** (P2.5), **Conteos
  Cíclicos** (P2.3), **CRM/Pipeline** (P1.1), **Activos Fijos** (P1.1 FIN),
  **Gastos/Viáticos** (FIN-AP), **Tooling/Herramentales** (NPI), más el
  **SecurityModule global** + **smoke de bootstrap**. API: 35 suites / 167 tests.
  Migraciones solo aditivas. Patrón por
  módulo: (state machine / derivación pura si aplica) + entity (TABLA PREFIJADA
  para no chocar con legacy) + dto + service (scope tenant+plant, usa numeración) +
  controller + module + migración aditiva + specs + página + Cmd-K.
- **PUERTAS DE CALIDAD ahora (obligatorio antes de cada merge):**
  1) `cd apps/api && npm run build`  2) `npm test` (unit)  3) `npm run lint`+`tsc`
  en web para archivos tocados  4) **`npm run smoke:bootstrap` con Postgres** —
  ver setup abajo. Si el smoke falla, NO mergear.
- **Setup del Postgres efímero para el smoke (el contenedor se resetea, repetir):**
  ```
  PGBIN=$(ls -d /usr/lib/postgresql/*/bin | head -1)
  rm -rf /tmp/pgdata && mkdir -p /tmp/pgdata && chown -R postgres /tmp/pgdata
  runuser -u postgres -- $PGBIN/initdb -D /tmp/pgdata --auth=trust -U postgres
  runuser -u postgres -- $PGBIN/pg_ctl -D /tmp/pgdata -o "-p 5433 -k /tmp" -l /tmp/pg.log start
  runuser -u postgres -- $PGBIN/createdb -h /tmp -p 5433 -U postgres axos_smoke
  # gate:
  cd apps/api && npm run build && DATABASE_URL="postgres://postgres@/axos_smoke?host=/tmp&port=5433" npm run smoke:bootstrap
  ```
- **Siguiente ítem exacto a hacer:** **Quejas de Cliente / RMA (P2.2 Calidad)**
  como módulo nuevo `rma` (100% aditivo, tabla `rma_cases` PREFIJADA). Entidad
  `RmaCase` (folio `RMA-` — añadir docType `RMA` prefijo `RMA`; cliente y parte
  denormalizados, número de serie, descripción de falla, severidad; máquina de
  estados OPEN→INVESTIGATING→DISPOSITION→CLOSED + CANCELLED; disposición
  REPAIR/REPLACE/CREDIT/REJECT). KPIs: abiertas, en investigación, tiempo de
  cierre promedio (días), por disposición. Pantalla `dashboard/rma` + Cmd-K. Tests
  máquina de estados + servicio (SQLite). Patrón a copiar: `ehs` (investigación).
- **Más backlog aditivo disponible (mismo patrón):** Auditorías por capas LPA
  (`audits`, folio `LPA-`); Calidad NCR/CAPA frontend (backend ya existe — SOLO
  UI); Portal de cliente (rol externo — RBAC); Acciones 8D (`eight-d`).
- **IMPORTANTE — puerta de bootstrap (obligatoria, atrapa colisiones de tabla):**
  levantar Postgres efímero (receta arriba) y `npm run smoke:bootstrap` ANTES de
  cada merge. El contenedor se resetea entre sesiones → re-crear el cluster. Y
  **prefijar SIEMPRE el nombre de tabla** de módulos nuevos (lección §8).
- **Hygiene recomendada (de-riesga el gate):** portar los 14 `jsonb` hardcodeados
  a `JSON_COLUMN_TYPE` y crear `ENUM_COLUMN_TYPE` (`'enum'` en PG / `'simple-enum'`
  en sqlite) para los 4 `type:'enum'`. Es **no-op en Postgres** y haría que el
  smoke corra en sqlite dentro de `npm test` (sin Postgres). NO cambiar tipos de
  columna de forma destructiva en prod (los helpers mantienen el mismo tipo en PG).
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
