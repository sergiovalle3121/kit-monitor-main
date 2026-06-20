# NIGHT_LOG — Hojas de cálculo: USABILIDAD (carril SHEET-UX)

Sesión enfocada en que la hoja se sienta **fluida y cómoda como Excel/Sheets**: sin
elementos flotantes tapando la cuadrícula y con los atajos de teclado estándar
funcionando (deshacer/rehacer/portapapeles) cableados al motor de Fortune-Sheet.

- **Rama:** `claude/festive-faraday-4g6m4r` (la del entorno). Verde→commit; el carril
  anterior (SHEET-FORMULA) ya quedó en `main` vía PR #329 (merge), y esta rama se
  sincronizó a `main` antes de empezar.
- **Archivos tocados (y SÓLO estos):**
  - `apps/web/src/components/office/SheetEditor.tsx`
  - `apps/web/src/components/office/OfficeShell.tsx`
  - `apps/web/src/components/ChatWidget.tsx`
- **PROHIBIDO y respetado:** nada de `apps/api`, ni `AiCopilot.tsx`, ni `layout.tsx`,
  ni el ribbon compartido, ni `globals.css`.

---

## A) Elementos encimados — ARREGLADO

### A1 · Botones flotantes (chat + IA) sobre el editor
- **Causa:** `ChatWidget` (z-100, abajo-dcha) y `AiCopilot` (z-101, abajo-dcha) se
  montan global en `layout.tsx`, pero `OfficeShell` (el editor a pantalla completa)
  estaba en **z-50** → los FAB flotaban ENCIMA del editor, tapando la barra de scroll
  y los controles de la hoja (esquina inferior derecha).
- **Fix (2 frentes):**
  1. **`OfficeShell`**: `z-50` → **`z-[110]`**. El editor opaco a pantalla completa
     queda por encima de los FAB (100/101) y por debajo de toasts (z-120) y de la
     paleta de búsqueda (z-200), que sí deben verse. Esto cubre los FAB en **todos**
     los editores de Office (no sólo hojas), sin tocar `AiCopilot.tsx` (fuera del carril).
  2. **`ChatWidget`**: además se oculta por ruta en el editor (`/dashboard/office/<id>`)
     — desmontaje limpio; la **lista** de Office (`/dashboard/office`) lo conserva.
- **Verificado (navegador real, Playwright):** con `OfficeShell` envolviendo la hoja y
  dos FAB simulados en z-100/101, `elementFromPoint` en sus posiciones devuelve la
  **rejilla** y la **barra de Gráficas** (no los FAB). `z-index` del shell = 110. ✓

### A2 · Barra de scroll horizontal de la hoja vs panel «Gráficas»
- **Causa (la real, vista en el navegador):** Fortune-Sheet sólo recalcula su layout al
  redimensionar la **VENTANA** (`window.addEventListener('resize')`), **no** tiene
  `ResizeObserver`. Al abrir/cerrar el panel **«Gráficas»** su contenedor cambia de alto
  SIN un resize de ventana → la barra de hojas + scroll horizontal quedaban **descolocadas
  ENCIMA de la cuadrícula** (la barra de hojas aparecía a media rejilla, con filas debajo).
- **Fix (`SheetEditor`):** un `ResizeObserver` sobre el contenedor de la rejilla dispara
  un `window.dispatchEvent(new Event('resize'))` (debounced 80 ms) cuando ese contenedor
  cambia de tamaño → la hoja **reacomoda** su área y deja los scrollbars limpios bajo la
  cuadrícula. Sin bucle: el alto del contenedor lo fija el flex layout, no el contenido de
  la hoja.
- **Verificado:** medido con Playwright al expandir/colapsar Gráficas — la barra de hojas
  pasa de quedar **a media rejilla** (antes) a quedar **siempre por encima** del panel de
  Gráficas (sheetArea.bottom ≤ Gráficas.top): colapsado 561≤584 ✓, expandido 241≤264 ✓.

---

## B) Teclado incompleto — CABLEADO AL MOTOR

`SheetEditor` sólo manejaba Ctrl+P y Ctrl+F. Fortune-Sheet **sí** implementa
deshacer/rehacer/copiar/pegar/cortar de forma nativa, pero su listener vive en el
**contenedor de la rejilla**: al usar la cinta o cerrar un diálogo el foco sale de la
rejilla y esas teclas dejaban de llegar → de ahí que **«el deshacer no funcionaba»**.

- **Fix (`SheetEditor`, listener a nivel ventana):**
  - **Ctrl/⌘+Z** = deshacer · **Ctrl/⌘+Shift+Z** y **Ctrl/⌘+Y** = rehacer →
    `wbRef.current.handleUndo()` / `handleRedo()` (el undo/redo **REAL** del workbook).
  - **Ctrl/⌘+C / X / V** = copiar/cortar/pegar: cuando el foco está fuera de la rejilla,
    se lo devolvemos a la rejilla para que el motor los capture (el pegado se resuelve en
    el mismo evento porque su listener vive en `document` y comprueba el elemento activo).
  - **Sin doble disparo:** si el foco YA está dentro de la rejilla, el handler retorna y
    deja que Fortune-Sheet lo gestione nativamente. Ctrl+P / Ctrl+F intactos.
- **Verificado (navegador real, Playwright, foco FUERA de la rejilla):**
  - Escribir `=A1+A2` → `f="=A1+A2"`, `v=15`; `+1+1` → `f="=+1+1"`, `v=2` (motor vivo).
  - **Deshacer** (Ctrl+Z) revierte la última edición; **rehacer** (Ctrl+Y) la reaplica. ✓
  - Copiar/pegar dentro de la rejilla (A1→A8) funciona (camino nativo preservado). ✓

---

## Puertas de calidad (todas verdes)
- `eslint` de los 3 archivos: **0 errores**, **0 warnings nuevos** (SheetEditor sigue en
  los 18 warnings preexistentes de `react-hooks/refs`; ChatWidget/OfficeShell sin warnings).
- `npx tsc --noEmit`: **0 errores**. `npm run build` (`next build`): **OK**.
- Regresión: las **15** specs de `office/sheets/*.spec.ts` siguen verdes.

## Verificación propia (lo que pide el encargo: «verifica TÚ usándola»)
Monté un harness temporal (`/sheetlab`, **borrado antes del commit**) que renderiza el
`SheetEditor` dentro del `OfficeShell` con FAB simulados, y lo manejé con un navegador real
(Playwright + Chromium): escribir en celdas, deshacer/rehacer con el foco fuera de la
rejilla, copiar/pegar un rango, expandir/colapsar Gráficas, y comprobar por
`elementFromPoint` que ningún botón flotante tapa la hoja. Todo OK (capturas y medidas
arriba). El harness y los scripts de Playwright NO se commitean.

## Decisiones / honestidad
- No se tocó `AiCopilot.tsx` (fuera del carril): su botón se resuelve **cubriéndolo** con
  el editor (z-index), no desmontándolo. El `ChatWidget` sí se desmonta por ruta.
- Copiar/cortar con el foco fuera de la rejilla devuelven el foco a la rejilla (el motor
  los capta en la siguiente pulsación); pegar funciona en la misma pulsación. Dentro de la
  rejilla —el flujo normal— todo es nativo de Fortune-Sheet, sin cambios.
- El reflow por `ResizeObserver` también corrige el layout al entrar/salir de pantalla
  completa o al cambiar el alto del editor, no sólo al togglear Gráficas.
