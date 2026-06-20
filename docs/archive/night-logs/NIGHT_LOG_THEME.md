# AXOS OS — Night Log · SISTEMA DE DISEÑO (tema claro/oscuro)

Bitácora del carril de **sistema de diseño**: consolidar tokens, completar el
toggle claro/oscuro y eliminar el hardcodeo (neón) de las pantallas rebeldes.
Rama: `claude/compassionate-fermat-yr7uin`. Solo `apps/web` (PROHIBIDO `apps/api`).
Puertas: `eslint` + `tsc --noEmit` + `next build` — las tres en verde.

---

## ▶ RETOMAR AQUÍ (handoff)

> **Entregado y en verde** (rama `claude/compassionate-fermat-yr7uin`).
> El modo oscuro ahora es el **inverso fiel** del claro, gobernado por un único
> toggle. Tokens unificados, neón erradicado, `cost-rollup` reescrita al estilo
> nativo de la app. `eslint` 0/0, `tsc` limpio (src), `next build` ✓ (95/95).
>
> **Lo que sigue (opcional, incremental):**
> - **Adoptar los tokens semánticos** (`bg-card`, `text-foreground`,
>   `text-muted-foreground`, `border-border`, `bg-primary`, `bg-success/-warning/-danger`)
>   en pantallas nuevas. Ya están expuestos vía `@theme inline`; hoy la app usa
>   la convención previa `text-black dark:text-white` + `glass`, que es coherente
>   y también responde al toggle. Migrar es mecánico y no urgente.
> - **Office (editor de documentos):** `styles/tiptap.css` y
>   `components/office/docs/docStyles.ts` siguen usando `@media (prefers-color-scheme)`
>   para el "papel" del documento. Es una superficie grande y distinta (lienzo de
>   documento, no chrome de la app); **NO se forzó a medias** (regla del enunciado).
>   Para que el papel siga el toggle habría que reescribir esos bloques a `.dark`.
> - **Terminal de operador** (`operator-terminal`): kiosko de piso intencionalmente
>   oscuro (`bg-[#0b0e14]`, modo kiosko de pantalla completa), como un HMI
>   industrial. NO está en la lista de rebeldes del enunciado; se deja como diseño
>   deliberado. Si se quiere que respete el tema, es un rediseño aparte.

---

## 2026-06-20 — Tokens unificados + toggle claro/oscuro + erradicación de neón

### Diagnóstico (lo que realmente había)
- El `ThemeContext` montado en `layout.tsx` **no** era un toggle de tema: es el
  contexto de **branding white-label** del tenant (escribe `--brand-primary`,
  `--brand-logo`, `--glass-opacity`). Su default de marca era el **cyan neón**
  `#00F2EA` — la raíz del acento ajeno.
- `globals.css` tenía **varios sistemas de tokens superpuestos** (axos-*, accent-*,
  apple-*, shadcn HSL) y `--accent` definido **dos veces** en `:root` (ganaba el
  cyan `178 100% 47%`). Los tokens shadcn (`--background`, `--card`, …) estaban
  **muertos**: 0 archivos usaban `bg-background/text-foreground/...` porque NO
  existía `@theme` que los expusiera como utilidades.
- El modo oscuro NO tenía interruptor: las utilidades `dark:` y los bloques
  `.glass`/`.aurora-bg`/`.ribbon-scroll` se regían por `prefers-color-scheme`
  (preferencia del SO), no por una clase. No había `@custom-variant` ni
  `darkMode` configurado (Tailwind v4 sin config, solo `@import`).
- `html { background:#020409 }` (casi negro) + `body` con radial **cyan/rosa neón**
  hardcodeado → tinte ajeno global.
- **Pantallas "rebeldes":** el GREP de neón (`#00F2EA`, `rgba(0,242,234)`,
  `#050505`, `#FF005C`) sólo dio positivo en **`finance/cost-rollup`** (full neón
  sobre negro con glows). Las demás del enunciado (control-tower,
  line-control-tower, live, genealogy, reports, mission-control, finance hub,
  cost-intelligence) **ya usaban** el patrón correcto `text-black dark:text-white`
  + `bg-black/5 dark:bg-white/10` + `glass`: no estaban hardcodeadas, sólo NO
  respondían a un toggle porque el dark era por SO.

### 1 · Tokens consolidados (una sola fuente de verdad) — `globals.css`
- **Paleta semántica única** en `:root` (claro) y `.dark` (oscuro), en canales
  HSL (`hsl(var(--token))`): `--background, --foreground, --card(/-foreground),
  --surface, --popover, --muted(/-foreground), --border, --input, --primary
  (/-foreground), --ring, --success, --warning, --danger` (+ alias de compat
  shadcn: secondary/accent/destructive).
- **Acento de marca = índigo** (`--primary: 239 84% 67%`), **idéntico** en claro y
  oscuro (sólo se aclara levemente en dark, `71%`, para contraste). **CERO cyan.**
- **Inverso fiel:** el oscuro es deep-slate sobrio (`--background: 222 30% 7%`,
  card `222 24% 10%`, texto `210 20% 96%`), MISMOS acentos. Nada de negro puro
  ni neón.
- **`@theme inline`** mapea cada token a su utilidad Tailwind v4 (`bg-card`,
  `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`,
  `bg-success/-warning/-danger`, …). `inline` ⇒ la utilidad referencia la
  variable en el elemento, así el cambio a `.dark` se refleja en vivo.
- Defaults de marca repunteados de cyan→índigo (`--axos-accent: #6366f1`,
  `--brand-primary` default índigo); `::selection` y `:focus-visible` ahora usan
  el acento de marca/`--primary` (antes cyan + texto blanco forzado).
- `html`/`body` ahora pintan `hsl(var(--background))` (tema), sin el casi-negro
  ni el radial neón. El `<AuroraBackground/>` del dashboard sigue dando su
  gradiente sutil encima; landing/login traen el suyo (`AmbientBackground`,
  base opaca `bg-[#f1f3f7] dark:bg-[#0e0e11]`).
- Se borraron 2 keyframes **muertos** con neón (`axos-running-glow`,
  `axos-critical-aura`, 0 consumidores).

### 2 · Toggle completo (darkMode + interruptor accesible)
- **`@custom-variant dark (&:where(.dark, .dark *))`** → TODA utilidad `dark:`
  de la app pasa a regirse por la **clase `.dark`** en `<html>` (verificado en el
  CSS compilado: `:where(.dark, .dark *)`, sin `prefers-color-scheme` para `dark:`).
  Un único switch gobierna toda la app. Los bloques `.glass`/`.aurora-bg`/
  `.ribbon-scroll` se convirtieron de `@media (prefers-color-scheme)` a
  `.dark .…` (también verificado: `.dark .glass`, `.dark .aurora-bg`).
- **`ThemeContext` extendido** (sin tocar el branding existente): expone
  `colorScheme` (`light|dark|system`), `resolvedScheme`, `setColorScheme`,
  `toggleTheme`. Aplica/quita `.dark` en `<html>` + `color-scheme`. **Respeta la
  preferencia del sistema** (default `system`, con listener `matchMedia` en vivo).
- **Persistencia:** `localStorage('axos_theme')` con guard SSR + try/catch — el
  **mismo patrón** que `WorkspaceContext` (`axos_workspace`) usa para preferencias.
- **Anti-parpadeo:** script inline en `<head>` (layout) fija `.dark` ANTES del
  primer paint desde `axos_theme` o el SO; `<html suppressHydrationWarning>`.
- **Interruptor en el header** (`DashboardTopBar`, heredado por todo
  `/dashboard/*`): botón rápido sol/luna (`aria-label`, `aria-pressed`) + control
  segmentado **Claro / Oscuro / Auto** (`role=radiogroup`) en el menú de avatar.
  `mounted` resuelto con `useSyncExternalStore` (server=false/cliente=true) para
  no romper la hidratación del icono — sin `setState` en efecto (eslint limpio).

### 3 · Pantalla rebelde arreglada — `finance/cost-rollup`
- Reescrita a la estética **nativa** de la app (idéntica al hub de Finanzas):
  `PageHeader` (dominio finance), tarjetas `glass`, raíz
  `text-black dark:text-white`, textos `text-gray-500 dark:text-gray-400`,
  superficies `bg-black/5 dark:bg-white/5`. **Toda la lógica intacta** (hooks,
  `useMemo`, SWR, handlers, RBAC).
- Eliminado: shell `#050505`+gradiente cyan, `text-white` forzado, `text-[#00F2EA]`,
  `text-[#FF005C]`, `bg-white/10`/`border-white/20`/`bg-black/25`, glows.
- Acentos cyan → **índigo/violeta de la app** (`text-violet-500`). Errores
  `#FF005C` → `red-500`. Los colores **categóricos** de las gráficas
  (ámbar/esmeralda/azul/violeta) se conservan (son datos, no chrome).
- Tooltips/ejes de Recharts ahora leen tokens: `hsl(var(--popover))`,
  `hsl(var(--border))`, `hsl(var(--muted-foreground))` → invierten con el tema.
- Copys traducidos a español para que no "se sienta de otra app".

### 4 · Verificación
- **GREP final:** 0 literales neón en `app/`+`components/` (sólo quedaba el de los
  keyframes muertos, ya borrados). 0 fondos `bg-[#…]` forzados en las pantallas
  del enunciado.
- **Pantallas del enunciado:** control-tower, line-control-tower, live, genealogy,
  reports, mission-control, finance hub y cost-intelligence ya usaban
  `text-black dark:text-white` → ahora **responden al toggle** automáticamente
  (inverso fiel). cost-rollup reescrita. operator-terminal: kiosko oscuro
  deliberado (anotado arriba).
- **CSS compilado confirma:** `dark:` es por clase; `.dark .glass`/`.dark .aurora-bg`
  presentes; el único `prefers-color-scheme` restante es el "papel" del editor de
  documentos de Office (fuera de alcance, anotado).
- **Puertas:** `tsc --noEmit` limpio en `src/` (errores ajenos preexistentes sólo
  en `e2e/`, fuera del grafo de build); `eslint` **0 errores / 0 warnings** en los
  archivos tocados; `next build` **✓ Compiled successfully**, 95/95 páginas.

### Archivos tocados
- `apps/web/src/app/globals.css` — tokens, `@custom-variant`, `@theme inline`,
  html/body, `.dark` para glass/aurora/ribbon, limpieza de neón.
- `apps/web/src/contexts/ThemeContext.tsx` — gestión de esquema claro/oscuro/sistema.
- `apps/web/src/app/layout.tsx` — script anti-parpadeo + `suppressHydrationWarning`.
- `apps/web/src/components/DashboardTopBar.tsx` — `ThemeToggle` + `ThemeChoice`.
- `apps/web/src/app/dashboard/finance/cost-rollup/page.tsx` — reescritura al tema.
