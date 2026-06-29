# AXOS OS — Auditoría de Beta Readiness (funcional, end-to-end)

- **Fecha:** 2026-06-28
- **Rama:** `claude/axos-beta-readiness-audit-j23x95`
- **Alcance:** auditoría **funcional** de toda la app para dejarla lista como beta seria
  — flujo de manufactura de punta a punta, cableado front↔back (request matrix),
  carriles paralelos, silos de datos, y polish de UX. **Complementa** (no reemplaza)
  a [`docs/AUDIT-REPORT.md`](AUDIT-REPORT.md) (2026-06-24), que cubrió
  seguridad/multi-tenancy/hardening.
- **Método:** trazado real `frontend page → API client → controller → service → entity`,
  con evidencia `file:line` verificada en código. 5 barridos paralelos por dominio
  + verificación directa de los hallazgos críticos.

> **Qué es esta beta.** AXOS OS debe poder demostrarse como un hilo continuo:
> *tomar un producto nuevo desde NPI → modelarlo (BOM/ruteo/materiales) → publicar
> un plan → ejecutarlo en el piso → consumir materiales → capturar calidad →
> mantener trazabilidad → ver KPIs.* Esta auditoría mide **qué tan continuo es ese
> hilo hoy** y prioriza lo que falta.

---

## 0. Veredicto ejecutivo

**El "carril principal" del flujo de manufactura conecta de punta a punta y es
demostrable como beta.** La app compila, buildea y linta en verde
(API build OK, web lint 0 errores / 90 warnings, API tests verdes en CI). La mayor
parte del frontend está realmente cableada al backend — **no son cascarones**.

El riesgo de beta **no es código roto**, es **dualidad**: hay varios pares de
carriles paralelos (planeación, NCR, comentarios de Office, material master) donde
**uno conecta de punta a punta y el otro es un silo o código muerto**. Para una
beta honesta hay que **elegir el carril canónico, conectar/derivar el otro, y
ocultar lo que no aporta** — no construir nada nuevo.

### El hilo de beta — estado por paso

| # | Paso del flujo | Carril que conecta | Estado |
|---|---|---|---|
| 1 | Crear/planear producto nuevo (NPI) | `npi` + `product-models` | ✅ WORKS_E2E |
| 2 | Estructurar BOM / ruteo / materiales | `bom-tree` + `routing` + `material-master` (`mm_material`) | ✅ WORKS_E2E |
| 3 | Publicar plan/orden | `plans` → `pick-lists` (Kit + explosión BOM) | ✅ WORKS_E2E |
| 4 | La orden llega al piso | `mes-execution` (`WorkOrderExecution.planId`) | ✅ WORKS_E2E |
| 5 | El operador la monta y ejecuta | `/dashboard/operador` → `/mes/*` | ✅ WORKS_E2E |
| 6 | Consumo de materiales (backflush) | `mes-execution` → `inventory` (CONSUME atómico) | ✅ WORKS_E2E |
| 7 | Captura de calidad / scrap / retrabajo | `floor-quality` (`SfQualityHold`) + MRB | ✅ WORKS_E2E |
| 8 | Trazabilidad / genealogía | `genealogy` (alimentada por `mes-execution`) | 🟡 PARTIAL (sin lote/reel del piso) |
| 9 | KPIs / estado / analytics | `oee`, `quality-analytics`, `control-tower` | 🟡 PARTIAL (control-tower sin calidad) |
| 10 | Office/CAD/Quality/NPI conectados a la operación | `office`, `cad`, `npi` | 🟡 PARTIAL (CAD barrel-only, Office doble carril) |

**Conclusión:** los pasos 1–7 son una **demo de beta sólida hoy**. Los pasos 8–10
funcionan pero tienen huecos de *integración* (no de existencia) que conviene
cerrar o documentar honestamente antes de la beta.

---

## 1. Mapa de carriles paralelos (el riesgo #1 de beta)

> Regla de oro de esta auditoría y de [`AGENTS.md`](../AGENTS.md) §6.2: **un sistema
> por concern — extender, no duplicar.** Cada fila es una decisión de producto:
> canonizar uno, derivar/conectar o deprecar el otro.

| Concern | Carril CANÓNICO (conecta E2E) | Carril PARALELO | Evidencia | Recomendación |
|---|---|---|---|---|
| **Planeación → piso** | `plans` → `mes-execution` → `/dashboard/operador` | `production-plan` (`SfWorkOrder`) → *(sin UI de operador)* | `mes-execution.service.ts:1401` `resolvePlan` solo acepta `planId`/`workOrder`; no existe `apps/web/src/app/dashboard/operator-terminal/` | Deprecar Carril 2 como ejecución; dejarlo solo como **muro de supervisión read-only derivado de `Plan`** o retirarlo (ver §2). |
| **NCR / MRB** | `floor-quality` (`SfQualityHold`) — holds, MRB, disposición | `ncr` (`Ncr` + `Disposition`) — NCR formal/admin | Sin FK entre `sf_quality_hold` y `ncr`; dos colas separadas | Enlazar `SfQualityHold.folio → Ncr` (FK) y/o auto-escalar holds críticos a NCR admin. |
| **Material Master** | `material-master` (`mm_material`) — lo usa toda la UI nueva | `inventory`/`material_master` (legacy) | `bom.service.ts:12` aún referencia el legacy; ninguna UI lo llama | Aislar legacy como read-only de migración o retirarlo. |
| **BOM** | `bom-tree` (`BomNode`, usa `mm_material`) | `bom` (`bom_item/header/component`, legacy) | Front solo llama `/bom-tree`; `/bom` sin caller | Marcar `bom` legacy como deprecado; no exponer en UI. |
| **Comentarios Office** | — (ambos vivos) | `office_comments` (genérico) **vs** `office_document_comments` (TipTap) | Ambos inyectados en `OfficeService` (≈ líneas 61, 68) | Converger a un solo modelo de comentario anclado (AGENTS.md §6.2). |

---

## 2. Flujo end-to-end — trazado verificado

### 2.1 Frente de ingeniería (pasos 1–2) — ✅ WORKS_E2E

| Acción | Front `file:line` | Ruta | Backend |
|---|---|---|---|
| Crear modelo | `dashboard/models/page.tsx:93` | `POST /product-models` | `product-models.service.ts:58` (folio `MDL-`, estado DRAFT, ledger) |
| Crear proyecto NPI | `dashboard/npi/page.tsx:134` | `POST /npi/projects` | `npi.service.ts:613` (idempotente por modelo+rev, gates auto, readiness snapshot) |
| Crear material | `dashboard/materials/page.tsx:119` | `POST /material-master` | `material-master.service.ts:84` (`mm_material`, folio `MAT-`, lifecycle) |
| Crear BOM | `dashboard/bom/page.tsx:100` | `POST /bom-tree` | `bom-tree.service.ts` (nodos por `materialId`, multinivel) |
| Crear ruteo | `dashboard/routing/page.tsx:74` | `POST /routing` | `routing.service.ts:81` (valida `materialId` en `mm_material`, operaciones + materiales de backflush) |

**Hueco menor (no bloqueante):** NPI "release a MP" es *advisory* — no activa
automáticamente el `ProductModel` (activación separada vía
`/product-models/:id/activate`). Es separación intencional; documentarlo en el
runbook de demo para que no se lea como bug.

### 2.2 Núcleo de ejecución (pasos 3–6) — ✅ WORKS_E2E (Carril 1)

```
/dashboard/planning ──POST /plans──▶ Plan(pending)
        │
        └─POST /pick-lists {planId}─▶ PickListService.publishPlan
                                        ├─ crea Kit (preparing) + KitMaterial (explosión BOM)
                                        └─ Plan.status = 'published'        (pick-list.service.ts:71-149)
/dashboard/operador ──POST /mes/executions {workOrder|planId}──▶ resolvePlan
                                        ├─ WorkOrderExecution(planId) + ExecutionStep[] (explota ruteo)
                                        └─ ExecutionStepMaterial[] (desde Kit)   (mes-execution.service.ts:154-257)
        │
        └─POST /mes/executions/:id/steps/:stepId/confirm─▶ confirmAdvance
                ├─ ExecutionStepMaterial.consumedQty++ / availableQty--
                ├─ KitMaterial.quantityConsumed/Remaining
                ├─ InventoryService.recordTransaction(CONSUME)  ── decrementa onHand, crea InventoryMovement (atómico)
                └─ genealogy.recordLink(...)                    (mes-execution.service.ts:478-791, :769)
```

El puente que lo hace funcionar: `WorkOrderExecution.planId` (FK numérica a `Plan.id`).
Andon/incidencias/downtime también persisten (`POST /mes/executions/:id/andon`,
`/incidents`).

**⛔ El callejón sin salida (Carril 2):** `production-plan` publica a `SfWorkOrder`
(UUID, tenant-scoped) pero:
- `mes-execution` **nunca** consulta `SfWorkOrder` (`resolvePlan` solo `Plan`).
- **No existe** `apps/web/src/app/dashboard/operator-terminal/` → su "piso" no tiene UI.
- No hay sincronización `Plan ↔ SfWorkOrder`.

→ Un WO creado en `/dashboard/production-plan` **nunca llega al operador ni consume
material**. Ya está documentado en [`docs/analysis-planning-cta.md`](analysis-planning-cta.md)
(el CTA de planning ya apunta a `/dashboard/operador`). **Falta cerrar la decisión
(a/b/c) del rol del Carril 2** — ése es trabajo de PR 3.

### 2.3 Aguas abajo (pasos 7–9)

- **Captura de calidad (✅ WORKS_E2E):** `dashboard/floor-quality/page.tsx:73` →
  `POST /floor-quality/holds` → `SfQualityHold` (serial/lote/qty/defecto/severidad,
  bloquea `qualityClear` del WO, ledger). MRB completo: `…/mrb`, `…/disposition`
  (USE_AS_IS exige waiver, RTV exige `scarRef`), `…/rework`, `…/reinspect`, `…/close`
  (`floor-quality.service.ts:79-190`).
- **Genealogía (🟡 PARTIAL):** as-built se construye de eventos reales de consumo
  (`mes-execution` → `genealogy.recordLink`, `:769`) + índice manual `SfGenealogyLink`.
  Where-used por lote/reel **es incompleto** porque *el terminal de piso no captura
  lote/reel* (`genealogy.service.ts:87` lo comenta explícitamente). Además genealogía
  no ingiere eventos de **calidad** (solo de producción).
- **OEE (✅ WORKS_E2E):** `oee.service.ts:671` lee `SfQualityHold.scrapQty` por
  ventana de tiempo → factor de calidad real. Availability/performance de
  downtimes/consumo reales.
- **Quality Analytics (🟡 PARTIAL):** el command center unifica a nivel app pero las
  dispositions del Pareto vienen de `Disposition` (NCR admin), **no** de
  `SfQualityHold` del piso (`quality-analytics.service.ts:394`).
- **Control Tower (🟠 SCAFFOLD para calidad):** `control-tower.service.ts` agrega 8+
  dominios (improvement, ehs, maintenance, legal, testing, procurement, people, hr)
  pero **no incluye calidad** (ni `floor-quality` ni `quality-analytics`) → la torre
  ejecutiva tiene un punto ciego de calidad.

### 2.4 Office / CAD / Nav / UX (paso 10 + plataforma)

- **Office (🟡 PARTIAL):** persiste docs/sheets/slides al backend; el conector AXOS
  (`lib/office/axosConnectorApi.ts`) trae data operativa a las hojas. **Sigue
  habiendo dos sistemas de comentarios** (ver §1).
- **CAD (🟠 BROKEN por wiring):** de los módulos de `lib/cad`, sí están montados
  measurements/collisions/flow-optimization/safety-zones (`Layout3DEditor.tsx:40,58-60`)
  y dxf-export vía adapter. Pero **`annotations.ts` y `validation-report.ts` siguen
  barrel-only** (re-exportados en `lib/cad/index.ts`, sin panel/acción en el editor)
  — incumple [`AGENTS.md`](../AGENTS.md) §6.3.
- **Navegación (✅ WORKS):** `lib/dashboardAreas.ts` (60 áreas) — sin páginas
  huérfanas ni links muertos; las rutas bare (chat, settings, admin…) están
  correctamente fuera del catálogo por diseño.
- **Estados de carga (🟡 PARTIAL):** ~6 páginas tipo "department hub"
  (`/lab`, `/metrics`, `/erp`, `/industrial-engineering`, `/rh`, `/warehouse`) usan
  `useApi` sin skeleton → muestran KPIs en `0` un instante antes de poblar (cosmético,
  no crash). Candidato a PR 8.

---

## 3. API / Route Matrix — cableado front↔back

**Modelo de cableado (confirmado):** `app.setGlobalPrefix('api')` en `main.ts:231`
(sin exclusiones). El front usa `useApi(path)` / `apiFetch(\`${API_BASE}${path}\`)`
con `API_BASE = NEXT_PUBLIC_API_URL` (en prod ya termina en `/api`); los paths
**omiten** `/api`. Un set chico de `fetch('/api/...')` mismo-origen lo sirven los
**route handlers** de Next en `apps/web/src/app/api/**` (ai, auth, admin, tcode,
backend) — todos presentes y correctos.

**Resultado:** el cableado vivo de los ~15 módulos de mayor tráfico (planning,
production, operador, quality, materials, bom, routing, inventory, receiving,
shipping, mrp, procurement, control-tower, genealogy, intelligence) es **limpio:
0 rutas 404, 0 mismatches de método.** Los bugs de ruta del audit anterior
(Intelligence `/api/semantic|analytics|autopilot` mismo-origen, web-push) **ya
fueron corregidos** (hoy usan `apiFetch(${API_BASE}/...)`).

### 3.1 Defectos de cableado encontrados (y corregidos en este PR)

| ID | Defecto | `file:line` | Severidad | Estado |
|---|---|---|---|---|
| **WIRE-001** | 4 controllers con `@Controller('api/…')` → montan en `/api/api/…` (doble prefijo). Sus propios docstrings dicen `/api/roles`, `/api/plants`, etc. Hoy sin caller, pero rompen apenas se exponga la RBAC DB-backed que `settings/_lib/rbac.ts` menciona. | `auth/controllers/roles.controller.ts:24`, `plants.controller.ts:17`, `user-roles.controller.ts:24`, `seed.controller.ts:13` | Alta (latente) | ✅ **Corregido** → `@Controller('roles'|'plants'|'users'|'seed')` |
| **WIRE-002** | `AuthContext.login()` hace `${NEXT_PUBLIC_API_URL}/api/auth/login` (doble `/api` en prod) + fallback de puerto `3001` errado. Código muerto (el login real usa el route handler), pero trampa latente. | `contexts/AuthContext.tsx:203` | Media (código muerto) | ✅ **Corregido** → mismo-origen `/api/auth/login` |

> Verificación de seguridad de WIRE-001: las rutas siguen protegidas
> (`@UseGuards(JwtAuthGuard, PermissionsGuard)` + `@RequirePermission('auth','write')`);
> los sub-paths `:userId/roles` no colisionan con `UsersController` (`:id`); ningún
> test referencia los paths viejos. Es corrección de **ruta**, no de auth.

---

## 4. Backlog priorizado de beta → mapa de PRs

> Orden de ataque pensado para PRs secuenciales, chicos y verdes. Cada uno aditivo;
> **`main` despliega a Railway**, no mergear en rojo.

| PR | Objetivo | Items | Riesgo |
|---|---|---|---|
| **PR 1** (este) | **Audit + API/Route Matrix + fixes de wiring seguros** | Este documento; WIRE-001, WIRE-002 | Bajo (docs + ruta) |
| **PR 2** | Critical request wiring fixes | Barrer el resto de controllers/contratos por consistencia; resolver `ShipmentStatus` canónico (ver AUDIT-REPORT §10) | Bajo-Medio |
| **PR 3** | Estabilizar flujo Producto/NPI/BOM/Ruteo/Plan | **Decidir rol del Carril 2** (`production-plan`): (a) muro read-only derivado de `Plan`, (b) puente `Plan↔SfWorkOrder`, o (c) deprecar. Aislar BOM/material-master legacy. | Medio (decisión de producto) |
| **PR 4** | Estabilizar MES operador E2E + consumo | Endurecer edge cases de `confirmAdvance`/inventario; smoke del flujo plan→operador→backflush | Medio |
| **PR 5** | Integración Quality/MRB/NCR | FK `SfQualityHold↔Ncr`; capturar lote/reel en el terminal de piso → genealogía completa; unificar dispositions en analytics | Medio |
| **PR 6** | Supply Chain/Inventario/Procurement/Receiving | Verificar conteos/recepción/replenishment E2E; scope tenant en lecturas (ver AUDIT-REPORT §4) | Medio |
| **PR 7** | Office/CAD beta polish | Montar `annotations`/`validation-report` en el workbench CAD (AGENTS §6.3); converger comentarios de Office | Bajo-Medio |
| **PR 8** | UX global de beta | Skeletons en los ~6 department hubs; estados de error/empty honestos; añadir card de **calidad** al Control Tower | Bajo |
| **PR 9** | Beta Smoke Suite / Runbook / Demo Script | Script de demo del hilo 1–10; smoke e2e del carril principal | Bajo |
| **PR 10** | Beta Readiness Report final | Reporte de cierre con estado real post-PRs | Bajo |

---

## 5. Guion de demo de beta (el hilo que sí funciona hoy)

Ruta probada de punta a punta sobre el **Carril 1**:

1. **Producto** — `/dashboard/models` → "Nuevo modelo" → activar.
2. **Materiales** — `/dashboard/materials` → crear partes (estado ACTIVE).
3. **BOM** — `/dashboard/bom` → crear BOM del modelo, agregar líneas (partes del maestro).
4. **Ruteo** — `/dashboard/routing` → crear ruteo del modelo, operaciones + materiales de backflush.
5. **NPI (opcional)** — `/dashboard/npi` → proyecto, gates, readiness, release a MP.
6. **Plan** — `/dashboard/planning` → "Nuevo plan" → "Publicar" (genera Kit + PickList).
7. **Piso** — `/dashboard/operador` → escanear/abrir WO → se explota el ruteo en pasos.
8. **Ejecutar + consumir** — confirmar avance por estación → backflush descuenta inventario.
9. **Calidad** — `/dashboard/floor-quality` → levantar hold → MRB → disposición.
10. **Trazabilidad/KPIs** — `/dashboard/genealogy` (as-built por serial) · `/dashboard/oee` · `/dashboard/control-tower`.

> Evitar en la demo: `/dashboard/production-plan` como ruta al piso (Carril 2, no
> ejecuta), y where-used por lote (incompleto hasta capturar lote/reel en piso).

---

## 6. Estado de build / quality gates (evidencia)

| Gate | Resultado |
|---|---|
| API `npm run build` (nest) | ✅ OK (exit 0) |
| Web `npm run lint` | ✅ OK (0 errores, 90 warnings preexistentes) |
| API `npm test` | ✅ verde en CI (último run de `main`) |
| Smoke bootstrap (Postgres) | corre en CI; materializa esquema + DI |

Los warnings de web (`<img>` vs `<Image>`, hooks set-state-in-effect) son deuda
cosmética preexistente, no bloqueante.

---

## 7. Pendiente para decisión humana (producto)

1. **Carril 2 de planeación** (`production-plan`/`SfWorkOrder`): (a) supervisión
   read-only derivada de `Plan`, (b) integrar con puente, o (c) deprecar. — *PR 3.*
2. **Unificación NCR**: ¿`SfQualityHold` (piso) y `Ncr` (admin) convergen con FK o se
   mantienen como colas con auto-escalado? — *PR 5.*
3. **Material master / BOM legacy**: confirmar retiro vs. mantener como read-only de
   migración. — *PR 3.*
4. **Comentarios de Office**: modelo único anclado. — *PR 7.*

> Esta auditoría **no** ejecuta (1)–(4): son decisiones de producto. Deja la
> evidencia `file:line` y el plan de PRs para tomarlas.
</content>
</invoke>
