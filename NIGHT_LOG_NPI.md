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
