# AXOS OS — Shell Taxonomy

> **Fuente única de verdad** sobre *qué cromo* viste cada ruta de AXOS. AXOS es
> un sistema operativo industrial, no un admin template: distintas tareas piden
> distintos shells. No todas las rutas deben usar el mismo chrome.
>
> Diagnóstico: [`AXOS_GLOBAL_UX_FLUIDITY_AUDIT.md`](./AXOS_GLOBAL_UX_FLUIDITY_AUDIT.md).
> Tono/visual: [`AXOS_DESIGN_LANGUAGE.md`](./AXOS_DESIGN_LANGUAGE.md).
>
> Implementación: [`apps/web/src/lib/routeChrome.ts`](../../apps/web/src/lib/routeChrome.ts).

---

## 0. Principio central

> **Una ruta = un tipo de shell.** El tipo se declara en `lib/routeChrome` y el
> cromo global (topbar, wayfinding, dock, widgets flotantes) reacciona desde ahí.
> Nunca se reparte la decisión con `pathname.startsWith(...)` por componente.

Cinco experiencias. El **default seguro es `Standard`**; las demás son
excepciones declaradas.

```ts
type ChromeMode =
  | 'standard'        // listado / CRUD / operación administrativa
  | 'command-center'  // torre de control: hero + KPIs + cola de atención
  | 'workbench'       // herramienta full-screen (Office, CAD, editores)
  | 'kiosk'           // piso de producción (terminal MES, táctil)
  | 'landing';        // público (landing / login / marketing)
```

| Modo | Topbar global | Wayfinding | Dock inferior | Widgets flotantes | Viewport |
| --- | --- | --- | --- | --- | --- |
| `standard` | ✅ | ✅ miga + back único | ✅ | ✅ | contenido `max-w` |
| `command-center` | ✅ | ✅ | ✅ | ✅ | hero ancho + grid |
| `workbench` | propio del tool | salida propia | ❌ oculto | ❌ ocultos | full viewport |
| `kiosk` | propio industrial | ❌ | ❌ oculto | ❌ ocultos | full viewport táctil |
| `landing` | propio público | ❌ | ❌ | ❌ | full, editorial |

---

## 1. Standard Module Page

Para módulos de listado/CRUD/operación administrativa: Inventory, Suppliers,
Quality (sub-listas), NPI, CRM, Finance, Settings, y la mayoría de `/dashboard/*`.

**Reglas:**

- **Topbar global** (`DashboardTopBar`) + **PageHeader** consistente con loseta
  de dominio, título `H1` y subtítulo.
- **Un solo regreso.** El `DashboardWayfinding` global ya da miga + "subir un
  nivel". Las páginas Standard **no** dibujan su propia flecha
  `ChevronLeft/ArrowLeft → volver`. Nunca dos flechas para regresar en el mismo
  nivel.
- **Acciones visibles arriba** (alineadas a la derecha del header).
- **Filtros debajo del header**, no flotando.
- **Ancho de contenido** según densidad (`max-w-5xl`/`max-w-7xl`); evitar tablas
  pegadas a los bordes.
- **El dock no tapa acciones.** Las action bars fijas dejan colchón inferior
  para el dock; los CTA críticos no quedan bajo él.
- **Modales consistentes** (material `.glass`, velo neutro, sombra nivel 2).

---

## 2. Command Center

Para torres de control: Dashboard, Control Tower, Line Control Tower, Mission
Control, Quality Command Center, NPI Launch Center, Analytics/Intelligence, Live.

**Reglas:**

- **Hero editorial** arriba (saludo/estado de la operación), no un PageHeader
  CRUD.
- **KPIs útiles** en fila simétrica (`KpiRow`, `tabular-nums`), tinte de dominio
  solo en la firma.
- **Cola de atención** (`attention queue`): qué requiere acción, ordenado por
  severidad — el corazón del command center.
- **Cards accionables / de decisión** que **navegan a los módulos**, en vez de
  CRUD inline.
- **Menos CRUD puro**: el command center decide y deriva; el detalle vive en las
  páginas Standard.
- Mantiene topbar + dock globales (no es full-screen).

---

## 3. Full-Screen Workbench

Para herramientas complejas: Office (Docs/Sheets/Slides), CAD/Layout editor,
Documents, AI/CIDE workspace, Visual Aids editor, editores de Intelligence.

**Patrón de referencia ya en el código:** `OfficeShell`
(`fixed inset-0 z-[110]` con header propio + salida + fullscreen). Replicarlo.

**Reglas:**

- **Usa todo el viewport.** Nada de contenedor `max-w` ni padding del hub: no se
  debe sentir como iframe/pantalla dentro de pantalla.
- **Oculta/minimiza el cromo global**: sin dock inferior, sin widgets flotantes
  encima del lienzo. Se declara `workbench` en `routeChrome` y el shell deja de
  montarlos.
- **Tools/ribbon dentro del workbench** (header propio · ribbon/toolbars ·
  canvas/editor · status bar).
- **Status bar** propia abajo (estado de guardado, zoom, selección…).
- **Fullscreen / focus mode** reales dentro del tool.
- **Salida clara**: un solo control de "volver a {módulo}" en el header del
  workbench (p. ej. "← Office"), nunca dos.
- **Un solo tema de _app_.** El claro/oscuro sale del `ThemeContext` global; un
  workbench **no** monta su propio toggle sol/luna de app. Sí puede tener ajustes
  de dominio que NO son tema de app y deben conservarse: presets de **escena 3D**
  (CAD `Layout3DEditor`: fondo/niebla/sol), **tema del deck** y **blackout del
  presentador** (Office `SlidesEditor`), `focusMode`/`presentMode`. *(La
  inspección de PR 2 confirmó que hoy no existe ningún toggle de tema de app
  contradictorio.)*

---

## 4. Kiosk / Terminal

Para piso de producción: `/dashboard/operador`, terminal MES, tablet/kiosko
industrial.

**Patrón ya en el código:** store `operatorChrome` (modo Kiosko oculta el cromo
global). Integrado en `routeChrome`.

**Reglas:**

- **Sin chrome innecesario**: el modo Kiosko oculta topbar, wayfinding, dock y
  widgets flotantes; manda el topbar industrial propio.
- **Un solo sistema de tema global.** Nada de doble sol/luna. El terminal puede
  tener `kioskMode`, `gloveMode`, `densityMode`, pero el claro/oscuro es el
  global.
- **Action bar segura**: las acciones críticas (confirmar, andon, incidencia) no
  quedan tapadas por nada flotante.
- **Modo guantes** (`gloveMode`): targets táctiles grandes, espaciado generoso.
- **Modo kiosko / pantalla completa**: cero distracciones, UI táctil.
- **Cero capas encima de acciones críticas** (ni chat ni Cide).

---

## 5. Public / Landing

Para landing/login/marketing (`/`, `/login`).

**Reglas:**

- **Storytelling**: secciones que venden el valor de la plataforma, no un panel
  de admin.
- **Motion controlado** y sobrio (respeta `prefers-reduced-motion`).
- **Jerarquía visual** fuerte: hero → prueba de valor → secciones de producto →
  CTA.
- **Secciones de producto** con screenshots/mockups si existen.
- **Modernidad sin saturación**: aire, tipografía, un acento.
- **Sin claims falsos.**
- Sin cromo de app (ni dock ni widgets).

---

## 6. Cómo se aplica (contrato técnico)

`lib/routeChrome` expone:

```ts
useRouteChrome(): {
  mode: ChromeMode;            // tipo de la ruta actual
  inDashboard: boolean;        // bajo /dashboard
  bare: boolean;               // sin NINGÚN cromo global (kiosk o ruta bare)
  hideDock: boolean;           // ocultar dock (bare o workbench)
  hideFloatingWidgets: boolean;// ocultar ChatWidget + Cide (fuera de dashboard,
                               //   bare/kiosk, o cualquier workbench)
}
```

- **`BARE_PREFIXES`** — rutas que montan su propio layout full-screen sin cromo
  (`/dashboard/chat`, `/dashboard/select-workspace`).
- **`WORKBENCH_PREFIXES`** — editores full-screen declarados por pathname
  (`/dashboard/office/…`; se amplía conforme visual-aids/intelligence migren).
- **Workbench imperativo** — un editor full-screen montado dentro de una ruta
  `standard` (p. ej. el CAD `Layout3DEditor` en la pestaña CAD de
  `line-engineering`) se declara workbench mientras está abierto vía
  `setWorkbenchChrome(true)` (store `operatorChrome`), y lo restablece al
  cerrarse. Así oculta el dock y los widgets flotantes que de otro modo quedan
  ENCIMA del lienzo.
- El **modo Kiosko** es imperativo (lo activa el Operator Terminal vía
  `operatorChrome`) y se combina aquí: una ruta kiosk siempre gana a su
  clasificación por pathname.
- **Consumidores actuales:** `DashboardShell` (`bare`, `hideDock`),
  `ChatWidget` y `Cide` (`hideFloatingWidgets`). Ningún componente vuelve a leer
  `pathname.startsWith(...)` ni el kiosk store por su cuenta.

**Para clasificar una ruta nueva:**

1. ¿Es un editor full-screen? → añade su prefijo a `WORKBENCH_PREFIXES` y monta
   un frame tipo `OfficeShell`.
2. ¿Es una torre de control? → trátala como `command-center` (hero + KPIs + cola
   de atención). *(La distinción Command Center hoy es semántica/visual; comparte
   el cromo de `standard`.)*
3. ¿Es piso de producción? → usa el store de Kiosko.
4. ¿Monta su propio layout sin cromo? → `BARE_PREFIXES`.
5. En cualquier otro caso → `standard` (default seguro).

---

## 7. Checklist por tipo de shell

**Standard**
- [ ] ¿Una sola flecha de regreso (la del wayfinding), sin back local?
- [ ] ¿PageHeader consistente + acciones arriba?
- [ ] ¿Filtros bajo el header, ancho según densidad?
- [ ] ¿El dock no tapa acciones?

**Command Center**
- [ ] ¿Hero editorial (no PageHeader CRUD)?
- [ ] ¿KPIs + cola de atención + cards que navegan?
- [ ] ¿Menos CRUD inline?

**Workbench**
- [ ] ¿Full viewport, sin sensación de pantalla-en-pantalla?
- [ ] ¿Dock + flotantes ocultos (declarado `workbench`)?
- [ ] ¿Header propio con salida única + status bar + fullscreen/focus?
- [ ] ¿Un solo tema (sin toggle local)?

**Kiosk**
- [ ] ¿Cromo global oculto, action bar segura?
- [ ] ¿Un solo tema global (sin doble sol/luna)?
- [ ] ¿Modo guantes / táctil, cero capas sobre acciones críticas?

**Landing**
- [ ] ¿Storytelling + jerarquía + motion sobrio?
- [ ] ¿Secciones de producto, sin saturación ni claims falsos?
