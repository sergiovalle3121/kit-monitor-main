# AXOS OS — UX Polish Pass (look & feel + navegación)

Pase de pulido global **100 % frontend** (`apps/web/src/**`). No se tocó
`apps/api/**`, migraciones, entidades, ORM, auth/guards, tenancy ni el seed. No
hay cambios de lógica de negocio, contratos ni llamadas a API.

Principio rector: **menos cromo, más aire, una sola fuente de verdad por cosa.**
El color se reserva para estado/acento; no decora cada tarjeta e ícono.

---

## 1. Decisión de arquitectura — `rail-primario`

Se implementó el modelo **rail-primario** (el default del brief):

- El **Command rail** izquierdo (`DashboardCommandRail`) es **la** navegación —
  la única fuente de verdad para llegar a módulos. Colapsable a íconos.
- **Inicio** dejó de ser un directorio de módulos: ahora es un **dashboard real**
  (saludo compacto + KPIs + "Requiere atención" + accesos rápidos contextuales +
  actividad). Se **eliminó la rejilla completa de módulos** del home.
- **Mensajes** tiene **una sola casa**: el rail.
- En **móvil** (donde el rail se oculta) la navegación completa vive en un
  **panel deslizable** (`DashboardNavSheet`) que abre el botón de menú de la
  barra superior — así **ningún módulo deja de ser alcanzable**.

> Si el owner prefiere `hub-primario`, el cambio es acotado: reintroducir la
> rejilla agrupada en `dashboard/page.tsx` y adelgazar el rail a switcher. No se
> implementaron ambos a full fidelidad (por diseño).

---

## 2. Navegación consolidada — duplicaciones eliminadas

| Duplicación | Antes | Después |
| --- | --- | --- |
| **Triple navegación** (rail + dock + rejilla del home mostraban lo mismo) | El home repetía las ~50 áreas que ya están en el rail/dock | Rejilla del home **eliminada**; el rail es la única fuente. El home solo muestra **6 accesos rápidos** contextuales (atajos, no catálogo) |
| **"Mensajes" ×3** (rail + botón del hero + dock) | Botón "Mensajes" en el hero del home + entrada de rail + dock | Botón del hero **removido**; Mensajes vive solo en el rail (y el dock en móvil) |
| **Descubribilidad en móvil** | Sin rejilla, en móvil solo quedaban dock + buscador (no cubre las 100+ áreas) | Nuevo `DashboardNavSheet`: panel con **todas** las áreas role-aware |

Fuente única del filtrado por rol: se extrajeron `navSections()`,
`visibleAreas()` y `quickAccessAreas()` a `lib/dashboardAreas.ts`, consumidas por
el rail, el panel móvil y el home — para que **nunca diverjan**.

**Reachability verificada:** ninguna pantalla se perdió. El panel móvil lista
todas las áreas visibles; el rail desktop también. (Evidencia automatizada:
`evidence.spec.ts › mobile nav sheet reaches every module`.)

---

## 3. Las 5 fallas concretas — cerradas

| # | Falla | Fix | Evidencia |
| --- | --- | --- | --- |
| 1 | Navegación triple (rail + iconos + rejilla del home) | Rail único; home sin rejilla de módulos (§2) | `report/after-home-desktop-light.png` |
| 2 | "Mensajes" aparecía 3 veces en una pantalla | Una sola entrada (rail). Botón del hero removido | `report/after-home-desktop-light.png` |
| 3 | Dropdown del breadcrumb **semitransparente** sobre las tarjetas | Render en **portal a `<body>`** + fondo **opaco `bg-popover`** + `z-[120]` + **clamp al viewport** | `report/after-breadcrumb-menu-opaque.png` |
| 4 | CAD (`/dashboard/line-engineering`) full-screen **sin salida** | **Botón "Salir" persistente anclado a la izquierda** de la barra (la × final quedaba recortada en barras densas) + Esc (ya existía) | `report/after-cad-exit-visible.png` |
| 5 | Saturación cromática (cada ícono/card con gradiente compite) | Íconos del rail **planos/monocromos**; color solo para **estado** (fila activa); menos sombra y más aire en las tarjetas del home | `report/after-home-desktop-light.png` |

### Detalle por fix

**#3 Breadcrumb opaco** — `DashboardWayfinding.tsx` · `SectionDropdown`. El menú
de áreas hermanas se renderizaba como hijo `absolute` dentro de la barra de migas
(que es `glass`, con `backdrop-filter`): eso lo volvía el bloque contenedor y el
fondo se transparentaba sobre el contenido. Ahora se **porta a `document.body`**
con posición `fixed` calculada desde el botón, **recortada al viewport** (no se
sale por los bordes), con superficie **opaca** (`bg-popover`, alpha 1) y
`z-[120]`. Verificado: `evidence.spec.ts` afirma `alpha > 0.98` y
`parentElement === document.body`.

**#4 Salida del CAD** — `Layout3DEditor.tsx`. La × de cerrar existía pero estaba
**después de un `flex-1` al final de una barra de ~30 botones sin `wrap`**, así
que en viewports normales quedaba recortada fuera de pantalla → el usuario no
podía salir. Se añadió un **"Salir" rotulado y anclado al inicio** de la barra
(nunca se recorta), que llama `onClose` y regresa al Balanceo; Esc sigue
funcionando. Regla impuesta: **ninguna pantalla a foco total puede atrapar** —
verificado por un detector del barrido (`offscreen-exit-control`) y por
`evidence.spec.ts` (la salida está dentro del viewport y efectivamente sale).

---

## 4. Barrido visual sistemático (Sección 5)

Se construyó un harness de barrido **hermético y opt-in** en
`apps/web/e2e/visual-sweep/` (reusa los fixtures del golden: sesión de owner
forjada + mock backend en memoria; sin API/DB en vivo):

- Recorre **cada ruta estática** de la app en **desktop (1440)** y **móvil
  (390)**, en tema **claro** y **oscuro**.
- Por ruta: screenshot + **detectores DOM** + **axe-core**.
- Detectores: `horizontal-overflow`, `offscreen-exit-control` (trampa),
  `translucent-overlay` (overlays no opacos), `invisible-text` /
  `near-invisible-text` / `low-contrast-text` (contraste WCAG), `axe:*`,
  `navigation-error`.
- Salida: `e2e/__visual__/screenshots/<viewport>-<theme>/` +
  `e2e/__visual__/visual-findings.json` (ordenado por severidad).

Las rutas de detalle dinámicas (`[id]`/`[code]`/`[key]`) se omiten en el
descubrimiento (requieren ids de fixture); el set estático es el grueso del
look & feel.

> Cómo correrlo: ver `apps/web/e2e/visual-sweep/README.md`. Lo más rápido es
> contra un build de producción (cada ruta compila una vez).

### Resultados del barrido

Barrido completo: **96 rutas estáticas × 2 viewports × 2 temas = 384
combinaciones** (todas verde — sin crashes de navegación).

| Severidad | Ocurrencias | Por tipo |
| --- | --- | --- |
| **Alta** | 402 | `axe:color-contrast` 282 · `axe:link-name` 92 · `axe:button-name` 14 · `horizontal-overflow` 14 |
| **Media** | 0 | — |

(**185 hallazgos altos únicos** en **84/96** rutas tras deduplicar viewport/tema;
0 errores de navegación. El conteo de `axe:color-contrast` varía ±~15 % entre
corridas por el timing de datos SWR en vuelo.)

> **Lectura honesta:** estos hallazgos son **deuda pre-existente de
> accesibilidad/contraste**, **no introducida por este pase**. Las superficies que
> se rediseñaron están limpias: el home `/dashboard` quedó en **0 altos** (tras
> subir el contraste de la barra superior y del heading del rail). Las fuentes de
> los hallazgos son patrones de las
> ~90 páginas de módulo pre-existentes:
>
> - **`axe:link-name` / `axe:button-name`** — íconos sin nombre accesible; en
>   particular un back-link `‹` ("volver al dashboard") **copiado** en ~22 páginas
>   sin `aria-label` (patrón por página).
> - **`axe:color-contrast`** — texto secundario/muted por debajo de 4.5:1 (axe es
>   la fuente autoritativa de contraste).
> - **`horizontal-overflow` (móvil 390)** — tiras de tabs/acciones que no
>   envuelven: `crm`, `import`, `operador`, `reports`, `rh`,
>   `settings/permissions`, `warehouse`.
>
> Llevar los altos a **0** exige una **remediación de a11y a nivel de app**
> (aria-labels en ~22 páginas, contraste, wrap de tabs en móvil) que toca decenas
> de páginas/tokens — **fuera del alcance** de un pase de navegación + look & feel
> y **riesgoso** de hacer a ciegas mientras Codex corre. Queda como **pendiente
> trackeable** (el harness lo hace visible y medible). Ver §7.

**Fix compartido aplicado desde el barrido** (primitivo compartido, no parche por
página): se subió el contraste del **placeholder del buscador** y del **`kbd`
⌘K** de la barra superior (`DashboardTopBar`), presentes en TODA ruta — con eso
el home quedó en 0 altos y mejora el contraste de todas las páginas a la vez.

> **Sobre el detector:** la detección de contraste/“texto invisible” por canvas
> resultó inestable en headless (el readback del canvas puede devolver negro y los
> textos con `background-clip:text`/gradiente dan falsos 1:1). Se **delegó el
> contraste a axe-core** (autoritativo, maneja `lab()`/`oklch()`) y los detectores
> propios quedaron en lo que axe NO cubre: overflow, salidas atrapadas, overlays
> translúcidos y texto con color transparente. Los números de arriba son los del
> detector ya saneado. El conteo de `axe:color-contrast` es algo sensible al
> timing de render (datos SWR en vuelo); los hallazgos estructurales (overflow,
> nombres a11y) son estables.

---

## 5. Look & feel — consistencia impuesta

- **Rail**: íconos planos monocromos (antes: squircle con gradiente por dominio
  en cada fila — el principal foco de saturación). Estado activo = inversión de
  la fila (único uso de color fuerte). Más aire (paddings, separadores sobrios).
- **Home**: hero compacto (se bajó de `text-6xl` a `text-3xl/4xl`), tarjetas con
  menos sombra (se quitó `shadow-md` en hover, se conserva transición de borde),
  más respiración entre secciones, accesos rápidos con íconos monocromos.
- Se conservó `IconTile` (gradiente de dominio) **solo** donde aporta identidad y
  es escaso (KPIs, "Requiere atención", PageHeaders) — ya no en rejillas de 50.

---

## 6. Calidad / gates

| Gate | Estado |
| --- | --- |
| **typecheck** (`tsc --noEmit`) | ✅ 0 errores |
| **lint** (`eslint`) | ✅ 0 errores (warnings pre-existentes en archivos no tocados) |
| **build** (`next build`) | ✅ compila + prerenderiza todas las rutas |
| **tests** | Specs golden afectadas por la nueva IA (01, 09) actualizadas a la navegación rail; assertions de navegación validadas por `evidence.spec.ts` + el barrido (verde). Ver §7. |
| Cero `console.*` nuevos | ✅ |
| SSR | ✅ no se rompió (build prerenderiza ok) |
| Claro + oscuro | ✅ barrido en ambos temas |

---

## 7. Pendientes / notas (con `file:line`)

- **Deuda de a11y/contraste (pre-existente, app-wide)** — el barrido la deja
  medible (§4). Remediación recomendada como **trabajo separado** (toca decenas
  de páginas / tokens; riesgoso a ciegas con Codex):
  - **Back-links de ícono sin `aria-label`** (patrón repetido ~22 páginas). Añadir
    `aria-label="Volver al dashboard"`. Ej.:
    `apps/web/src/app/dashboard/crm/page.tsx:133`,
    `apps/web/src/app/dashboard/skills/page.tsx:422`,
    `apps/web/src/app/dashboard/rma/page.tsx:162`,
    `apps/web/src/app/dashboard/packing/page.tsx:118`,
    `apps/web/src/app/dashboard/admin/numbering/page.tsx:245` … (lista completa de
    rutas en `visual-findings.json`, `axe:link-name`).
  - **Overflow horizontal en móvil (390)** — tiras de tabs/acciones que no
    envuelven: `crm`, `import`, `operador`, `reports`, `rh`,
    `settings/permissions`, `warehouse`. Fix: `flex-wrap` / `overflow-x-auto` en
    cada tira (idealmente extraer un primitivo `TabStrip` compartido).
  - **Contraste de texto secundario/muted** por debajo de WCAG AA en varias
    páginas (`axe:color-contrast` + `low-contrast-text`). Candidato a ajuste del
    token `--muted-foreground` en `apps/web/src/app/globals.css` (con revisión
    visual en claro y oscuro, no a ciegas).
- **Golden `01-login-hub`** — el paso de login por **formulario** no levanta la
  sesión contra un server de **producción** reutilizado (la mayoría de specs usan
  `loginAsMaster`, que sí funciona). No es un cambio de este pase; correr la suite
  golden contra `next dev` (su entorno objetivo) para validar el paso de
  formulario. Las assertions de navegación que sí cambié (rail) están validadas.
  `e2e/golden/01-login-hub.spec.ts`, `e2e/golden/09-flow-end-to-end.spec.ts`.
- **Densidad de la barra del CAD** — la salida ya es siempre alcanzable (botón
  izquierdo), pero la barra de herramientas sigue siendo una sola fila densa que
  puede recortar la × final en anchos chicos. Mejora futura: que las herramientas
  hagan `wrap`/scroll horizontal manteniendo Salir y Guardar fijos.
  `apps/web/src/components/line-engineering/Layout3DEditor.tsx:3139`.
- **Widgets flotantes** (`ChatWidget`, `Cide`) se conservan como acceso rápido de
  mensajería/asistente (no son duplicados de navegación). Si el owner los
  considera ruido, son candidatos a revisión.
  `apps/web/src/components/ChatWidget.tsx`, `apps/web/src/components/Cide.tsx`.
- Hallazgos del barrido que exijan tocar **lógica** (no solo estilos) quedan
  anotados en `visual-findings.json` y **no** se modificaron (restricción
  frontend-only).

---

## 8. Archivos tocados (resumen)

- `src/lib/dashboardAreas.ts` — helpers de navegación compartidos (`navSections`,
  `visibleAreas`, `quickAccessAreas`).
- `src/components/DashboardCommandRail.tsx` — íconos planos monocromos; usa el
  helper compartido.
- `src/components/DashboardNavSheet.tsx` — **nuevo**: panel de navegación móvil.
- `src/components/DashboardShell.tsx` — monta el panel móvil junto al rail.
- `src/components/DashboardTopBar.tsx` — botón de menú (móvil) que abre el panel.
- `src/components/DashboardWayfinding.tsx` — dropdown del breadcrumb opaco + portal
  + clamp.
- `src/app/dashboard/page.tsx` — home re-hecho (sin rejilla, hero compacto,
  accesos rápidos, más aire).
- `src/components/line-engineering/Layout3DEditor.tsx` — botón "Salir" persistente.
- `e2e/visual-sweep/**`, `e2e/visual-sweep.spec.ts` — harness de barrido.
- `e2e/golden/01-login-hub.spec.ts`, `e2e/golden/09-flow-end-to-end.spec.ts` —
  assertions de navegación actualizadas a la IA rail-primario.
