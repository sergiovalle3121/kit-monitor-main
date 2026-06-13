# NIGHT_LOG_NPI — Carril S5 · Ingeniería de Manufactura (NPI)

> Sesión nocturna en paralelo. Rama `claude/zen-cray-gtja5d`.
> Carril S5 — archivos permitidos:
> - Front: `apps/web/src/app/dashboard/{industrial-engineering, engineering, lab}`
>   y `dashboard/line-engineering` (disposición de líneas).
> - Backend (reuso/GREP): engineering, bom, process-routing, bay-layout,
>   line-engineering, visual-aids.
> Prohibido esta sesión: migraciones, entidades TypeORM, `app.module.ts`,
> `dashboard/page.tsx` (nav), componentes compartidos (PageHeader, IconTile,
> utils glass/motion). Cero mock; todo del API real; estado vacío honesto.

---

## Reconocimiento (GREP de controllers) — endpoints existentes a reusar

**process-routing** (`@Controller('process')`):
- `GET /process/routes?model=&revision=` → ruta ordenada (steps + materials).
- `POST /process/steps`, `PATCH /process/steps/:id` (acepta `visualAidId`),
  `DELETE /process/steps/:id`, `POST /process/steps/:id/materials`,
  `DELETE /process/materials/:id`.
- ⚠️ `ProcessStep` **NO tiene tiempo estándar** (solo `visualAidId`,
  `instructions`, materiales). Añadir columna = tocar entidad → PROHIBIDO.

**line-engineering** (`@Controller('line-engineering')`):
- `GET /stations`, `/routing`, `/requirements`, `/qualifications`,
  `/balance` (takt/cycle/cuello/%balance/throughput + completeness),
  `/capacity`, `/kpis`, `/stations/:id`.
- `POST /stations` (con `stdTimeSec`, `visualAidUrl`, `npExpected`, `useFactor`,
  `ctq`), `PATCH /stations/:id`, `POST/PATCH /qualifications`.
- ✅ `SfLineStation` **SÍ tiene `stdTimeSec` + `visualAidUrl`** por estación →
  es el ruteo "con tiempo estándar y ayuda visual por paso" del enunciado, y la
  base del yamazumi.

**visual-aids** (`@Controller('visual-aids')`):
- `GET /visual-aids?model=&programId=` → {id, model, title, process, area,
  revision, pdfUrl(filename), isActive, notes}.
- `POST` (multipart), `PATCH/:id`, `DELETE/:id`.
- `GET /visual-aids/file/:filename` → sirve el PDF/imagen inline.

**bom** (`@Controller('bom')`):
- SAP: `GET /bom/headers?model=&status=` → headers **con `components`**
  (relación cargada). `GET /bom/headers/:id`, `/tree`, `POST/PATCH`,
  `components`, `approve`, `activate`.
- ⚠️ **No existe** endpoint where-used ni AVL. `getRoute` where-used se puede
  derivar **en cliente** desde `/bom/headers` (trae components) → cero backend.

**AVL:** el backend NO expone lista de proveedores aprobados en mi carril.
Hay `erp-supplier-price` en `erp-core` (FUERA de carril). → AVL queda como
**tarea backend para mañana**; en UI estado honesto deshabilitado.

**recharts:** declarado en `apps/web` (`^3.8.1`), ya usado en cost-rollup,
mission-control, forecast, erp. Disponible para el yamazumi.

---

## Plan de rebanadas (todo frontend → cero riesgo de migración)

1. **Yamazumi** (line-engineering): gráfica recharts ciclo por estación vs takt,
   desde `/balance` + ruteo. Cuello = barra sobre la línea de takt.
2. **Ayuda visual real por estación** (line-engineering): selector desde
   `/visual-aids?model=` en vez de URL libre; columna "Ayuda" como link.
3. **Ayuda visual por paso** (engineering/process-routing): selector `visualAidId`
   por paso (backend ya lo soporta) + nota honesta de "tiempo estándar" (pendiente
   backend; el ruteo con tiempo vive en Disposición de líneas).
4. **BOM where-used** (engineering): panel "¿dónde se usa?" derivado en cliente de
   `/bom/headers`. AVL = estado honesto deshabilitado (pendiente backend).

---

## Avance

### Rebanada 1 — Yamazumi (line-engineering) ✅
- `dashboard/line-engineering/page.tsx`: componente `Yamazumi` (recharts) en el
  panel de balanceo. Una barra por estación = tiempo estándar (ordenado por
  secuencia) contra una **línea de referencia de takt**. Barras sobre takt en
  rojo (cuello de botella), el resto en azul. Tooltip con el ciclo en segundos.
- Datos desde lo que YA existe: `route` (estaciones del modelo+rev) + `balance.taktSec`
  de `/line-engineering/balance`. El gráfico y los KPIs nunca se contradicen
  (misma fuente de tiempos). Estado vacío honesto si no hay tiempos capturados.
- Puertas (apps/web): `tsc --noEmit` 0 · `eslint` 0 errores (1 warning preexistente
  ajeno en `models` useMemo) · `next build` OK.
- Antes del PR: `git merge origin/main` (heredé el workflow CI de main) — fast-forward.
- PR #268 → CI verde (4 puertas) → merge squash. Rama re-sincronizada a main.

### Rebanada 2 — Ayuda visual por paso (engineering / process-routing) ✅
- `dashboard/engineering/page.tsx`: cada paso del ruteo ahora puede **adjuntar una
  ayuda visual** de la biblioteca (`GET /visual-aids?model=`), guardando
  `visualAidId` vía `PATCH /process/steps/:id` (el backend ya lo soportaba; solo
  faltaba UI). Muestra el título con link "abrir" (fetch autenticado→blob, igual
  que la pantalla de Ayudas visuales) y opción "Quitar".
- Estados honestos: si el modelo no tiene ayudas → link para subirlas; si el paso
  trae un `visualAidId` que no pertenece al modelo/rev actual → "adjunta (otro
  modelo/rev)" + Quitar.
- **Tiempo estándar por paso:** `process_steps` NO tiene columna de tiempo y
  tocar la entidad está PROHIBIDO esta sesión → en vez de un input falso, una
  **nota honesta** que apunta a *Disposición de líneas* (donde el ruteo SÍ lleva
  `stdTimeSec` y alimenta el yamazumi).
  - **Tarea backend para mañana:** añadir `stdTimeSec` (nullable/default) a
    `process_steps` + DTO + exponerlo en `/process/routes`, para unificar tiempos
    de proceso con el balanceo.
- Puertas (apps/web): `tsc` 0 · `eslint` 0 · `next build` OK.

### Rebanada 3 — BOM where-used + nota AVL (engineering) ✅
- `dashboard/engineering/page.tsx`: panel colapsable **"¿Dónde se usa? · Where-used
  de BOM"**: escribe un número de parte y lista cada BOM (modelo · rev, estado)
  que lo consume, con cantidad × factor de uso, designador de referencia y estado.
- **Cero backend nuevo:** derivado en cliente de `GET /bom/headers` (que ya trae
  `components`); carga perezosa (solo al abrir el panel). Estados vacíos honestos.
- **AVL:** el backend de compras NO expone lista de proveedores aprobados por
  parte (hay `erp-supplier-price` en erp-core, fuera de carril). → nota honesta
  "tarea backend pendiente"; sin UI falsa.
  - **Tarea backend para mañana:** endpoint AVL por parte (proveedores aprobados,
    precio, lead time) sobre erp-core/procurement.
- Nota: consolidada en el PR #273 (mismo archivo/área que la rebanada 2) como
  segundo commit, para no dejar cambios sin commitear (stop hook) y mantener un
  PR por página. Puertas (apps/web): `tsc` 0 · `eslint` 0 · `next build` OK.
- PR #273 → CI verde → merge squash. Rama re-sincronizada a main.

### Rebanada 4 — Editar estaciones + selector de ayuda + link clicable (line-engineering) ✅
> Siguiente punto débil del carril: hoy solo se podían **crear** estaciones, no
> ajustarlas → no se podían afinar tiempos y ver el yamazumi/balanceo actualizarse.
- `dashboard/line-engineering/page.tsx`:
  - **Editar estación**: botón ✎ por fila → abre el modal precargado y hace
    `PATCH /line-engineering/stations/:id` (campos editables del DTO: secuencia,
    NP, factor de uso, **tiempo std**, ayuda visual, CTQ). Modelo/línea/estación/rev
    quedan read-only (el PATCH no los toca). Al guardar, refresca balanceo+yamazumi.
  - **Selector de ayuda visual** en crear/editar: elige de la biblioteca
    (`/visual-aids?model=`) y rellena `visualAidUrl` con la URL servida; se mantiene
    el campo manual para URLs externas.
  - **Columna "Ayuda" clicable**: link "Ver" que abre la ayuda (antes solo un ícono).
- Backend ya soportaba todo (`updateStation`); solo faltaba UI. Cero backend nuevo.
- Puertas (apps/web): `tsc` 0 · `eslint` 0 (1 warning preexistente ajeno) · `next build` OK.
- PR #279 → CI verde → merge squash. Rama re-sincronizada a main.

### Rebanada 5 — Takt real en balanceo/yamazumi (line-engineering) ✅
> Bug detectado: la página llamaba `/balance` **sin takt** → `taktSec=0`, así que
> el yamazumi no dibujaba la línea de takt, la métrica "Takt" salía 0s y nunca se
> detectaban cuellos (stationsOverTakt vacío). El balanceo estaba a medias.
- `dashboard/line-engineering/page.tsx`:
  - Takt efectivo = **override manual** (input en el panel) → si vacío, el
    **takt de la calificación** del modelo (model+rev, luego cualquier qual del
    modelo). Se pasa como `&taktTargetSec=` a `/balance` (auto-refetch).
  - El input muestra como placeholder el takt de la calificación; botón "Reset".
  - Si no hay takt (ni override ni calificación) → aviso honesto para definirlo o
    calificar el modelo. El override se limpia al cambiar de modelo.
- Ahora el yamazumi dibuja la línea de takt real y resalta cuellos; "Takt"/"Cycle"
  comparan de verdad. Cero backend nuevo (reusa `/balance` + `/qualifications`).
- Puertas (apps/web): `tsc` 0 · `eslint` 0 (1 warning preexistente ajeno) · `next build` OK.
