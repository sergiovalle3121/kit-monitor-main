# Herramienta CAD de AXOS OS — Resumen para continuar el desarrollo

> **Propósito de este documento:** dar a un desarrollador (Codex/ChatGPT) el contexto
> completo de qué es, cómo está construida y dónde quedó la herramienta CAD de
> ingeniería de líneas, para que pueda seguir trabajando sin leer las ~6.000 líneas
> de los editores.
>
> **Estado al corte:** se han implementado **65 "Fases"** incrementales. El último
> trabajo grande fue **unificar el CAD 2D y 3D en un solo editor** y agregar
> herramientas tipo CAD (medir, muros, acotado automático, snap a DXF, métricas de
> flujo, revisión de diseño, export PDF). El módulo es funcional de punta a punta.

---

## 1. Qué es

La "herramienta de CAD" es el módulo **Line Engineering / Disposición de líneas**
(`/dashboard/line-engineering`). Sirve para que un **ingeniero industrial** diseñe el
*layout físico* de una línea de manufactura electrónica (EMS): coloca estaciones,
equipos, muros y flujo de material sobre una huella (footprint) a escala real,
valida el diseño y lo libera con un flujo de aprobación.

Conviven **dos vistas** en la página:
- **Balanceo** (tabla/Yamazumi/capacidad) — la vista "lista" tradicional.
- **CAD** — el editor gráfico unificado 2D⇄3D (lo nuevo y el foco de este doc).

Se selecciona por `model` + `revision`. Cada layout es **per-tenant / per-plant** y
**aditivo**: no toca el ruteo ni el balance lógico, solo agrega coordenadas físicas.

---

## 2. Arquitectura y ubicación de archivos

### Frontend — `apps/web/src/components/line-engineering/`
| Archivo | Líneas | Rol |
| --- | --- | --- |
| `Layout3DEditor.tsx` | ~3.029 | **Editor unificado** (Three.js). Es el editor principal; incluye modos 3D/Plan/Walkthrough. Es el que monta la pestaña "CAD". |
| `LayoutEditor.tsx` | ~2.385 | Editor 2D basado en **Fabric.js** (canvas). Carril previo a la unificación; gran parte de su lógica se portó al 3D. |
| `Layout3D.tsx` | ~338 | Visor 3D ligero (read-only / preview). |
| `asset-catalog.ts` | ~114 | Catálogo de equipos colocables (dimensiones, color, altura 3D, arquetipo). |
| `dxf.ts`, `dxf-snap.ts`, `dxf-walls.ts` | — | Parseo de DXF, snap a vértices/medios, conversión DXF→muros. |
| `auto-dimensions.ts` | ~120 | Acotado automático (overall + pitches centro a centro). |
| `arrange-line.ts`, `connect-line.ts` | — | Auto-acomodo en filas serpentina y auto-conexión por secuencia. |
| `design-checks.ts`, `flow-metrics.ts` | — | Validación de diseño y métricas de flujo (cliente). |
| `plot-sheet.ts` | ~97 | Hoja de KPIs para el reporte/plano. |
| `Minimap.tsx`, `LayoutHistory.tsx` | — | Minimapa navegable y bitácora de auditoría. |
| ~16 paneles de análisis | — | `YamazumiChart`, `WhatIfSimulator`, `BufferPlanner`, `OperatorLoops`, `ClearanceAnalysis`, `LayoutScorecard`, `LineContinuity`, `LineCohesion`, `LineDensity`, `CostEstimator`, `SensitivityChart`, `ScenarioCompare`, `StandardWork`, `DossierExport`, `FlexLine`, `ChangeoverMatrix`. Lazy-loaded (`dynamic()`), abren en modal. |

### Página — `apps/web/src/app/dashboard/line-engineering/page.tsx`
Carga estaciones, calificaciones modelo↔línea, KPIs y balance. Tabs **Balanceo** / **CAD**.
El editor CAD se monta solo al abrir la pestaña (`ssr:false`).

### Backend — `apps/api/src/modules/line-engineering/`
- `line-engineering.controller.ts` (~880 líneas, **~60 endpoints** bajo `/api/line-engineering`).
- `line-engineering.service.ts` (~2.941 líneas) — lógica de negocio.
- ~30 módulos puros de análisis con sus `.spec.ts` (cobertura de tests sólida):
  `line-balance`, `line-buffer`, `line-clearance`, `line-cohesion`, `line-collision`,
  `line-compare`, `line-continuity`, `line-cost`, `line-density`, `line-dossier`,
  `line-dxf`, `line-flexline`, `line-flow`, `line-flowdir`, `line-cellflow`,
  `line-loops`, `line-optimize`, `line-autoarrange`, `line-review`, `line-scorecard`,
  `line-sensitivity`, `line-staffing`, `line-stdwork`, `line-changeover`, `line-takeoff`.
- `entities/`: `sf-line-layout.entity.ts`, `sf-line-station.entity.ts`, `sf-model-line.entity.ts`.
- `station-bay.service.ts`, `station-status.service.ts` — bahías y estado en vivo (MES).

### Persistencia — tabla `sf_line_layouts` (entidad `SfLineLayout`)
Una fila por `model+revision` (scoped por tenant/plant). Columnas relevantes:
- Footprint: `footprintW`, `footprintH`, `unit` (`mm`/`m`), `gridSize`.
- Aprobación: `approvalStatus` (draft/in_review/approved), `approvedBy/At`, `approvalNote`.
- DXF de fondo: `dxfData` (texto), `dxfName`, offset/scale/rotation/visible/opacity.
- JSON: `connectors[]`, `assets[]`, `annotations[]`, `cells[]`, `snapshots[]`.
- Las coordenadas de **estación** viven aditivamente en `sf_line_stations`
  (`layout_x/y/w/h/rotation`), no en esta tabla.

> Regla de oro del repo: **cambios de entidad solo aditivos** (nullable o con default;
> nada de DROP/rename/NOT NULL). Prod usa `synchronize: true` (esquema desde entidades).

---

## 3. Funcionalidad del editor (lo que YA hace)

### Modos de cámara / vista (Three.js + OrbitControls, WebGLRenderer)
- **3D Orbit** — órbita libre con damping, zoom rueda, pan clic derecho.
- **Plan (2D)** — cámara cenital bloqueada (sin rotación); equivale a un plano CAD.
- **Walkthrough** — primera persona, WASD para caminar, arrastrar para mirar.
- Vistas preestablecidas: isométrica, superior, frontal.
- 4 temas de render: dark / light / night / studio. Niebla, sombras PCFSoft (2048²),
  luz direccional con azimut/elevación ajustables (sol).

### Edición de objetos
- Selección simple / multi (Shift+clic) / todo (Ctrl+A) / Esc.
- Mover por drag sobre el piso (raycast al plano y=0), **clamp al footprint**.
- **Snap**: a grilla, a unidad entera, y **object-snap (osnap)** alineando bordes/centros
  con otros objetos y con el footprint (guías cian temporales).
- **Nudge** con flechas (Shift = ×5).
- Rotar: `R` (+15°), `Shift+R` (−15°), o input numérico.
- Escala: inputs W/H en el panel de propiedades (**no hay gizmo visual de resize**).
- Duplicar (`Ctrl+D`, solo assets), borrar (Supr/Backspace).
- **Alinear** (≥2): izq/centro/der, arriba/medio/abajo.
- **Distribuir** (≥3): horizontal/vertical con gap parejo.
- **Array** (cols×rows), **Mirror** (H/V con rotación compensada), **Offset** (dx/dy).
- **Undo/Redo** (`Ctrl+Z` / `Ctrl+Shift+Z` o `Ctrl+Y`), pila de hasta 80 snapshots.

### Herramientas tipo CAD
- **Medir (M)**: dos puntos → cota con distancia (snap a grilla o DXF).
- **Muros (W)**: cadena de clics → polilínea de assets `wall`; Shift constriñe a ±45°.
- **Acotado automático**: genera cotas de footprint + pitches centro a centro.
- **Auto-acomodo** de estaciones por secuencia en filas.
- **Auto-conexión** por secuencia (flow/conveyor/return) con curvas Bézier.
- **Optimización de flujo** (server): reordena para minimizar recorrido, reporta % mejora.

### Tipos de objeto 3D (catálogo de assets, ~16 arquetipos)
`table`, `belt` (conveyor), `shelf` (rack), `arm` (robot), `machine` (CNC/AOI/horno/printer),
`wall`, `cabinet`, `column`, `pallet`, `fence`, `cart`, `person` (operador), `desk`,
`bin`, `gantry` (grúa puente), más `zone`/`path` (planos translúcidos, sin altura).
Cada uno con geometría construida con primitivas (`buildArchetype()`), color, altura,
roughness y metalness propios. Estaciones = `BoxGeometry` (rosa, ámbar si CTQ; opcional
modo "Yamazumi" donde la altura ∝ tiempo de ciclo).

### Conectores y celdas
- Conectores dirigidos entre estaciones: `flow` (azul), `conveyor` (púrpura), `return` (gris).
  Hoy se generan con auto-connect; **no hay edición manual fina de conectores**.
- Celdas/zonas: agrupación nombrada de estaciones con tinte translúcido en el piso.

### Overlays / datos vivos sobre el layout
- **MES en vivo** (estado estación: down/warn/ok/idle, poll 5s).
- **Heatmap** de ocupación / tiempo de ciclo (cold→over).
- **Completitud documental** (NP, factor de uso, ayuda visual).
- **Bahías** que surten cada estación.
- **Calidad** acumulada (defectos + holds).
- **Holguras/clearance** (pares demasiado juntos = ámbar, traslape = rojo).

### Import / Export
- **Importar DXF** de fondo (plano de planta): se posiciona (offset/scale/rotation/opacity),
  se puede **convertir a muros editables** y **hacer snap** a sus vértices.
- **Exportar**: PNG, PDF (con cajetín/title block), **GLB** (glTF binario para Blender),
  **DXF por capas** (server), CSV (schedule de estaciones), y **dossier** (JSON+CSV de KPIs).

### Gobierno / versionado
- Flujo de **aprobación**: draft → in_review → approved (con quién/cuándo/nota).
- **Snapshots** nombrados: guardar / restaurar / diff / borrar.
- **Bitácora de auditoría** (`/layout/history`): save, approval, clone, dxf, snapshot.
- **Clonar** desde otro modelo/revisión (plantilla).

---

## 4. Análisis integrado (paneles + endpoints backend)

Cada panel del menú "Análisis" tiene su endpoint y módulo puro testeado:

| Panel | Endpoint (`/api/line-engineering/...`) | Qué calcula |
| --- | --- | --- |
| Balanceo / Yamazumi | `GET /balance` | ciclo por estación vs takt, cuello, % balance, throughput |
| Capacidad | `GET /capacity` | min requeridos vs disponibles, utilización, veredicto |
| Takeoff (cantidades) | `GET /layout/takeoff` | áreas, conteos, utilización, longitud de muros |
| Clearance | `GET /layout/clearance` | holguras/pasillos mínimos |
| Scorecard | `GET /layout/scorecard` | índice de readiness del layout |
| Continuidad | `GET /layout/continuity` | ¿el flujo es un camino continuo? |
| Cohesión | `GET /layout/cohesion` | ¿celdas bien agrupadas? |
| Densidad | `GET /layout/density` | mapa de ocupación |
| Staffing / Loops | `GET /layout/staffing`, `/operator-loops` | operadores mínimos, bucles de trabajo |
| Buffers | `GET /layout/buffers` | WIP/desacople entre estaciones |
| Costo / Sensibilidad | `GET /layout/cost`, `/sensitivity` | costo por unidad; costo vs demanda |
| Comparar escenarios | `GET /layout/compare` | A vs B lado a lado |
| Standard Work | `GET /layout/standard-work` | trabajo manual + caminado vs takt |
| Flex Line | `GET /layout/flex-line` | línea multi-modelo |
| Changeover / SMED | `GET /layout/changeover` | matriz de cambio de modelo |
| Flujo | `GET /layout/flow`, `/flow-direction`, `/cell-flow` | distancia, dirección, inter-celda |
| Colisiones | `GET /layout/collisions` | traslapes / fuera de límites |
| Auto-arrange / optimize | `GET /layout/auto-arrange`, `/optimize` | sugerencias de acomodo |
| Reporte / Dossier | `GET /layout/report`, `/dossier` | KPIs consolidados |
| Completitud | `GET /layout/completeness` | documentación faltante |

**CRUD/estado del layout:** `GET/PUT /layout`, `PUT /layout/approval`,
`POST /layout/clone`, `GET /layout/cells`, DXF (`GET/PUT/DELETE /layout/dxf`,
`GET /layout/dxf-export`), overlays (`/layout/status|quality|bays|heatmap`),
snapshots (`GET/POST /layout/snapshots`, `/:id/restore|diff`, `DELETE /:id`),
`GET /layout/history`. Estaciones y calificaciones: `stations`, `qualifications`.

---

## 5. Atajos de teclado

| Tecla | Acción |
| --- | --- |
| `V` / `M` / `W` | herramienta seleccionar-mover / medir / muros |
| `Esc` | deseleccionar / salir de herramienta |
| `Ctrl+A` | seleccionar todo |
| `Ctrl+Z` / `Ctrl+Shift+Z` o `Ctrl+Y` | deshacer / rehacer |
| `Supr` / `Backspace` | borrar selección |
| `R` / `Shift+R` | rotar +15° / −15° |
| `Ctrl+D` | duplicar (assets) |
| Flechas (`Shift`=×5) | nudge |
| Rueda | zoom · WASD | caminar (walkthrough) |
| `?` / `Shift+/` | ayuda |

---

## 6. Estado, deuda técnica y oportunidades (dónde seguir)

### Carriles paralelos / a consolidar
- **`LayoutEditor.tsx` (2D Fabric) vs `Layout3DEditor.tsx` (unificado)**: la unificación ya
  ocurrió y el editor 3D es el canónico, pero el 2D Fabric sigue en el repo. Hay comentarios
  `// unify` marcando lógica duplicada (approval, overlays, versions, DXF, cells). **Candidato
  a limpieza/retiro del carril 2D** una vez verificada la paridad.

### Funcionalidad incompleta o básica
- **Sin gizmo visual de resize**: escalar es solo por inputs numéricos.
- **Conectores no editables a mano**: solo auto-connect; falta crear/borrar/redirigir uno a uno.
- **Edición de celdas/zonas básica** (crear/borrar) sin herramientas finas.
- **Snap a grilla sin preview** de la posición "snapped" durante el drag.
- Algunos paneles de análisis comparten props 2D estándar y **no tienen versión 3D nativa**.
- Helpers listos pero con integración de UI parcial en el carril 2D (auto-dim, DXF→walls);
  en el 3D ya están cableados.

### Ideas de siguiente fase (Fase 66+)
- Gizmo de transformación (move/rotate/scale) tipo `TransformControls` de Three.js.
- Edición manual de conectores y ruteo de conveyor con waypoints.
- Biblioteca de assets ampliable por el usuario (importar GLTF propios).
- Colisiones en tiempo real durante el drag (no solo bajo demanda).
- Colaboración multiusuario / comentarios sobre el plano.
- Medidas y cotas con tolerancias y estándares (acotado GD&T ligero).

---

## 7. Cómo correrlo

```bash
npm install && npm run dev    # API :3000 (bajo /api), web :3001
# Navegar a  http://localhost:3001/dashboard/line-engineering  → pestaña "CAD"
```
Sin `DATABASE_URL` usa SQLite. Tests del backend: `cd apps/api && npm test`
(el módulo tiene amplia cobertura `*.spec.ts`). Lint web: `cd apps/web && npm run lint`.

### Convenciones del repo (importantes para Codex)
- Frontend: Next.js App Router + TypeScript + **Tailwind only** + shadcn/ui. Three.js para 3D.
- Backend: NestJS + TypeORM. **Cambios de entidad solo aditivos.**
- No duplicar módulos/componentes (revisar antes de crear). Documentar en `/docs` si cambia arquitectura.
- Commits Conventional Commits; PR → `main` con **squash**. CI bloqueante: build+test API, lint+build web, smoke bootstrap.
- El patrón de fases (`// Fase N`) documenta el crecimiento incremental; vamos en la **Fase 65**.
