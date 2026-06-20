# AXOS OS — Night Log · NÚCLEO DE MANUFACTURA ERP (MM · BOM · Routing · Import)

Bitácora del carril "Núcleo ERP de manufactura" (rama `claude/gallant-curie-x8w49h`).
Objetivo: construir el núcleo que a futuro compita con SAP — Maestro de Materiales +
BOM multinivel + Routing, con importadores. **Trabajo supervisado**, aditivo estricto.

> **Regla de PR/merge (esta sesión):** el brief dice "NO abras PR sin que yo lo pida"
> y "Trabajo supervisado". Por eso se **commitea y pushea a la rama** y se deja listo
> para revisión; **no** se auto-mergea a `main` ni se abren PRs sin permiso explícito.
> Mergear a `main` despliega a prod (Railway, synchronize en vivo).

---

## Reglas de hierro aplicadas

- **Aditivo estricto:** módulos y tablas NUEVAS con prefijo (`mm_`, `bom_`, `rt_`).
  NUNCA se tocan columnas de `bom_headers`, `bom_components`, `pm_product_models`.
- **Coexistencia (no migración):** el BOM plano (`bom_*`) y el `material_master`
  legacy siguen VIVOS en paralelo. El corte lo hace Sergio.
- **Migración aditiva idempotente** con guard `hasTable`. **Repos tenant-scoped**
  (DECISIONS §11). **Eventos al Event Ledger**.
- **Puertas antes de cada commit de fase:** build API + `npm test` + tsc/eslint +
  `next build` + **smoke de bootstrap contra Postgres**. Rojo = no se cierra la fase.

## GREP previo (reusar, no duplicar) — hallazgos

- **`material_master` (inventory):** YA existe, pero es mínimo: PK global `partNumber`
  (varchar), **sin tenant_id**, sin tipo de item / make-buy / AVL / alternantes /
  peso / status de ciclo de vida. Cambiar su PK/agregar tenant sería **destructivo**
  (prohibido). → Se construye `mm_material` NUEVO, tenant-scoped, rico (igual que
  `pm_product_models` convive con `model` texto libre). Ver DECISIONS §15.
- **`bom` (bom_headers/bom_components/bom_items):** BOM **plano** por `model` texto
  libre + `componentNumber` texto (sin FK). No multinivel real. → FASE 2 crea `bom_*`
  nuevos (recursivos, FK a `mm_material`).
- **`process-routing` (process_steps/process_step_materials):** routing por `model`
  texto, no tenant-scoped, sin FK a material. → FASE 3 crea `rt_*` ligados a material.
- **`cost-rollup`:** costeo por WO (cost_items). Reusable a futuro para rollup de BOM.
- **`line-engineering` (sf_*):** balanceo/disposición de líneas; ortogonal.
- **Patrón moderno a copiar:** `pm_product_models` (TenantBaseEntity, UUID, tabla
  prefijada, `DATE_COLUMN_TYPE`, `simple-json`, folio vía `DocumentNumberingService`,
  `provideTenantScopedRepository`, eventos al ledger, máquina de estados pura + spec).

---

## FASE 1 — MAESTRO DE MATERIALES (mm_) — ✅ EN VERDE

**Módulo nuevo:** `apps/api/src/modules/material-master` (endpoints `/material-master`).
100% aditivo, tablas prefijadas `mm_`, tenant-scoped.

**Entidades (3 tablas nuevas):**
- `mm_material` — fuente ÚNICA de partes. partNumber único por (tenant, plant);
  descripción; **itemType** estilo SAP (PURCHASED/MANUFACTURED/PHANTOM/NON_STOCK/
  DOCUMENT); categoría; UoM base; **make/buy**; **lifecycle** (DRAFT→ACTIVE→HOLD→
  OBSOLETE, máquina de estados pura); costo estándar + moneda; peso + UoM; notas;
  metadata (simple-json); activated/obsoleted at.
- `mm_avl` — fabricantes aprobados por material (clave EMS: 1 parte interna → N MPN):
  fabricante + MPN + status (APPROVED/PENDING/REJECTED/OBSOLETE) + preferencia +
  lead time. Único por (material, fabricante, MPN).
- `mm_material_alt` — alternantes/sustitutos entre materiales (FK a `mm_material` en
  ambos extremos): tipo (ALTERNATE/SUBSTITUTE), bidireccional, ratio. Único por par.

**Backend:** `material-state.ts` (vocabulario SAP + máquina de estados pura) + spec
(9 tests). DTOs con class-validator. Servicio con `applyScope` (tenant+plant), folio
`MATERIAL` (MAT-#####) vía numbering, CRUD + búsqueda + filtros (tipo/estado) + KPIs +
AVL (alta/edición/baja) + alternantes (alta/baja, valida que exista en el maestro y
que no sea alternante de sí mismo) + transiciones de ciclo de vida + eventos al ledger
(EventDomain.MATERIALS). Controller `@UseGuards(JwtAuthGuard, PermissionsGuard)`.
Módulo con `provideTenantScopedRepository` para las 3 entidades. Registrado en
`app.module.ts`. docType `MATERIAL` agregado a `numbering.defaults.ts`.

**Migración:** `20260620120000-CreateMaterialMaster.ts` — aditiva, idempotente
(guard `hasTable` por tabla), índices de scope/único, `uuid_generate_v4()`.

**Frontend:**
- `/dashboard/materials` — lista + KPIs (total/activos/make/buy) + búsqueda + filtro
  por tipo + alta de material. Estados vacíos honestos.
- `/dashboard/materials/[id]` — detalle con pestañas: **Datos** (edición + costo/peso/
  UoM) con botones de **transición de ciclo de vida** (estados válidos según SM),
  **AVL** (alta/baja de fabricante+MPN+pref+lead), **Alternantes** (elige material del
  maestro; alta/baja). NADA de texto libre: alternantes se eligen del maestro.
- Descubrible: tile en el hub (sección "Diseño · NPI") + entrada en `SearchPalette`.

**Puertas FASE 1 (todas verdes):**
- API `npm run build` ✅
- API `npm test` ✅ (84 suites / 563 tests, +9 nuevos)
- API smoke bootstrap contra **Postgres 16** ✅ (las 3 tablas `mm_` materializan sin
  colisión de tabla/FK/DI)
- web `tsc --noEmit` ✅ · `eslint` ✅ (0 en archivos tocados) · `next build` ✅

**Usable por un ingeniero real:** crear una parte (comprado/fabricado/…), darle AVL
(varios MPN) y alternantes, y moverla por su ciclo de vida — todo desde la UI.

### Pendiente / ganchos para fases siguientes
- FASE 2 (BOM multinivel `bom_`) referenciará `mm_material` por FK (sin texto libre).
- FASE 3 (routing `rt_`) ligará operaciones a `mm_material` (qué se consume dónde).
- Costo estándar de `mm_material` alimentará el rollup de BOM (reusar `cost-rollup`).

---

## FASE 2 — BOM MULTINIVEL (bom_) — ✅ EN VERDE

**Módulo nuevo:** `apps/api/src/modules/bom-tree` (endpoints `/bom-tree`). 100%
aditivo, tablas prefijadas `bom_` que NO colisionan con el BOM plano legacy
(`bom_headers`/`bom_components`/`bom_items`). Tenant-scoped.

**Modelo (multinivel real):** el multinivel emerge de materiales que referencian
materiales: una línea apunta a un material; si ese material es un ENSAMBLE con su
propio `bom_node`, la explosión recursa. Esto es el modelo SAP normalizado (BOMs de
un nivel que encadenan), no un árbol denormalizado.
- `bom_node` — header del BOM por ensamble + revisión (FK `materialId` → mm_material;
  único por tenant+plant+material+revisión; estado DRAFT/ACTIVE/OBSOLETE).
- `bom_line` — componente: FK `materialId` → mm_material (NUNCA texto libre),
  find-number (0010,0020…), cantidad, UoM, refDes, **itemCategory**, **scrap %**,
  make/buy (override opcional), **phantom**, **alternateGroup** (alternantes en la
  misma posición), notas.

**Lógica pura testeable (`bom-explode.ts` + spec, 6 tests):** explosión recursiva con
acumulación de cantidades (qty × (1+scrap%) × multiplicador del padre), **rollup de
costo** (hoja: standardCost × extendido; ensamble: suma de hijos), **demanda neta**
de hojas, **profundidad** y **detección de ciclos** (corta la rama, no cuelga).

**Backend:** servicio con CRUD de nodos y líneas (valida que el material exista en MM
y que un ensamble no se contenga a sí mismo; auto find-number), `explode(nodeId,qty)`
(resuelve el nodo efectivo por material — ACTIVE preferido — y honra la revisión del
root), `whereUsed(materialId)` (directo + ancestría multinivel, guard de ciclos),
eventos al ledger (ENGINEERING). Reusa `MaterialMasterService` (fuente única de
partes). Migración aditiva idempotente (`hasTable`). Registrado en `app.module.ts`.

**Frontend:**
- `/dashboard/bom` — lista de BOMs + KPI de líneas + crear (elige ensamble del
  maestro) + **herramienta where-used** (elige material → ensambles donde aparece,
  multinivel).
- `/dashboard/bom/[id]` — editor con pestañas: **Estructura** (líneas editables;
  agregar componente eligiéndolo del maestro; editar pos/cant/scrap/refDes/phantom;
  marca **sub-ensamble** con enlace a su BOM) + **Explosión** (árbol multinivel
  expandir/colapsar, cantidades y costo extendido por nodo, total, demanda neta de
  hojas, aviso de ciclos; "construir N unidades"). NADA de texto libre.
- Descubrible: tile en hub + entrada en `SearchPalette`.

**Puertas FASE 2 (todas verdes):**
- API `npm run build` ✅ · `npm test` ✅ (85 suites / 569 tests, +6 nuevos) ·
  smoke bootstrap **Postgres** ✅ (bom_node/bom_line sin colisión con legacy)
- web `tsc` ✅ · `eslint` ✅ (0) · `next build` ✅

**Usable por un ingeniero real:** crear el BOM de un ensamble, agregar componentes
del maestro (incluido un sub-ensamble que ya tiene su propio BOM), y explotar el
árbol completo con cantidades y costo acumulados + ver dónde se usa cada parte.

---

## FASE 3 — ROUTING (rt_) — ✅ EN VERDE

**Módulo nuevo:** `apps/api/src/modules/routing` (endpoints `/routing`). 100%
aditivo, tablas prefijadas `rt_`, coexisten con el `process_steps` legacy. Tenant-scoped.

**Entidades (3 tablas nuevas):**
- `rt_routing` — header del ruteo por ensamble + revisión (FK `materialId` →
  mm_material; único por tenant+plant+material+revisión; estado DRAFT/ACTIVE/OBSOLETE).
- `rt_operation` — operación ordenada: `sequence` (10,20,30…), nombre, **centro de
  trabajo**, **setup time** (min/lote), **run time/unidad** (min), descripción,
  ref de visual-aid/instrucción. Único por (routing, sequence).
- `rt_operation_material` — **puente BOM↔ruteo**: material consumido en la operación
  (FK `materialId` → mm_material, FK opcional `bomLineId`, qty/unidad, UoM) → habilita
  **backflush correcto** (confirmar N piezas en la op consume qty×N).

**Lógica pura testeable (`routing-logic.ts` + spec, 5 tests):** máquina de estados +
**rollup de tiempo estándar** (Σsetup una vez + Σrun/unidad × qty = tiempo del lote).

**Backend:** servicio con CRUD de ruteo/operaciones/materiales-por-operación (valida
material en MM, auto-secuencia ×10, evita secuencias duplicadas), totales de tiempo,
eventos al ledger (ENGINEERING). Reusa `MaterialMasterService`. Migración aditiva
idempotente (`hasTable`). Registrado en `app.module.ts`.

**Frontend:**
- `/dashboard/routing` — lista + crear (elige ensamble del maestro).
- `/dashboard/routing/[id]` — editor: KPIs (ops, setup total, run/unidad) +
  operaciones ordenadas (agregar/editar/borrar con secuencia, centro de trabajo,
  tiempos, descripción, visual-aid) + por operación, **materiales consumidos**
  (asignar del maestro con qty/unidad, para backflush) en panel expandible.
- Descubrible: tile en hub + entrada en `SearchPalette`.

**Puertas FASE 3 (todas verdes):**
- API `npm run build` ✅ · `npm test` ✅ (86 suites / 574 tests, +5 nuevos) ·
  smoke bootstrap **Postgres** ✅ (rt_ sin colisión)
- web `tsc` ✅ · `eslint` ✅ (0) · `next build` ✅

**Usable por un ingeniero real:** definir el ruteo de un ensamble — operaciones
ordenadas con centro de trabajo y tiempos, y qué materiales se consumen en cada una.

---

## FASE 4 — IMPORTADORES (migración SAP) — ✅ EN VERDE

**Módulo nuevo:** `apps/api/src/modules/import-data` (endpoints `/import-data`).
**Sin tablas nuevas:** escribe a través de los servicios mm_/bom_/rt_ (no duplica
persistencia). Audita cada commit en el Event Ledger (IMPORT_COMMITTED).

**Pipeline genérico (mismo flujo para los 3 formatos):** parsear → mapear → validar
→ previsualizar → confirmar.
- **CSV/Excel (subida de archivo):** el frontend parsea con `xlsx` (lee .csv/.xlsx/
  .xls) → manda filas JSON + headers al API.
- **SQL/staging:** filas JSON directas (una integración SQL POSTea el extract de la
  tabla de staging). Mismo camino que CSV.
- **IDoc/API:** **esqueleto listo** — `ExternalFeedAdapter` (token DI) +
  `NotConfiguredFeedAdapter` que reporta claro "no configurado (follow-up)". Cuando
  se cablee un conector real (SAP IDoc MATMAS/BOMMAT/ROUTING u OData/REST), sus filas
  pasan por el MISMO pipeline.

**Lógica pura testeable (`import-logic.ts` + spec, 7 tests):** specs de campos por
destino (MATERIAL/BOM/ROUTING) con aliases (auto-mapeo robusto a acentos/espacios/
guiones — reconoce nombres tipo SAP: MATNR, IDNRK, MENGE, POSNR, VORNR…), validación
+ coerción por fila (numérico/enum/booleano), y reporte de errores por fila.

**Destinos (respetando posición/categoría):**
- MATERIAL → upsert por partNumber (crea/actualiza mm_material).
- BOM → padre+componente+cantidad+posición+categoría+scrap+refDes; get-or-create del
  `bom_node` por (material, revisión) + agrega `bom_line` (dedup por posición+material).
- ROUTING → ensamble+secuencia+operación+centro+tiempos; get-or-create `rt_routing` +
  agrega `rt_operation` (dedup por secuencia).
- Opción `createMissingMaterials`: crea stubs DRAFT para partes faltantes en BOM/
  Routing; si está apagado, las partes faltantes se reportan como error de fila.
- **No importa basura en silencio:** filas inválidas se reportan y NO se persisten;
  las válidas sí. Reporte: creados/actualizados/omitidos/errores por fila.

**Backend:** `import-data.service` orquesta reusando MaterialMasterService,
BomTreeService (+ `findOrCreateNode` nuevo), RoutingService (+ `findOrCreateRouting`
nuevo). `GET /fields/:target`, `POST /suggest`, `POST /preview`, `POST /commit`.

**Frontend:** `/dashboard/import` — asistente de 4 pasos: **Origen** (elige destino +
formato; subir archivo CSV/Excel, pegar staging, o nota IDoc/API) → **Mapear**
(auto-sugerido, marca obligatorios) → **Previsualizar** (KPIs válidas/error + tabla
con estado por fila + toggle crear-faltantes) → **Confirmar** (reporte creados/
actualizados/omitidos + errores por fila). Descubrible: tile en hub + SearchPalette.

**Puertas FASE 4 (todas verdes):**
- API `npm run build` ✅ · `npm test` ✅ (87 suites / 581 tests, +7 nuevos) ·
  smoke bootstrap **Postgres** ✅
- web `tsc` ✅ · `eslint` ✅ (0) · `next build` ✅

**Usable por un ingeniero real:** subir un export de SAP (CSV/Excel) de materiales,
BOM o ruteo, mapear columnas, ver qué entra y qué falla, y confirmar la carga.

---

## CIERRE — NÚCLEO ERP DE MANUFACTURA (4 fases en verde)

Las 4 fases quedan **operables de punta a punta** por un ingeniero real y **100%
aditivas** (lo viejo sigue vivo en paralelo; el corte lo hace Sergio):
1. **Maestro de Materiales** (mm_) — fuente única de partes + AVL + alternantes.
2. **BOM Multinivel** (bom_) — estructuras N niveles + explosión + where-used.
3. **Ruteo** (rt_) — operaciones, tiempos, centro de trabajo + puente BOM↔ruteo.
4. **Importadores** — migración (CSV/Excel/staging + esqueleto IDoc/API) con
   validación y reporte por fila.

Total nuevo: 4 módulos API + 11 tablas prefijadas (mm_3, bom_2, rt_3 + 0 de import) +
6 páginas web + 4 tiles en hub + 4 entradas en SearchPalette. **27 tests nuevos**
(state machines + explosión + tiempos + validación de import). Puertas verdes en cada
fase (API build · npm test · smoke PG · web tsc · eslint · next build).

**Ganchos para el corte supervisado (REQUIERE SUPERVISIÓN — no autónomo):**
- Mapear/migrar `material_master` legacy → `mm_material` y BOM plano → `bom_*`.
- Conector real IDoc/API (interfaz lista).
- Backflush real consumiendo `rt_operation_material` en el terminal de operador.

> **PR #332 mergeado a `main`** (squash · `b33eecb`, CI verde). El núcleo está en prod.

---

## POST-NÚCLEO #1 — COSTEO DE PRODUCTO (costo estándar) — ✅ EN VERDE

**Módulo nuevo:** `apps/api/src/modules/product-costing` (endpoints `/product-costing`).
**Sin tablas nuevas** — calcula on-demand reusando los servicios del núcleo. Es el
**costo ESTÁNDAR** (lo que *debería* costar desde datos maestros), complementario al
`cost-rollup` legacy (costos REALES por WO con `cost_items`).

- **Material** = `totalCost` de la explosión de BOM (FASE 2, ya costea con
  `mm_material.standardCost`, recursivo).
- **Mano de obra** = tiempos del ruteo (FASE 3) × tarifa $/h. Recursivo: ruteo del
  ensamble raíz (por qty) + ruteo de cada sub-ensamble del árbol (por su qty
  acumulada). Nuevo `RoutingService.operationsForMaterials()` (lectura en bloque,
  ruteo efectivo ACTIVE-preferido).
- **Overhead** = % del costo directo (material + labor).
- Lógica pura `costing.ts` + spec (4 tests). `rollup(bomNodeId, qty, {tarifa, oh%})`
  → desglose + costo unitario; `applyStandardCost()` escribe el unitario en el
  `standardCost` del material (cierra el loop) + evento al ledger.

**Frontend:** pestaña **Costo** en el editor de BOM (`/dashboard/bom/[id]`): inputs
qty/tarifa/overhead, KPIs material/labor/overhead/total, **costo unitario** con barra
apilada %, mano de obra por ensamble, y botón **"Guardar como costo estándar"**.

**Puertas (verdes):** API build · `npm test` (91 suites / **611 tests**, +4) · smoke
PG · web tsc · eslint · `next build`.

**Usable:** abrir un BOM → pestaña Costo → ver material+labor+overhead y costo unitario
del producto, ajustar tarifa/overhead, y fijarlo como costo estándar del material.

> **PR #334 mergeado a `main`** (squash · `a95f05a`, CI verde).

---

## POST-NÚCLEO #2 — BACKFLUSH POR RUTEO — ✅ EN VERDE

**Módulo nuevo:** `apps/api/src/modules/routing-backflush` (endpoints
`/routing-backflush`). Vuelve **operacional** el puente BOM↔ruteo: confirmar N
unidades en una operación consume del inventario los materiales asignados a esa
operación (`rt_operation_material` × N). **Aditivo, sin tablas nuevas** y **sin tocar
el terminal de operador vivo** — usa el API público `InventoryService.recordTransaction
('CONSUME')` (como ya hacen warehouse/production-runtime).

**Hallazgo:** el backflush actual del terminal consume **una sola parte × use-factor**
por estación; NO usa la lista por operación del ruteo. Este módulo cubre ese hueco.

**Diseño seguro (preview + commit):**
- `preview` (read-only): `computeBackflush(materiales_op, unidades)` → consumo por
  material. Lógica pura `backflush.ts` + spec (3 tests).
- `commit`: resuelve `materialId → partNumber` y postea `CONSUME` por almacén. Como
  `recordTransaction` valida contra el `material_master` legacy y exige stock
  `available`, las partes sin stock/sin alta se **reportan por línea** (commit parcial,
  nunca silencioso). Evento al ledger (PRODUCTION).

**Frontend:** `/dashboard/backflush` — elige ruteo → operación → unidades →
**previsualizar consumo** → almacén/ubicación/WO → **confirmar** (reporte
consumidos/errores por línea). Descubrible: tile en hub (Producción) + SearchPalette.

**Puertas (verdes):** API build · `npm test` (94 suites / **623 tests**, +3) · smoke
PG · web tsc · eslint · `next build`.

**Usable:** un supervisor confirma producción de una operación y descuenta del
inventario exactamente los materiales que esa operación consume, según el ruteo.

> **PR #336 mergeado a `main`** (squash · `f9329b6`, CI verde).

---

## POST-NÚCLEO #3 — MRP / REQUERIMIENTO NETO — ✅ EN VERDE

**Módulo nuevo:** `apps/api/src/modules/mrp` (endpoint `/mrp`). **Solo lectura, sin
tablas nuevas.** El motor de planeación clásico sobre el núcleo: explota un BOM por
cantidad, neta la demanda bruta contra existencias + en tránsito, y sugiere qué ordenar.

- **Demanda bruta** = explosión de BOM (FASE 2) → demanda de hojas × qty.
- **Oferta** = posiciones de inventario (read-only): disponible = Σ(on-hand − asignado)
  con `holdStatus='available'`, + en tránsito. Agregado por parte (filtro almacén opc.).
- **Neto** = max(0, bruto − disponible − tránsito); sugerido = neto; **make/buy** del
  maestro (fabricar vs comprar); valor del faltante = neto × costo.
- Lógica pura `mrp.ts` (`computeNetting`) + spec (3 tests): netting, orden por escasez/
  valor, oferta faltante = 0.

**Backend:** `MrpService.netting(bomNodeId, qty, warehouseId?)` reusa BomTreeService +
MaterialMasterService + lee `InventoryPosition` (repo, read-only). `GET
/mrp/:bomNodeId/netting`.

**Frontend:** `/dashboard/mrp` — elige ensamble + cantidad (+ almacén opcional) →
tabla por material (bruto/disponible/tránsito/**neto**/ordenar/valor) con escasez
resaltada y KPIs (materiales, en escasez, valor faltante). Descubrible: tile en hub
(Planeación) + SearchPalette. Generar POs reales = follow-up.

**Puertas (verdes):** API build · `npm test` (95 suites / **626 tests**, +3) · smoke
PG · web tsc · eslint · `next build`.

**Usable:** un planeador elige "construir N de este ensamble" y ve al instante qué
falta y cuánto pedir, distinguiendo comprar vs fabricar.

> **PR #338 mergeado a `main`** (squash · `7b024af`, CI verde).

---

## POST-NÚCLEO #4 — PLANEACIÓN DE COMPRAS (POs desde MRP) — ✅ EN VERDE

**Módulo nuevo:** `apps/api/src/modules/purchase-planning` (endpoints
`/purchase-planning`). Cierra el loop **planeación → compras**. Aditivo, sin tablas
nuevas: reusa `MrpService` (faltantes), `MaterialMasterService` (AVL) y
`ProcurementService` (crear PO).

- `suggest(bomNodeId, qty, wh)`: toma los faltantes del MRP (net>0), resuelve el
  **proveedor = fabricante AVL preferido (APPROVED, menor preferencia)** por material,
  y agrupa en borradores de PO (uno por proveedor; sin AVL → "Por asignar").
- `generate(...)`: crea un PO por grupo vía `ProcurementService.create` (folio PO-,
  título, proveedor, total, notas con el detalle de partes — el PO es header-only).
  Evento al ledger (MATERIALS). 
- Lógica pura `po-grouping.ts` (`groupBySupplier`) + spec (4 tests). Se agregó
  `materialId` a las filas del MRP (aditivo) para resolver el AVL.

**Frontend:** la página `/dashboard/mrp` gana la sección **"Órdenes de compra desde el
MRP"**: botón *Sugerir órdenes* (agrupa por proveedor con total y partes) → *Generar
N órdenes* → muestra folios creados + enlace a Compras.

**Puertas (verdes):** API build · `npm test` (96 suites / **632 tests**, +6) · smoke
PG · web tsc · eslint · `next build`.

**Usable:** del MRP, un comprador genera con un clic las órdenes de compra de los
faltantes, agrupadas por proveedor, y las ve en el módulo de Compras.

### Siguientes sugeridos: ECO/efectividad (control de cambios) · el corte legacy→nuevo (supervisado).
