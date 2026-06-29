<!--
  Reporte del barrido visual de AXOS OS (UI QA con screenshots).
  Rama: ux/visual-sweep · Solo frontend (apps/web). NO mergear hasta que el
  owner lo revise (la tarea de Codex sigue mergeando a main por auto-merge).
-->

# Barrido visual de AXOS OS — Reporte de UI QA

**Rama:** `ux/visual-sweep` · **Alcance:** solo `apps/web/src/**` + harness de barrido.
**Objetivo:** arreglar las **causas raíz** compartidas primero y barrer la cola
larga ruta por ruta con screenshots reales (no adivinando).

> Backend/API, migraciones, entidades, auth, tenancy y el seed demo **no se
> tocaron** (restricción dura de la tarea). Tampoco se cambió lógica de negocio,
> llamadas a API ni contratos de datos: todos los cambios son visuales/estructurales.

---

## 1. Diagnóstico de causas raíz

El owner reportó cuatro síntomas. Todos comparten una causa raíz: **no existía una
librería de primitivos** (solo `ConfirmDialog`), así que cada módulo improvisaba sus
modales, colapsables y dropdowns, y la migración de tokens de color quedó a medias.

| Síntoma del owner | Causa raíz | Fix de raíz |
|---|---|---|
| "no me deja cerrar algunas cosas… no porque falte la función sino porque no se ve" | Modales improvisados: botón de cerrar fuera del viewport / sin scroll interno | **`Modal`** compartido: portal, close button siempre visible, focus-trap, Esc + click-fuera, `max-h-[90dvh]` con scroll interno |
| "colapsables descuadrados" | Cada accordion a mano, sin altura/animación consistentes | **`Collapsible`** compartido: header-botón, chevron, animación de altura, `aria-expanded` |
| "no se alcanzan a ver las letras" | Migración de tokens a medias: `text-gray-400/500` hardcodeado (falla contraste en claro) | Auditoría de contraste (axe-core) + migración a `text-muted-foreground` en componentes compartidos |
| "transparencia… se cruzan textos" | Dropdowns sin portal, `z-index` bajo y fondo semitransparente | **`Popover`/`DropdownMenu`** compartido: portal + `z-[350]` + `bg-popover` opaco + flip/clamp al viewport |

---

## 2. Fase 1 — Primitivos compartidos (causa raíz)

Creados en `apps/web/src/components/ui/`, tematizados con los tokens de
`globals.css` (claro/oscuro) y accesibles. Cada uno con test mínimo en
`apps/web/e2e/primitives.spec.ts` (banco de pruebas en `/dev/ui-primitives`,
404 en producción).

| Primitivo | Archivo | Qué garantiza |
|---|---|---|
| `Modal` | `components/ui/Modal.tsx` | Portal a `body`; **close button siempre visible** (área ≥ 36px); focus-trap (reusa `useDialogA11y`); Esc + click-fuera; `max-h-[90dvh]` con scroll interno; `bg-card` opaco; bloquea scroll de fondo; SSR-safe |
| `Collapsible` | `components/ui/Collapsible.tsx` | Header-botón, chevron que rota, animación de altura consistente, controlado/no-controlado, `aria-expanded`/`aria-controls` |
| `Popover` / `DropdownMenu` / `DropdownItem` | `components/ui/Popover.tsx` | Portal + `z-[350]` + **`bg-popover` opaco**; posicionamiento consciente del viewport (voltea/clampa); Esc, click-fuera, cierre al elegir ítem |
| `Card` (+ Header/Body/Footer) | `components/ui/Card.tsx` | Superficie consistente `bg-card`/`border-border` tematizada |
| `cn()` | `lib/cn.ts` | merge de clases (clsx + tailwind-merge) |

**Tests (Playwright, contra navegador real):** el modal se cierra por Esc,
backdrop y botón (y el botón está dentro del viewport con tamaño > 0); el
colapsable revela/oculta con `aria-expanded` correcto; el dropdown se renderiza
por **portal**, con **fondo opaco** y dentro del viewport. ✅ 3/3.

---

## 3. Fase 2 — Tokens y contraste (causa raíz parcial)

**Hallazgo sistémico:** el texto atenuado está hardcodeado en toda la app como
`text-gray-400` (**~2.023** usos) y `text-gray-500` (**~1.187** usos). En modo
**claro** sobre superficies claras, `text-gray-400` (#9ca3af ≈ 2.6:1) **incumple
WCAG AA** (4.5:1) — esa es la causa de "no se alcanzan a ver las letras".

**Decisión de alcance (honesta):** un reemplazo masivo de ~3.200 sitios no es
verificable con screenshots en una pasada y es **riesgoso** (en superficies
oscuras en ambos temas, `gray-400` es correcto y `muted-foreground` claro
desaparecería). Por eso se migraron a `text-muted-foreground` **solo los
componentes compartidos de alto tráfico** (verificables), y se documenta el
resto como follow-up (§7).

**Migrados a token** (afectan ~13+ rutas que usan el Workspace Industrial):
`workspace/DataTable.tsx`, `workspace/DetailDrawer.tsx`, `workspace/EmptyState.tsx`,
`workspace/FilterBar.tsx`, `workspace/StatCard.tsx` (19 sitios → `text-muted-foreground`).

---

## 4. Fase 3 — Barrido automatizado con Playwright

Harness hermético (sin DB): reusa `loginAsMaster` + `installMockBackend` del suite
golden (backend mockeado en la frontera de red, con fallback genérico que devuelve
`[]`, así toda ruta renderiza su estado vacío en vez de error).

- `e2e/visual-sweep.spec.ts` — itera las rutas, screenshots desktop (1440) y móvil
  (390) en tema claro/oscuro, abre colapsables y el primer dropdown, y corre
  detectores DOM + axe-core (contraste). Opt-in (`SWEEP=1` / `SWEEP_ONLY|SKIP|MAX`)
  para no frenar el `npm run e2e` por defecto.
- `e2e/visual-sweep/routes.ts` — enumera las `page.tsx` y sustituye segmentos
  dinámicos por datos demo.
- `e2e/visual-sweep/detectors.ts` — detectores con severidad: overflow horizontal,
  **texto invisible (color ≈ fondo)**, **botón de cerrar fuera del viewport/tamaño 0**,
  solapamiento de interactivos, **overlay/dropdown traslúcido sobre texto**.
- Salidas: `e2e/__visual__/*.png` (gitignored) + `e2e/__visual__/visual-findings.json`
  (ordenado por severidad).

### Resultados del barrido

<!-- DATA: completar tras la corrida final -->
_(Resumen de `visual-findings.json` — se completa abajo tras la corrida final.)_

---

## 5. Fase 4 — Hallazgos y correcciones (antes/después)

<!-- DATA: tabla de hallazgos por severidad con antes/después -->

---

## 6. Qué se arregló de raíz vs. local

- **De raíz:** primitivos compartidos (`Modal`, `Collapsible`, `Popover/DropdownMenu`,
  `Card`); migración de los dropdowns ad-hoc de `ExportButton` y `DataTable`
  (componentes compartidos, ~30 consumidores) al `DropdownMenu`/`Popover` con portal
  + fondo opaco; migración de tokens de contraste en los componentes del Workspace.
- **Local:** —

---

## 7. Pendiente (con `file:line`)

- **Migración de tokens app-wide:** ~3.200 usos de `text-gray-400/500` fuera de los
  componentes compartidos. Recomendado: codemod gradual módulo-por-módulo
  verificando ambos temas, priorizando superficies claras. (Riesgo de regresión en
  superficies oscuras-en-ambos-temas; no apto para reemplazo ciego.)
- **Adopción de `Modal`/`Collapsible` en módulos:** los modales existentes ya usan
  `useDialogA11y` y tienen close button; se recomienda migrarlos al `Modal`
  compartido para garantizar scroll-containment y close button consistente.

---

## 8. Gates

`npm run build` ✅ · `lint` ✅ · `typecheck` ✅ · tests (golden + primitivos) ✅ ·
cero `console.*` nuevos en código de app · sin `localStorage` que rompa SSR.
