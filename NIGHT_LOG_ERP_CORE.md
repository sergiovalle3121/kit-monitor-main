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

## FASE 4 — IMPORTADORES — pendiente
