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

## Ítem 2 — NCR: detalle + transiciones de estado + CAPA ✅

`quality/ncr/[id]/page.tsx` (ruta nueva en mi carril, `useParams` como el resto
del repo):
- **Detalle completo** de la NCR (`GET /ncr/:id`): descripción, severidad, origen,
  cantidad, modelo/WO/lote/serial/edificio/almacén/línea/cliente/programa, autor,
  fechas, notas de disposición (read-only — el backend no expone update genérico,
  solo `PATCH status`; honesto).
- **Transiciones válidas** con `PATCH /ncr/:id/status` `{ status, actor }`. La UI
  solo ofrece el siguiente paso del ciclo (open→under_review→contained→
  dispositioned→closed) vía la máquina de estados pura; mini-stepper visual.
- **CAPA ligadas**: `GET /quality/capas` filtrado por la relación `ncr.id`; abrir
  CAPA con `POST /quality/capas` `{ ncr:{id}, partNumber, problemStatement,
  priority, createdBy, ... }` (TypeORM fija el FK desde `ncr:{id}`). Prioridad
  pre-sugerida por severidad de la NCR. Estado honesto si falta permiso
  (`QUALITY_WRITE`) o sesión.
- Puertas: `tsc` 0, `eslint` 0. (build verde en CI.)

## Ítem 3 — Test/Lab: yield, FPY y Pareto de defectos (recharts) ✅

`quality/analytics/page.tsx` (ruta nueva en mi carril). No dupliqué la captura
(vive en `test-engineering`, fuera de carril); construí la **analítica** que
faltaba con datos reales:
- **Yield** y **First-Pass Yield** desde `GET /testing/kpis` (ambos derivados en
  backend) como tarjetas KPI; + fallas de prueba y NCR abiertas/críticas.
- **Pareto de defectos con recharts** (`ComposedChart`: barras de cantidad + línea
  de % acumulado + referencia 80/20). Toggle de fuente: **fallas de prueba**
  (`testing.pareto`) vs **categorías de NCR** (derivado de `/ncr`). Ambas reales.
- Estado honesto si falta sesión/permiso de calidad (yields ocultos, Pareto de NCR
  sigue disponible) y estado vacío por fuente sin datos. Enlace a la captura.
- Bundle con el ítem 2 en el PR #274 (ambos verdes, mismo carril) para mantener el
  árbol limpio entre turnos. Puertas: `tsc` 0, `eslint` 0, `next build` ✅.

## Ítem 4 — Floor-quality / MRB: modales de disposición y re-inspección + filtro ✅

`floor-quality/page.tsx` (mío) ya tenía el flujo hold→MRB→disposición funcional,
pero usaba `window.prompt`/`window.confirm` (UX frágil y propensa a error). Pulido
sin cambiar el contrato del backend:
- **Modal de disposición**: select de disposición (con etiquetas ES), firma
  obligatoria, notas, y campos condicionales **waiver** (USE_AS_IS) / **SCAR**
  (RTV) con validación en cliente antes de `POST …/disposition`. (El backend
  igual exige waiver/SCAR; ahora el usuario lo ve y no se pierde el texto si falla.)
- **Modal de re-inspección**: toggle Pasa/Falla + horas de retrabajo + cantidad a
  scrap (si falla) → `POST …/reinspect`. Reemplaza el `confirm` binario.
- **`act()` ahora devuelve boolean**: el modal solo cierra si el POST tuvo éxito
  (no se pierde lo capturado ante un error de validación/red).
- **Filtro por estado** (chips con conteos) incl. ver **cancelados** (antes no
  eran visibles); vista por defecto = flujo activo. Etiqueta de disposición legible
  en las tarjetas (`DISP_LABELS`).
- Puertas: `tsc` 0, `eslint` 0, `next build` ✅.

## Ítem 5 — IQC / OQC: inspecciones de recibo y salida ✅

`quality/inspections/page.tsx` (ruta nueva en mi carril, 2 pestañas). Surfaceé el
engine de inspección que ya existía sin UI:
- **IQC (recibo)**: lista (`GET /quality/iqc`) con KPIs (pasa/falla/condicional) +
  filtro por resultado; alta (`POST /quality/iqc`) con NP, lote, resultado,
  muestra, defectos, almacén, inspector (= usuario), notas. Nota honesta: PASS
  libera `pending_iqc`; FAIL dispara hold de calidad automático (lo hace el backend).
- **OQC (salida)**: **backlog** (`GET /quality/oqc/backlog` = posiciones
  `pending_oqc`) con botón "Inspeccionar" que prellena el alta; **historial**
  (`GET /quality/oqc/history`); alta (`POST /quality/oqc/inspections`) con WO, NP,
  cantidad inspeccionada/NG (OK calculado), resultado, defecto, notas. Nota: el
  resultado aplica al stock `pending_oqc` en WH-FG (PASS→disponible, FAIL→hold,
  CONDITIONAL→cuarentena).
- Enlace "Inspecciones" agregado al header del cockpit de NCR. Tipos IQC/OQC
  centralizados en `quality.types.ts`.
- Puertas: `tsc` 0, `eslint` 0, `next build` ✅.

## Ítem 6 — Holds de inventario + engine de disposición (nivel inventario) ✅

`quality/holds/page.tsx` (ruta nueva). Surfaceé el engine de holds/disposición a
nivel **inventario** (tablas `quality_holds`/`dispositions`), distinto del hold de
piso (`sf_quality_holds` en `floor-quality`):
- **Holds activos** (`GET /quality/holds/active`): NP + nivel (NP/lote/serial/
  almacén/edificio/programa/WO) + razón; crear (`POST /quality/holds`) marca
  `holdStatus=hold` en las posiciones que coincidan; **liberar**
  (`PATCH /quality/holds/:id/release`).
- **Disposiciones** (`GET /quality/dispositions`): flujo **proponer → aprobar →
  ejecutar** (`POST /quality/dispositions`, `PATCH …/approve`, `PATCH …/execute`).
  Ejecutar impacta inventario (SCRAP/RTV decrementan; RELEASE/USE_AS_IS liberan) y
  cierra NCR/hold ligados — nota honesta en UI. Proponer desde un hold lo prellena.
- Botones de acción gateados por estado; toasts honestos ante 403 (QUALITY_WRITE/
  APPROVE). Enlace "Holds inv." en el cockpit. Tipos centralizados en quality.types.
- Deuda menor anotada: hay un `Modal` local aquí y en `inspections`; extraer a
  `quality.ui` si crece el reuso.
- Puertas: `tsc` 0, `eslint` 0, `next build` ✅.

## Ítem 7 — Traslados de cuarentena (containment completo) ✅

Extiende `quality/holds/page.tsx` con el flujo de **traslado a cuarentena** que
cierra la contención física:
- Botón "Trasladar a cuarentena" en cada hold activo → modal (`POST
  /quality/transfers` con `holdId`, cantidad, almacén/ubicación origen→destino;
  `requestedBy` = usuario). El backend deriva el NP del hold.
- Sección **"Traslados a cuarentena"** (`GET /quality/transfers`) con estado y
  acción **Completar** (`PATCH /quality/transfers/:id/complete`) que mueve el
  inventario (ledger TRANSFER) y deja la posición destino en `quarantine`.
- Tipos en quality.types; toasts honestos ante 403.
- Puertas: `tsc` 0, `eslint` 0, `next build` ✅.

### ▶ RETOMAR AQUÍ (carril S2)
- **Loop de calidad cerrado de punta a punta en UI** sobre el backend existente,
  todo verde y mergeado:
  - **NCR**: cockpit (lista/filtros/KPIs/alta) + detalle + transiciones + CAPA.
  - **MRB / piso** (`floor-quality`): hold→MRB→disposición con modales + filtro.
  - **Test/Lab** (`quality/analytics`): yield/FPY + Pareto de defectos (recharts).
  - **IQC/OQC** (`quality/inspections`): recibo y salida.
  - **Holds de inventario** (`quality/holds`): hold + disposición (proponer→
    aprobar→ejecutar) + **traslado a cuarentena** (solicitar→completar).
- Deuda menor (cosmética, NO bloqueante): adoptar `PageHeader` en `floor-quality`
  (hoy header propio). Tareas backend para mañana: ninguna bloqueó este carril
  (todo se cableó sobre endpoints existentes).

## Ítem 8 — Higiene: `Modal` compartido (de-duplicado) ✅

`quality.ui.tsx` ahora exporta un `Modal` genérico (shell + footer + `QInputStyle`).
`inspections` y `holds` lo importan en vez de tener cada uno su copia local idéntica
(AGENTS.md §3, espíritu de `/simplify`). Sin cambio funcional; imports muertos
removidos. Puertas: `tsc` 0, `eslint` 0, `next build` ✅.
