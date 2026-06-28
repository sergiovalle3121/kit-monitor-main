# CAD a escala de fábrica — bitácora de progreso

> Bitácora viva del run nocturno para llevar el editor de layout de "funcional
> pero estrecho" a un CAD a escala de fábrica completa. La revisa el CTO en la
> mañana. Se actualiza al cerrar cada commit/PR.

**Rama:** `claude/axos-cad-factory-scale-yd546i`
**Alcance:** `apps/web/src/**` (CAD frontend). Endpoints aditivos de solo lectura
en `apps/api` solo si son estrictamente necesarios.

## Puertas de calidad (cada commit)
- `npx tsc --noEmit` (web) — limpio ✅
- `npx eslint` (web) — 0 errores (4 warnings pre-existentes, en código no tocado) ✅
- specs CAD (`node -r ts-node/register …`) — pasan ✅
- `npm run build` (web) — verde antes de push ✅
- Cero `console.*` nuevos · sin `localStorage`/`sessionStorage` que rompa SSR ·
  respeta `THEMES` y design tokens.

## PR
- **#743** (draft) — rama `claude/axos-cad-factory-scale-yd546i` → `main`.
- Sincronizada con `main` (merge de `origin/main`; conflicto único en el bloque
  de imports de `Layout3DEditor.tsx` resuelto conservando los imports nuevos de
  `main` —collisions/flow/safety— y los míos —world-scale/PlantMinimap/ScaleBar).
- **Nota CI (limitación del entorno):** en este sandbox sólo el evento
  `opened` del PR disparó GitHub Actions (verde en un commit temprano,
  `1039e3e`). Los `git push` por el proxy no emiten `synchronize` y el
  `reopen` tampoco dispara Actions, así que los commits posteriores **no**
  re-ejecutan CI automáticamente. Cada commit se validó con las puertas
  locales (build/lint/typecheck/specs, todas verdes). Pedir al revisor que
  re-lance CI sobre el head actual (o se ejecutará en el próximo evento real).

---

## EPIC 0 — Lienzo a pantalla completa y a escala de fábrica · EN CURSO

El editor 3D (`Layout3DEditor`) ya se monta full-bleed (`createPortal` →
`fixed inset-0`), así que la "caja chica" real era **la escala del mundo** y la
falta de herramientas de encuadre, no el contenedor DOM.

### Hecho
- **`feat(cad): factory-scale world presets + safe bounds`** (`990f61b`)
  - Nuevo `apps/web/src/lib/cad/world-scale.ts` (puro, con tests):
    conversión metro↔unidad, presets de fábrica (Celda → Mega planta, hasta
    500 m/lado), clamp de huella/rejilla a límites seguros, paso de rejilla
    adaptativo, formato en metros.
  - `world-scale.spec.ts` (node:assert) — round-trips, clamps, presets,
    rejilla adaptativa.
  - UI: chips de preset de planta + lectura en vivo en metros + clamp seguro en
    el editor de huella. Sin cambios de backend (la huella ya round-trip en
    `save`).
- **`feat(cad): zoom-to-fit / zoom-to-selection + focus mode`** (`74d3721`)
  - `fitView('all' | 'plant' | 'selection')` encuadra una caja envolvente en
    coordenadas de mundo conservando el ángulo de cámara.
  - Modo foco: oculta ambos paneles laterales para maximizar el lienzo (el
    `ResizeObserver` ya redimensiona el canvas).
  - Toolbar + atajos `F` / `Shift+F` / `\` + comando `fit_view` + ayuda.
- **`feat(cad): plant overview minimap`** (`d72c9bd`)
  - Nuevo `apps/web/src/lib/cad/minimap.ts` (puro, con tests): escala del
    minimapa, mapeo target↔mundo↔píxel, clamp a la huella.
  - Nuevo `PlantMinimap.tsx` — overlay SVG (mismo patrón de polling con rAF que
    `Minimap.tsx`, sin re-render del editor): huella + estaciones + equipos +
    objetivo de cámara; clic para centrar la vista conservando el zoom.
  - Toolbar: toggle de minimapa (📍). Pensado para navegar plantas grandes.
- **`feat(cad): dynamic scale bar (real-units ruler)`**
  - `niceScaleBarMeters` (1/2/5×10ⁿ) en `world-scale.ts` (con tests).
  - Nuevo `ScaleBar.tsx` — proyecta una base de 10 m en el plano del objetivo a
    píxeles y dibuja una barra de escala 1/2/5 en metros; se adapta al zoom.
    Regla de unidades reales robusta bajo cámara en perspectiva.

### Pendiente en EPIC 0
- Grid adaptativo enganchado a `adaptiveGridStepM` (hoy el grid usa
  `footprint.gridSize`; el lib ya expone el paso adaptativo).
- Pan con barra espaciadora + arrastre (OrbitControls ya da rueda/órbita).

**EPIC 0 — AC cubiertos:** lienzo full-bleed ✅ · escala de nave hasta 500 m con
presets ✅ · fit a planta/contenido/selección ✅ · modo foco ✅ · minimapa ✅ ·
escala con unidades reales ✅.

## EPIC 7 — Precisión y productividad CAD · EN CURSO

- **`feat(cad): reuse tested cad-array + add polar array`**
  - El arreglo rectangular del editor (`arrayAssets`) ahora delega en el helper
    puro y probado `rectangularArray` (`cad-array.ts`) — elimina lógica de bucle
    duplicada (regla "no dupliques lógica").
  - Nuevo **arreglo polar** de equipo (`polarArrayAssets`) sobre el helper
    `polarArray`: N copias alrededor del centro de la planta en un span de
    ángulo configurable. UI: fila "Polar (N en X°)" en el panel de propiedades.
  - AC parcial: matriz NxM con paso exacto ✅ (ya existía) + patrón polar ✅.
  - Pendiente del epic: command palette extendido, snaps endpoint/mid/intersection,
    coordenadas absolutas exactas para colocar, copiar/pegar con offset.

## EPIC 1–6, 8 — pendientes
Ver backlog del prompt. Se abordan en orden.

---

## PRs en draft que necesitan revisión humana (DB/auth/tenancy)
_(ninguno todavía — no se ha tocado schema, entidades, auth ni tenancy.)_

## Bloqueos
_(ninguno todavía.)_
