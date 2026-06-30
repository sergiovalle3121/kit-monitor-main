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

---

## 9. Pase 2 — sidebar como cajón + herramientas a pantalla completa

Feedback del owner sobre la versión desplegada del pase 1. Decisiones confirmadas:
sidebar **oculto por defecto** (contenido a pantalla completa) y herramientas
grandes (Chat, Office, CAD) a **pantalla completa** (los avisos chicos siguen
centrados).

| Tema | Cambio | Evidencia (`e2e/__visual__/report2/`) |
| --- | --- | --- |
| **Sidebar** | El rail persistente se elimina. La navegación es un **cajón** que se abre/cierra desde el botón **"Axos OS"** (con ícono panel↔cerrar, affordance clara y sincronizada). El contenido queda **a pantalla completa**. El cajón sale debajo de la barra para que "Axos OS" siga sirviendo de toggle. | `home-fullscreen.png`, `nav-drawer-open.png` |
| **CAD** | Botón **"✕ Cerrar"** rojo, claro y siempre visible a la izquierda; la barra de herramientas usa **`flex-wrap`** para que **nunca recorte ni choque**. | `cad-cerrar.png` |
| **Chat** | Se abre a **pantalla completa** (no cuadro central); el mismo botón flotante hace **toggle** (se vuelve ✕) y **cambia de tono** cuando hay mensajes sin leer. | `chat-fullscreen.png` |
| **Buscador ⌘K** | Menos texto (placeholder corto, sin párrafo de ayuda), **"✕" rojo** para cerrar, se despliega desde la barra (debajo del topbar). | `search-simplified.png` |

Modelo nuevo de navegación: store compartido `src/lib/navDrawer.ts`
(`useNavOpen`/`toggleNav`) → el botón "Axos OS" (`DashboardTopBar`) y el cajón
(`DashboardNavSheet`, ahora universal) están siempre en sync. Se eliminó
`DashboardCommandRail` (rail persistente) y el padding lateral del contenido.

**QA de colisiones:** el barrido (384 combos) confirma **0 errores de navegación**
y **0 hallazgos altos nuevos** introducidos por el cambio de layout. El único
`horizontal-overflow` son **7 tiras de tabs en móvil 390** (`crm`, `import`,
`operador`, `reports`, `rh`, `settings/permissions`, `warehouse`) — pre-existentes
(no en desktop), pendientes de `flex-wrap`/`overflow-x-auto` por página.

---

## 10. Pase 3 — Landing premium ("app de billion dólar")

Feedback del owner: la landing "se siente barata, no como la de OpenAI o Apple".
Pedido explícito: **movimientos traslúcidos** vivos, **más imágenes / cosas que
hablen por sí solas** (no texto seco), **textos colapsables**, copy **elocuente y
claro** sobre lo que hace la app, y dar el salto a que **se sienta de altísimo
valor**. Frontend-only; sin logos de clientes, certificaciones ni métricas
comerciales inventadas (la demo sigue siendo de muestra / solo lectura).

| Tema | Cambio |
| --- | --- |
| **Aurora viva (hero)** | Orbes traslúcidos índigo/violeta/cian que derivan en bucle + malla cónica girando lentísimo (estilo OpenAI/Google). CSS en `globals.css` (`.hero-orb`, `.hero-conic`, `.float-slow`, `.product-halo`, `.marquee-track`/`.marquee-mask`). Todo bajo `prefers-reduced-motion` → estático. |
| **Producto que se muestra solo** | `LandingMockup.tsx`: recreación fiel (no captura frágil) de la Torre de Control — KPIs, throughput y andon por línea — flotando bajo el hero con halo. Marquesina de capacidades en movimiento. |
| **Bento de capacidades** | `LandingBento.tsx`: reemplaza la cuadrícula de texto seco ("Product story") por **8 losetas con micro-visualizaciones** que *enseñan* el producto: pipeline plan→piso, anillo OEE, e-kanban, línea de trazabilidad, hold MRB, snippet de IA (CIDE) y Office. Cada loseta enlaza a su ruta real. Patrón Apple/Linear/Stripe. |
| **Textos colapsables** | La sección *Solutions* pasa a **acordeón** (`<details>`): resumen + bullets que "se explican para abajo". La FAQ ya era colapsable. |
| **Copy elocuente** | Titular del hero con acento en gradiente; secciones con voz de producto ("No te lo contamos. Te lo enseñamos.", "Publica la orden y míralo ejecutarse."). |

Consolidación: se eliminó la sección redundante "Product story" (cuadrícula de
tarjetas de texto, casi idéntica a *galaxy*/*platform*) — esa repetición de rejillas
era justo lo que abarataba la página. Los anclajes "Módulos" (nav + footer) apuntan
ahora a `#capabilities` (el bento).

**QA:** `tsc` y `eslint` limpios; `next build` OK; sin `console.*` nuevos.
Verificado a 1440 y 390, en **claro y oscuro**: hero, bento (escritorio en grid
bento / móvil apilado a altura de contenido), acordeón abierto y `scrollWidth ==
clientWidth` (sin overflow horizontal) en móvil.

Archivos: `src/app/page.tsx`, `src/app/globals.css`,
`src/components/landing/LandingMockup.tsx`, `src/components/landing/LandingBento.tsx`.

---

## 11. Pase 4 — Pulir la app por dentro (defectos concretos)

Tras la landing, el owner pidió **elevar el dashboard y los módulos núcleo** al
mismo nivel premium, "arreglando lo que se vea barato o roto". Se capturaron las
superficies núcleo **autenticadas** (sesión de owner + mock backend, vía
`e2e/visual-sweep/evidence3.spec.ts`, opt-in `EVIDENCE3=1`) en claro/oscuro y
escritorio/móvil. De ahí salieron dos defectos reales y sistémicos:

| Defecto | Detalle | Fix |
| --- | --- | --- |
| **Ícono invisible en losetas** | El patrón `color: 'text-primary'` + `tint: 'bg-primary dark:bg-primary/10'` pinta, en **modo claro**, una loseta de color sólido con un glifo **del mismo color** → cuadro liso sin ícono. Aparecía en **5 hubs**: ERP (Ventas), RH (Analítica), Métricas (Forecast), Ingeniería Industrial (Forecast) y Finanzas (Contabilidad). | Tinte suave + glifo de color visible (igual que las losetas hermanas): violeta/índigo según la lista, sin colisión de color. Visible en claro **y** oscuro. |
| **Hub ERP "alarmado" en vacío** | Los `StatCard` de Utilidad neta y Activos pintaban **rojo/ámbar** cuando no hay datos (el endpoint devuelve vacío `{}`, no un número), haciendo ver el ERP como en pérdida/descuadre al entrar. | Se colorea **solo cuando hay un número real** (`typeof … === 'number'`); sin dato → color neutro. El rojo/verde por signo se conserva con datos reales. |

**Decisión de alcance:** la navegación (doble "volver" breadcrumb + cabecera de
workbench en Mission Control/ERP/Operador) se dejó **como está** — es chrome ya
iterado y aprobado en los pases 1–2; reabrirlo añadiría riesgo sin defecto claro.

**QA:** `tsc` 0 · `eslint` 0 · `next build` OK · sin `console.*` nuevos.
Verificado en claro y oscuro (ERP: Ventas con ícono violeta y StatCards neutros;
Finanzas: Contabilidad con ícono violeta visible).

Archivos: `src/app/dashboard/erp/page.tsx`, `src/app/dashboard/rh/page.tsx`,
`src/app/dashboard/metrics/page.tsx`,
`src/app/dashboard/industrial-engineering/page.tsx`,
`src/app/dashboard/finance/page.tsx`, `e2e/visual-sweep/evidence3.spec.ts`.

---

## 12. Pase 5 — A11y: nombres accesibles en los back-links de ícono

Tras verificar que el interior está visualmente sólido (no había más defectos
visuales que arreglar), se ataca lo único concreto y verificable que quedaba del
barrido: **`axe:link-name`**. El mismo back-link de ícono (`‹` → volver) estaba
**copiado en 31 páginas sin nombre accesible** — un `<Link>` que envuelve solo un
`<ChevronLeft/>`, sin texto ni `aria-label`. Para un lector de pantalla era un
enlace "en blanco".

| Patrón | Páginas | `aria-label` |
| --- | --- | --- |
| `‹` → `/dashboard` (volver al hub) | 21 | `Volver al inicio` |
| `‹` → lista padre (páginas de detalle `[id]`/`[code]`) | 9 | `Volver` |
| `‹` → `/dashboard/rh` (sub-cabecera RH) | 1 | `Volver a Recursos Humanos` |

Cambio quirúrgico: **31 archivos, 1 línea cada uno** (solo se añade el atributo;
sin cambio visual ni de comportamiento). Mission Control ya tenía su `aria-label`,
así que queda consistente con el resto.

**Evidencia:** barrido axe sobre rutas afectadas (`crm`, `traffic`,
`line-engineering`, `maintenance`, `skills`) → **`axe:link-name` = 0** (antes
fallaban). `tsc` + `eslint` limpios, `next build` OK.

**Pendiente (no en este PR):** el resto de la deuda de a11y del barrido es
`axe:color-contrast` (texto *muted* por debajo de 4.5:1) y algún `axe:button-name`
— son cambios a nivel de token/iconos sueltos, de otra naturaleza; se dejan como
follow-up trackeable.

---

## 13. Pase 6 — A11y: nombres en botones de ícono + back-links sueltos

Cierre del trabajo de nombres accesibles. El barrido completo (96 rutas) tras el
pase 5 ya mostraba `link-name` **92 → 1** y `button-name` **14 → ≤5**; aquí se
liquidan los que quedaban (desktop **y** móvil):

| Ruta | Control | Causa | `aria-label` |
| --- | --- | --- | --- |
| `/login` | Toggle de contraseña | botón con solo `Eye`/`EyeOff` | `Mostrar/Ocultar contraseña` (según estado) |
| `/dashboard/forecast` | Back-link `‹` | usa otra clase, no entró en el pase 5 | `Volver al inicio` |
| `/dashboard/crm` | "Nueva cuenta" / "Oportunidad" | el texto es `hidden sm:inline` → en móvil queda solo el ícono | `Nueva cuenta` / `Nueva oportunidad` |
| `/dashboard/maintenance` | "Nueva orden" | ídem (texto oculto en móvil) | `Nueva orden` |
| `/dashboard/outbound` | "Desde OV" | ídem | `Desde OV` |
| `/dashboard/shipping` | "Nuevo embarque" | ídem | `Nuevo embarque` |

Patrón de fondo: botones `<Icon/> <span className="hidden sm:inline">Texto</span>`
que en móvil pierden su nombre. El `aria-label` (igual al texto visible) le da
nombre estable en todos los breakpoints, sin cambio visual.

**Evidencia:** re-barrido axe de las 6 rutas en **escritorio y móvil** →
`axe:button-name = 0` y `axe:link-name = 0`. Con el pase 5, la app queda **sin
violaciones de nombre accesible**. `tsc` + `eslint` limpios, `next build` OK.
Único pendiente de a11y: `axe:color-contrast` (token-level, follow-up aparte).

---

## 14. Pase 7 — Contraste: texto muted más legible en claro (modo "equilibrado")

Medición primero (axe, modo claro, con colores reales): el ~90% de los fallos de
contraste es **un solo patrón** — texto gris muted (`text-gray-400`/`-500`) usado
**~2900 veces**. Llevarlo a AA estricto = oscurecer todo el texto secundario, lo
que cambia el look "airy" afinado. Con el owner se eligió la opción **equilibrada**:
subir el texto más faint **un paso, solo en modo claro**, dejando el **modo oscuro
idéntico**.

**Cambio:** `text-gray-400` (standalone, el tono más faint, ratio 2.53 — ilegible)
→ `text-gray-500 dark:text-gray-400`. Transform con perl y *lookbehind* para tocar
**solo** el utility standalone (no `dark:`/`hover:`/`bg-`/`border-`). El paired
`text-gray-400 dark:text-gray-500` se normaliza aparte. **249 archivos, 1 línea ↔ 1
línea** (solo cambia el className).

- **Modo claro:** el texto más faint pasa de #99a1af (2.53) a #6a7282 — legible,
  pasa en tarjetas blancas (~4.8) y queda marginal (4.43) solo sobre el fondo
  off-white de página.
- **Modo oscuro:** **byte-idéntico** (el `dark:text-gray-400` conserva el tono).
  Verificado con capturas before/after (claro y oscuro).

**Resultado (12 rutas muestra):** nodos de contraste en fallo **112 → 76 (−32%)**;
desaparecen los peores (2.53). Gates: `tsc` 0 · `eslint` 0 (warnings pre-existentes) ·
`next build` OK.

**Pendiente (documentado, no en este PR):** (a) los 4.43 sobre fondo de página
(a 0.07 de pasar — requeriría el paso estricto a `gray-600` o aclarar el fondo);
(b) un gris hardcodeado `#86868b` en un componente; (c) ~7 botones/píldoras con
texto blanco/acento sobre tinte claro (naranja/azul/ámbar). Son de otra naturaleza
(token estricto / por componente) y se dejan como follow-up.

---

## 15. Pase 8 — Bugs de contraste reales (audit multi-agente)

Los follow-ups del §14 (gris `#86868b`, botones/píldoras de acento) resultaron más
extensos de lo estimado. Se midió **en claro y oscuro** (axe, 36 rutas) capturando
los colores reales y filtrando el tier de gris muted ya resuelto → **163 nodos de
bug genuino, 133 distintos**.

**Orquestación (Workflow):** se hizo *scout* inline (axe) y luego un workflow de
**4 cazadores en paralelo** (uno por tipo de defecto: `#86868b`, blanco-sobre-acento,
acento-sobre-tinte, valores-acento en oscuro) que localizan cada instancia y calculan
el fix mínimo que pasa AA en su familia de tono; después una **fase de verificación
adversarial** (un agente por edit) que recomputa el ratio y descarta falsos positivos.
De **82 ediciones propuestas → 70 confirmadas** (69 low-risk, 1 med, 12 rechazadas).
Las ediciones de los agentes se **descartaron del árbol** y se re-aplicaron solo las
70 verificadas (find/replace exacto), para no introducir cambios sin verificar.

| Tipo | Fix |
| --- | --- |
| `#86868b` (Apple-gray hardcodeado, módulo settings) | → `text-gray-600 dark:text-gray-400` (token estándar, ~7:1; oscuro conserva tono) — 32 edits |
| Blanco sobre acento claro (botones amber/emerald/orange) | bg al tono `-700`/`-800` donde el blanco pasa ≥4.5 — 35 edits |
| Valor-acento en **oscuro** (botón `bg-primary` blanco) | `--primary` (solo en `.dark`) de 70%→60% L para que el blanco pase — 3 edits |

**Resultado:** nodos de bug genuino **163 → 69 (−58 %)**; desaparecen `#86868b` y los
peores blanco-sobre-acento. `tsc` 0 · `eslint` 0 · `next build` OK. Verificado en
claro y oscuro.

**Cola restante (documentada):** ~35 botones blanco-sobre-acento adicionales (patrón
muy extendido) y los **colores semánticos de valores KPI** (ámbar/esmeralda/azul como
números) — estos últimos son decisión de paleta (como el gris del §14) y conviene el
visto bueno del owner antes de oscurecerlos. Siguiente paso natural si se quiere
cerrar del todo.

---

## 16. Pase 9 — Cola blanco-sobre-acento (audit multi-agente)

Continúa el §15 cerrando los **botones con texto blanco sobre acento claro**.
Mismo método: scout (axe claro+oscuro) aísla los fondos de acento donde el blanco
falla; un workflow de **3 cazadores por familia de color** (esmeralda/teal,
naranja/rojo/rosa, azul) localiza cada botón y calcula el **fondo mínimo** del mismo
tono donde el blanco llega a ≥4.5:1; verificación adversarial recomputa cada ratio.
**29 propuestas → 27 confirmadas** (14 low, 13 med). Se re-aplicaron solo las 27
verificadas (descartando ediciones directas de los agentes).

| Fondo (fallaba) | → | Tono nuevo |
| --- | --- | --- |
| teal `#0fb39a` (2.65) | → | teal-700 `#0f766e` (5.47) |
| esmeralda `#10b981` (2.53) | → | emerald-700 `#047857` |
| naranja `#ff7a45`, rojo `#ef4444`, rosa `#f43f5e` | → | `-600`/`-700` del mismo tono |
| azul `#3b82f6` (1 caso) | → | blue-600 `#2563eb` |

En las constantes compartidas (`TEAL`, `GREEN`, `ROSE`) se cambió **solo el fondo
del botón** a un literal más oscuro, dejando la constante para texto/tintes (la
marca no se mueve). **Resultado: nodos de bug genuino 69 → 53 (−23 %)**; blanco-sobre-
acento 37 → 21. `tsc` 0 · `eslint` 0 · `next build` OK, claro+oscuro.

**Cola restante (decisión de paleta / borderline, documentada):** botones azul-500
`#3b82f6` (×10, componente compartido) y apple-blue `#0a84ff` (×6) a ~3.65:1 — patrón
muy común (azul vibrante + blanco), a un paso de pasar; el índigo de marca
(`#6366f1`/`#6467f2`) ya ronda 4.4–4.5; y los **colores semánticos de valores KPI**.
Oscurecerlos del todo es decisión de paleta del owner. **Los bugs de contraste
claramente malos (ratios 2.5–2.65, `#86868b`) ya quedaron cerrados** entre §15 y §16.
