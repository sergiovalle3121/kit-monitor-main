# AXOS OS — Night Log · Carril S2 (Calidad)

Bitácora del carril de **Calidad** (S2). Rama `claude/trusting-dijkstra-do4x0w`.
Alcance de archivos: `apps/web/src/app/dashboard/quality/**`, `.../floor-quality/**`
y `.../quality/ncr/**`. Backend reutilizado (cero cambios de backend este turno):
`ncr`, `quality` (18), `floor-quality` (10), `testing` (5).

> **Reglas que sigo:** trabajo solo en mi carril; cero mock (toda lista del API
> real, estado vacío con CTA honesto); reuso endpoints existentes (grep del
> controller antes de cablear); NO toco migraciones, entidades, `app.module.ts`,
> `dashboard/page.tsx` (nav) ni componentes compartidos (PageHeader, IconTile,
> glass/motion). Puertas antes de cerrar: `eslint` + `tsc` + `next build` en verde.

---

## Mapa del backend de mi carril (grep de controllers, antes de cablear)

- **NCR** (`/ncr`, sin guards): `GET /ncr?partNumber&status&workOrder` ·
  `GET /ncr/:id` · `POST /ncr` (el controller usa `@Body() dto: any` → el cuerpo
  pasa crudo; `createdBy` es NOT NULL en la entidad, hay que enviarlo) ·
  `PATCH /ncr/:id/status` `{ status, actor }` (la transición NO se valida en el
  backend → la UI ofrece solo transiciones válidas).
- **Quality** (`/quality`, `JwtAuthGuard + PermissionsGuard`): holds activos,
  transfers de cuarentena, **dispositions**, **CAPA** (`GET/POST /quality/capas`,
  `PATCH /quality/capas/:id`; la CAPA liga a NCR por la relación `ncr`), IQC, OQC.
  Lecturas sin permiso explícito (cualquier autenticado); escrituras requieren
  `QUALITY_WRITE`/`QUALITY_APPROVE`.
- **Floor-quality** (`/floor-quality`): cola de holds (`?status&part`), KPIs,
  where-used (genealogía), detalle, crear hold, MRB, **disposition**, rework,
  reinspect, close. Máquina de estados pura `hold-state.ts`.
- **Testing** (`/testing`): `GET /testing/kpis` (yield, **FPY**, **Pareto** de
  fallas — ya derivado en backend), `records`, `records/recent`, `records/:id`,
  `POST /testing/records`.

**Hallazgos clave de no-duplicación:**
- `dashboard/test-engineering` (FUERA de mi carril) ya cablea la **captura**
  pass/fail + KPIs de testing, pero dibuja el Pareto con barras CSS, no recharts.
  → No dupliqué la captura; construí la **analítica** (yield/FPY + Pareto recharts)
  en mi carril y enlazo a test-engineering para capturar.
- `dashboard/floor-quality` (MÍO) ya tenía el ciclo hold→MRB→disposición
  funcional (con `window.prompt`). Lo dejo y lo pulo como punto débil de mi área.
- `dashboard/lab` (fuera de carril) es una lanzadera que lee KPIs de `/ncr`.

---

## Ítem 1 — NCR: lista + filtros + KPIs + alta (cockpit) ✅

`quality/page.tsx` pasó de ser una lista read-only a un **cockpit de NCR** real:
- **KPIs derivadas** del API real (`/ncr`): abiertas, críticas abiertas, cerradas,
  total (no existe `/ncr/kpis`, se derivan en cliente con helper puro).
- **Filtros** client-side: búsqueda (folio/NP/defecto/categoría), estado,
  severidad, origen y **modelo** (espina dorsal, `/product-models`). Estado vacío
  honesto: "Sin NCRs → Levanta la primera" y "Sin resultados → Limpiar filtros".
- **Alta** (`POST /ncr`): NP, categoría, descripción, severidad, origen, cantidad
  + contexto opcional (modelo, WO, lote, serial, línea, cliente, programa);
  inyecta `createdBy` = email del usuario (NOT NULL). Toast + refresh.
- Cada NCR enlaza a `quality/ncr/:id` (detalle, ítem 2).
- Tipos/utils reescritos para reflejar el backend REAL (antes eran ficticios):
  `quality.types.ts` (NCR/CAPA/TestingKpis/ModelOption) + `quality.utils.ts`
  (metadata estado/severidad/origen, máquina de transiciones, KPIs, Pareto puro)
  + `quality.ui.tsx` (átomos Kpi/Field/Empty compartidos por las 3 rutas).
- Puertas: `tsc` 0, `eslint` 0. (build completo tras heredar CI de main.)

### ▶ RETOMAR AQUÍ (carril S2)
- Siguiente: ítem 2 (detalle NCR + transiciones PATCH + CAPA), ítem 3 (analítica
  yield/FPY + Pareto recharts), ítem 4 (pulir floor-quality: modal de disposición
  en vez de `window.prompt` + filtro de estado).
