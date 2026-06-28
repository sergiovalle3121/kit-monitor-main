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

### Pendiente en EPIC 0
- Reglas (rulers) en bordes con unidades reales y grid adaptativo enganchado a
  `adaptiveGridStepM` (hoy el grid usa `footprint.gridSize`).
- Integrar `Minimap.tsx` al lienzo 3D para navegar plantas grandes.
- Pan con barra espaciadora + arrastre (OrbitControls ya da rueda/órbita).

## EPIC 1–8 — pendientes
Ver backlog del prompt. Se abordan en orden tras cerrar EPIC 0.

---

## PRs en draft que necesitan revisión humana (DB/auth/tenancy)
_(ninguno todavía — no se ha tocado schema, entidades, auth ni tenancy.)_

## Bloqueos
_(ninguno todavía.)_
