# AXOS OS — Night Log · Carril S1 (Operador / Terminal de estación)

Bitácora del carril S1. Archivos permitidos: SOLO
`apps/web/src/app/dashboard/operator-terminal`, `.../mes-execution`, `.../production`
(y sus componentes locales). Backend a consumir: operator-terminal (10),
mes-execution (13), production-runtime (17), + visual-aids para ayuda visual.
Cero mock. Reuso de endpoints existentes. Puertas web: eslint + tsc + next build.

> Esta bitácora es propia del carril; NO se edita `NIGHT_LOG.md` ni se tocan
> componentes compartidos, nav del hub, entidades, migraciones ni `app.module.ts`.

---

## 2026-06-13 — Terminal de operador: herramienta de estación REAL (rama `claude/practical-hypatia-60nims`)

### Decisión de arquitectura (qué backend consume cada página)
GREP de los 3 controllers + las páginas existentes del hub:
- **El board MES (`/mes/*`, 13 endpoints) YA tiene página**: `dashboard/operador`
  (1176 líneas, board paso-a-paso con visual-aids, serial/lote, incidencias,
  andon, hourly). Crear `dashboard/mes-execution` lo **duplicaría** → NO se crea
  (regla "No Duplication"). El nav (prohibido tocar) no enlaza `mes-execution`.
- **`production-runtime` (17 endpoints)** es el runtime de bahías/kits/WIP/FG/
  bottleneck — backend de `mission-control` y de `production` (vía `/plans`).
- **`operator-terminal` (SF, 10 endpoints)** es el backend de
  `dashboard/operator-terminal` y expone **exactamente** lo que pide la tarea:
  `verify` (poka-yoke), `andon` (5 tipos), `confirm` (backflush+serial idempotente),
  `hour-by-hour` (meta vs real), `floor-events` (estado de llamadas), `context`
  (unidad/NP/material/bloqueos/skill/ayuda visual).
- ⇒ **Se profundiza `operator-terminal/page.tsx` sobre su backend SF actual**
  (verdadero reuso, sin duplicar el board MES de `operador`).

### Endpoints consumidos (todos existentes, 0 inventados)
- `GET /production-plan` — feed de WOs para escanear/seleccionar (ya se usaba).
- `GET /operator-terminal/context?woId=&station=&operator=` — unidad, paso
  (estación+secuencia), NP esperado, material en línea, bloqueos, skill, autorización.
- `GET /operator-terminal/verify?woId=&station=&part=` — **poka-yoke en vivo**.
- `POST /operator-terminal/confirm` — backflush + serial (idempotente).
- `POST /operator-terminal/andon` — andon por tipo (5).
- `POST /operator-terminal/defect` — reporte de defecto.
- `GET /operator-terminal/floor-events?line=` — **estado de las llamadas** (OPEN/ACK).
- `GET /operator-terminal/hour-by-hour/:woId` — **hora×hora meta vs real**.
- `GET /operator-terminal/kpis?line=` — u/h, hoy, andons, defectos.
- `GET /visual-aids?model=` + `GET /visual-aids/file/:filename` — **ayuda visual**
  del modelo (controller sin guard → imágenes embebibles). Más `station.visualAidUrl`.

### Qué se construyó (rebanada vertical)
1. **Modo estación a pantalla completa**: botón "Pantalla completa" → overlay
   `fixed inset-0 z-[70]` (cubre la chrome global, que es `z-50`) + Fullscreen API
   (best-effort). Salida con botón "Salir" y tecla **Esc** (nunca deja atrapado).
   Superficie **alto contraste** (near-black `#0b0e14` + blanco) en ambos modos.
   Botones grandes scanner-friendly (confirmar `py-6 text-2xl`, scan `text-3xl` mono).
2. **Flujo escanear/seleccionar WO → unidad + paso + ayuda visual**: chips de WO +
   input "Escanea WO" (match por folio/modelo/id). Tarjeta de trabajo con
   **Paso N · estación**, modelo/rev, **Unidad en curso N/total**, progreso, NP
   esperado + factor + std, material en línea (verde/rojo según SHORTAGE). Ayuda
   visual: embebe imagen de `station.visualAidUrl` + galería de `/visual-aids?model=`
   (relevantes a la estación primero), PDFs como enlace.
3. **Poka-yoke en UI**: al escanear, llamada **debounced** a `/verify`; indicador
   ✓/✗ en vivo; **bloquea Confirmar** si hay NP esperado y la parte no coincide
   (mensaje "no se puede saltar el paso"). Si la estación no está en el ruteo →
   banner honesto y confirm bloqueado. La revisión va implícita (el ruteo es por
   modelo+revisión).
4. **Captura de serie + confirmación de backflush**: serie real (`unitSerial`,
   obligatoria si `serialControl=BY_UNIT`); preview "Al confirmar se hará backflush
   de X de NP"; panel post-confirmación con backflush, unidades, serie y **estado
   SAP 261** (outbox). El número de unidades respeta `consumptionMode`.
5. **Andon por tipo + estado de la llamada**: 5 botones grandes (Material→Surtidor,
   Calidad→Ing. Calidad, Mantto→Mantenimiento, Ayuda→Supervisor, Seguridad→
   Supervisor), cada uno muestra el rol al que rutea. Panel "Llamadas activas" lee
   `/floor-events` y muestra estado **ABIERTA/ATENDIENDO**, estación, rol y tiempo.
6. **Hora×Hora (meta vs real)**: panel con barras por hora (real vs meta marcada).
   Si `taktTargetSec=0` (sin meta) → **nota honesta** ("definir takt en IE; tarea
   backend") y muestra solo real. Si no hay eventos → estado vacío honesto.
7. **Reporte de defecto**: reemplazado `window.prompt` por formulario inline
   (nota + severidad) más apto para kiosko/touch.

### Puertas (apps/web) — TODAS EN VERDE
- `eslint src/app/dashboard/operator-terminal/page.tsx` → **0 errores, 0 warnings**.
- `tsc --noEmit` (proyecto web) → **sin errores**.
- `next build` → **OK** (`/dashboard/operator-terminal` compila como estática).
- Antes del PR: `git merge origin/main` (fast-forward) para heredar `.github/
  workflows/ci.yml` (indicación del usuario).

### Tareas backend para mañana (NO se tocó backend; UI honesta)
- **Captura de LOTE en la confirmación SF**: `ConfirmProductionDto` solo acepta
  `unitSerial`, no `lot`. En la UI el campo Lote queda **deshabilitado** con nota
  "backend pendiente" (el board MES sí soporta lote). Falta: añadir `lot` al DTO/
  evento SF + persistirlo (genealogía por lote).
- **Meta de hora×hora**: depende de `taktTargetSec` de la WO (poblado desde la
  calificación modelo↔línea de IE). Cuando es 0, no hay meta — placeholder honesto.
- **Lista de pasos/ruteo en operator-terminal**: el backend SF expone el contexto
  de UNA estación (no la secuencia completa); el orden se valida en `confirm`
  (estación en ruteo + poka-yoke). Mostrar la secuencia completa requeriría exponer
  `stationRequirements` por WO en operator-terminal (hoy vive en line-engineering,
  fuera del carril). Mientras, se muestra "Paso N" del contexto + se confía en el
  gating del servidor.

### Siguiente punto débil del carril (tras mergear este ítem)
- `dashboard/production` (mi carril) es una lista read-only de `/plans`; se puede
  profundizar con `production-runtime` (WIP/FG/bottleneck/hourly) sin salir del carril.

---

## 2026-06-13 — `dashboard/production`: avance en vivo por orden (production-runtime)

> PR #272 (terminal de operador) **mergeado en verde** (CI: build·test·lint·smoke OK,
> squash `c3a97d8`). Rama re-sincronizada con `main`. Siguiente punto débil del carril.

### Decisión (no duplicar mission-control)
`mission-control` ya consume `/production-runtime/{lines,wip,bottleneck,logistics/
shortage-risk}` como **torre** (vista de líneas/WIP/cuello). Por eso `production`
NO replica esa torre: se queda como **lista operativa de órdenes** y se le añade el
**avance real por WO** uniendo `/plans` (planes legacy) con `/production-runtime/lines`
(mismo `workOrder` legacy; `buildBackendView` → target/completed/incidencias/bajo stock).

### Cambios (solo `production/page.tsx`, en mi carril)
- Join `runtimeByWo` por `workOrder`; fetch best-effort de `/production-runtime/lines`
  (si el rol no tiene acceso, la lista de órdenes sigue funcionando — no bloquea).
- KPIs derivados honestos (solo si hay runtime): En producción / Con incidencia /
  Bajo stock.
- Cada orden activa con runtime muestra **barra de avance real** (completed/target,
  %), badge **Incidencia** y badge **Bajo stock**. Sin datos de runtime → fila como
  antes (estado + cantidades). 0 mock; cero endpoints nuevos.
- NO se enlaza "abrir en terminal": el terminal usa WOs SF (`/production-plan`,
  uuid/folio) y esta página usa planes legacy (`/plans`) — IDs distintos; un
  deep-link sería incorrecto. (Puente legacy↔SF = posible tarea backend futura.)

### Puertas (apps/web) — verdes
- `eslint` (0/0), `tsc --noEmit` (sin errores), `next build` (OK, exit 0).

### Polish del escáner (mismo PR de persistencia o siguiente)
- Estaciones serializadas (`serialControl=BY_UNIT`): Enter en el escáner enfoca el
  campo Serie (en vez de intentar confirmar sin serie); Enter en Serie confirma.
  Flujo manos-libres: escanea parte → Enter → escanea/teclea serie → Enter → confirma.

---

## 2026-06-13 — Terminal: recuerda su estación/WO tras reinicio (kiosko real)

> PR #277 (production) **mergeado en verde** (squash `79ce0f9`). Rama re-sincronizada.

### Cambio (solo `operator-terminal/page.tsx`)
Una terminal de piso es un kiosko fijo por estación; al reiniciarse debe volver a
su sitio. Se persiste la **identidad** (estación + última WO) en `localStorage`
(`axos_operator_terminal`) y se restaura al montar (en `useEffect`, post-hidratación
→ SSR-safe; sin mismatch). La escritura ocurre en los handlers de selección
(`chooseWo`/`changeStation`), no en un effect, para no pisar el valor restaurado en
el primer render. No se persiste el modo pantalla completa (requiere gesto del
usuario para la Fullscreen API). 0 backend, 0 mock.

### Puertas (apps/web) — verdes
- `eslint` (0/0), `tsc --noEmit` (sin errores), `next build` (OK, exit 0).
