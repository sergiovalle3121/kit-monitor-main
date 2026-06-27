# AXOS OS — Auditoría Global de Fluidez UX / Visual

> Auditoría de **experiencia y fluidez** de AXOS OS, ruta por ruta. Complementa
> [`AXOS_VISUAL_AUDIT.md`](./AXOS_VISUAL_AUDIT.md) (que diagnostica el *tono*
> visual) enfocándose en el **chrome, la navegación y la sensación de shell**:
> dónde sentimos "una pantalla dentro de otra", flechas de regreso duplicadas,
> controles de tema duplicados, navegación flotante que estorba y herramientas
> potentes encerradas en un dashboard.
>
> El marco correctivo vive en
> [`AXOS_SHELL_TAXONOMY.md`](./AXOS_SHELL_TAXONOMY.md).
>
> Fecha: 2026‑06. Alcance: `apps/web`.

---

## 1. Resumen ejecutivo

AXOS ya es una plataforma grande y madura (~110 rutas bajo `/dashboard`, un
sistema de tokens sólido, chrome compartida montada una sola vez). **El problema
no es falta de plataforma, es falta de _taxonomía de shell_**: casi todas las
rutas visten el mismo cromo, y donde no encaja se nota como fricción.

Los cinco patrones de fricción más repetidos:

1. **Regreso duplicado.** El shell ya monta `DashboardWayfinding` (miga + flecha
   "subir un nivel") en **todas** las páginas `/dashboard/*`. Aun así, **~58
   páginas** dibujan además su propia flecha `ChevronLeft/ArrowLeft → volver`.
   Resultado: dos formas de "regresar" en el mismo nivel.
2. **Controles de tema duplicados.** El tema es global (`ThemeContext` → `.dark`
   en `<html>`), pero **dos workbenches** (`Layout3DEditor` de CAD y
   `SlidesEditor` de Office) tienen su propio `useState` de tema + botón
   sol/luna local que puede contradecir al `<html>`.
3. **Navegación flotante que compite.** El dock inferior y los botones flotantes
   (mensajería, Cide) son globales. En workbenches y kioscos se sienten como
   capas encima del lienzo/acciones.
4. **Pantalla dentro de pantalla.** Herramientas potentes (Office, CAD, editores
   de inteligencia, visual-aids) viven dentro del contenedor del dashboard con
   `max-w` y padding del hub, en lugar de tomar el viewport completo. *Office ya
   es la excepción correcta*: `OfficeShell` se monta `fixed inset-0 z-[110]` con
   su propio header y salida.
5. **Command centers tratados como CRUD.** Dashboard, control-tower, analytics y
   line-control-tower piden jerarquía editorial (hero + KPIs + cola de atención)
   pero hoy comparten la chrome estándar.

La corrección es **progresiva y por PRs pequeños**, no una reconstrucción. La
mayoría de los arreglos son **sustracción de cromo redundante**, no pantallas
nuevas.

### Estado de mecanismos ya existentes (no reinventar)

| Mecanismo | Dónde | Estado |
| --- | --- | --- |
| Chrome compartida (topbar + dock) montada una vez | `DashboardShell` | ✅ |
| Wayfinding/miga global con "subir un nivel" | `DashboardWayfinding` | ✅ (pero coexiste con backs locales) |
| Store de modo Kiosko (oculta cromo global) | `lib/operatorChrome` | ✅ usado por Operator Terminal |
| Workbench full-screen real | `OfficeShell` (`fixed inset-0`) | ✅ patrón a replicar |
| **Shell Taxonomy (clasificación de cromo por ruta)** | `lib/routeChrome` | 🆕 introducido en esta fase |

---

## 2. Leyenda

- **Shell type** — `Standard` · `Command Center` · `Workbench` · `Kiosk` ·
  `Public/Landing`.
- **Dup back** — ¿hay flecha de regreso local **además** del wayfinding global?
- **Dup theme** — ¿control de tema local que puede contradecir al global?
- **Botnav** — ¿el dock/flotantes tapan acciones o lienzo?
- **Float** — ¿widget flotante (chat/Cide) compite con la herramienta?
- **Narrow** — ¿se siente "pantalla dentro de pantalla" / contenedor estrecho?
- **FS** — ¿necesita workbench a pantalla completa?
- **Story** — ¿necesita storytelling/landing de producto?
- **Sev** — Severidad: `S1` alta · `S2` media · `S3` baja.
- **PR** — PR de la secuencia donde se aborda (ver §5).

---

## 3. Tabla de auditoría

### 3.1 Core / Shell

| Route | Module | Current | Recommended | Problems | Dup back | Dup theme | Botnav | Float | Narrow | FS | Story | Sev | Fix | PR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | Landing | Public/Landing | Public/Landing | Aún no comunica plataforma de clase mundial | – | – | – | – | – | – | **Sí** | S2 | Renaissance de landing: narrativa, motion sobrio, secciones de producto | 5 |
| `/login` | Auth | Public/Landing | Public/Landing | Revisar consistencia con landing | – | – | – | – | – | – | parcial | S3 | Alinear con lenguaje de landing | 5 |
| `/dashboard` | Hub | Standard | **Command Center** | Hero/jerarquía mejorables; es el centro de mando real | No | No | dock ok | Cide flota | – | – | – | S2 | Tratar como command center (hero + KPIs + cola de atención) | 4 |
| Shell global | `DashboardShell` | — | — | Lógica de cromo dispersa (kiosk/bare/office) en varios componentes | – | – | – | – | – | – | – | S2 | **Consolidada en `lib/routeChrome` (esta fase)** | 1 |
| Topbar global | `DashboardTopBar` | — | — | Único theme switch legítimo; buscador ok | – | ✅ (es el global) | – | – | – | – | – | – | Conservar | — |
| Dock inferior | `DashboardDock` | — | — | Único patrón primario también en desktop; flota sobre contenido | – | – | **Sí** en WB/kiosk | – | – | – | – | S2 | Ocultar en workbench/kiosk (esta fase); evaluar sidebar desktop | 1/2 |
| Wayfinding | `DashboardWayfinding` | — | — | Violetas hardcodeados (fuera de token); base del "back único" | – | – | – | – | – | – | – | S3 | **Tokens `--primary` (esta fase)**; volverlo el back canónico | 1/3 |
| Command palette | `SearchPalette` (⌘K) | — | — | Acento violeta intenso (ver visual audit) | – | – | – | – | – | – | – | S3 | Tokens de acento | 6 |

### 3.2 Office

| Route | Module | Current | Recommended | Problems | Dup back | Dup theme | Botnav | Float | Narrow | FS | Story | Sev | Fix | PR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/dashboard/office` | Office (lista) | Standard | Standard | Tiene back local + wayfinding | **Sí** | No | dock ok | Cide flota | – | No | – | S3 | Quitar back local; confiar en wayfinding | 6 |
| `/dashboard/office/[id]` | Office editor | **Workbench** ✅ | Workbench | Ya `fixed inset-0` con header propio; el dock quedaba en DOM bajo el overlay | No | **Sí** (`SlidesEditor` sol/luna) | resuelto vía z-index → **ahora oculto** | chat ya oculto | No | ✅ | – | S2 | **Dock oculto vía taxonomy (esta fase)**; quitar theme local de Slides | 1/3 |
| Docs editor | `office/DocEditor` | Workbench | Workbench | Hereda `OfficeShell` (ok) | No | No | – | – | No | ✅ | – | S3 | Conservar; alinear ribbon | 3 |
| Sheets editor | `office/SheetEditor` | Workbench | Workbench | Hereda `OfficeShell` (ok) | No | No | – | – | No | ✅ | – | S3 | Conservar | 3 |
| Slides editor | `office/SlidesEditor` | Workbench | Workbench | **Tema local (sol/luna + `useState`)** contradice el global | No | **Sí** | – | – | No | ✅ | – | S2 | Quitar toggle local; usar focus/present mode, no tema | 3 |

### 3.3 CAD / Engineering

| Route | Module | Current | Recommended | Problems | Dup back | Dup theme | Botnav | Float | Narrow | FS | Story | Sev | Fix | PR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/dashboard/line-engineering` | CAD / Layout | Standard (híbrido) | **Workbench** | Editor 2D/3D potente embebido en página con lista + KPIs + back local | **Sí** | **Sí** (`Layout3DEditor` sol/luna) | dock flota | Cide flota | **Sí** | **Sí** | – | **S1** | Separar editor a workbench full-screen; quitar tema local | 3 |
| `Layout3DEditor` | CAD 3D | Workbench-in-page | Workbench | Tema local + se siente encajonado | – | **Sí** | – | – | **Sí** | **Sí** | – | S1 | Frame propio tipo `OfficeShell`; tema global | 3 |
| `/dashboard/models` | Modelos | Standard | Standard | back local probable | Sí | No | dock ok | – | – | No | – | S3 | Back único | 6 |
| `/dashboard/models/[id]` | Modelo detalle | Standard | Standard | back local | **Sí** | No | – | – | – | No | – | S3 | Back único | 6 |
| `/dashboard/npi` | NPI | Standard | Standard | alto tráfico; revisar densidad | – | No | dock ok | – | parcial | No | – | S2 | Limpieza de header/acciones | 6 |
| `/dashboard/npi/[id]` | NPI Launch | Standard | **Command Center** | Es un "launch center"; back local | **Sí** | No | – | – | parcial | No | – | S2 | Tratar como command center | 4 |
| `/dashboard/bom` · `/bom/[id]` | BOM | Standard | Standard | back local en detalle | **Sí** | No | – | – | – | No | – | S3 | Back único | 6 |
| `/dashboard/routing` · `/routing/[id]` | Routing | Standard | Standard | back local en detalle | **Sí** | No | – | – | – | No | – | S3 | Back único | 6 |
| `/dashboard/visual-aids` | Visual Aids | Standard | **Workbench** | Editor de ayudas visuales encajonado | parcial | No | dock flota | Cide flota | **Sí** | **Sí** | – | S2 | Workbench full-screen para el editor | 3 |
| `/dashboard/engineering` | Engineering hub | Standard | Command Center | hub de ingeniería | – | No | – | – | – | No | – | S3 | Jerarquía de hub | 4 |
| `/dashboard/industrial-engineering` | IE | Standard | Standard | — | – | No | – | – | – | No | – | S3 | Revisar | 6 |

### 3.4 MES / Producción

| Route | Module | Current | Recommended | Problems | Dup back | Dup theme | Botnav | Float | Narrow | FS | Story | Sev | Fix | PR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/dashboard/operador` | Operator Terminal | Kiosk ✅ | Kiosk | Modo Kiosko ya oculta cromo global (`operatorChrome`); back local fuera de kiosk | parcial | No (tema global ✅) | resuelto en kiosk | resuelto en kiosk | No | – | – | S2 | Consolidar en taxonomy; reforzar action bar segura + modo guantes | 1/3 |
| `/dashboard/production` | Producción | Standard | Standard | — | – | No | dock ok | Cide | – | No | – | S3 | Revisar densidad | 6 |
| `/dashboard/live` | Live | Standard | **Command Center** | Vista en vivo de planta; back local | **Sí** | No | dock flota | Cide | parcial | – | – | S2 | Command center (cola de atención) | 4 |
| `/dashboard/line-control-tower` | Control Tower | Standard | **Command Center** | Es torre de control; back local | **Sí** | No | dock flota | Cide | parcial | – | – | **S1** | Command center premium | 4 |
| `/dashboard/control-tower` | Control Tower | Standard | **Command Center** | back local | **Sí** | No | – | – | parcial | – | – | S1 | Command center | 4 |
| `/dashboard/mission-control` | Mission Control | Standard | **Command Center** | back local | **Sí** | No | – | – | parcial | – | – | S2 | Command center | 4 |
| `/dashboard/planning` | Planeación | Standard | Standard/CC | board denso; revisar dock | – | No | dock flota | Cide | parcial | parcial | – | S2 | Revisar conflicto de dock | 6 |
| `/dashboard/production-plan` | Plan de producción | Standard | Standard | back local | **Sí** | No | – | – | – | – | – | S3 | Back único | 6 |
| `/dashboard/backflush` | Backflush | Standard | Standard | — | – | No | – | – | – | – | – | S3 | Revisar | 6 |

### 3.5 Calidad

| Route | Module | Current | Recommended | Problems | Dup back | Dup theme | Botnav | Float | Narrow | FS | Story | Sev | Fix | PR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/dashboard/quality` | Quality hub | Standard | **Command Center** | Es el Quality Command Center | – | No | dock ok | Cide | – | – | – | S2 | Command center | 4 |
| `/dashboard/quality/analytics` | Q Analytics | Standard | Command Center | back local | **Sí** | No | – | – | parcial | – | – | S2 | Command center | 4 |
| `/dashboard/quality/characteristics` | Características | Standard | Standard | back local | **Sí** | No | – | – | – | – | – | S3 | Back único | 6 |
| `/dashboard/quality/measurements` | Mediciones | Standard | Standard | back local | **Sí** | No | – | – | – | – | – | S3 | Back único | 6 |
| `/dashboard/quality/inspections` | Inspecciones | Standard | Standard | back local | **Sí** | No | – | – | – | – | – | S3 | Back único | 6 |
| `/dashboard/quality/holds` | Holds | Standard | Standard | back local | **Sí** | No | – | – | – | – | – | S3 | Back único | 6 |
| `/dashboard/quality/ncr/[id]` | NCR detalle | Standard | Standard | back local | **Sí** | No | – | – | – | – | – | S3 | Back único | 6 |
| `/dashboard/floor-quality` | Floor Quality | Standard | Standard/Kiosk | Uso en piso; back local; revisar táctil | **Sí** | No | dock flota | Cide | parcial | – | – | S2 | Evaluar variante táctil; back único | 6 |
| `/dashboard/rma` | RMA | Standard | Standard | back local | **Sí** | No | – | – | – | – | – | S3 | Back único | 6 |

### 3.6 ERP / Supply Chain

| Route | Module | Current | Recommended | Problems | Dup back | Dup theme | Botnav | Float | Narrow | FS | Story | Sev | Fix | PR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/dashboard/inventory` | Inventario | Standard | Standard | back local | **Sí** | No | dock ok | Cide | – | – | – | S3 | Back único | 6 |
| `/dashboard/materials` · `[id]` | Materiales | Standard | Standard | back local en detalle | **Sí** | No | – | – | – | – | – | S3 | Back único | 6 |
| `/dashboard/warehouse` · `/almacen` | Almacén | Standard | Standard | — | – | No | – | – | – | – | – | S3 | Revisar | 6 |
| `/dashboard/receiving` · `/inbound` | Recepción | Standard | Standard | back local (`inbound`) | **Sí** | No | – | – | – | – | – | S3 | Back único | 6 |
| `/dashboard/procurement` | Compras | Standard | Standard | back local | **Sí** | No | – | – | – | – | – | S3 | Back único | 6 |
| `/dashboard/suppliers` · `[id]` | Proveedores | Standard | Standard | back local en detalle | **Sí** | No | – | – | – | – | – | S3 | Back único | 6 |
| `/dashboard/shipping` · `/outbound` · `/packing` | Envíos | Standard | Standard | back local | **Sí** | No | – | – | – | – | – | S3 | Back único | 6 |
| `/dashboard/material-staging` | Staging | Standard | Standard | — | – | No | – | – | – | – | – | S3 | Revisar | 6 |
| `/dashboard/mrp` · `/forecast` · `/cycle-counts` | MRP/Forecast | Standard | Standard | back local (`forecast`) | **Sí** | No | – | – | – | – | – | S3 | Back único | 6 |
| `/dashboard/erp` · `/erp/*` | ERP SAP-like | Standard | Standard | back local en hub `erp` | **Sí** | No | – | – | parcial | – | – | S3 | Back único | 6 |

### 3.7 Commercial / Finance / Admin / AI

| Route | Module | Current | Recommended | Problems | Dup back | Dup theme | Botnav | Float | Narrow | FS | Story | Sev | Fix | PR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/dashboard/crm` · `/crm/*` | CRM | Standard | Standard | back local en hub + detalles | **Sí** | No | dock ok | Cide | – | – | – | S3 | Back único | 6 |
| `/dashboard/customers` · `[code]` | Clientes | Standard | Standard | back local | **Sí** | No | – | – | – | – | – | S3 | Back único | 6 |
| `/dashboard/finance` · `/finance/*` | Finanzas | Standard | Standard | densidad alta | – | No | – | – | parcial | – | – | S3 | Revisar densidad | 6 |
| `/dashboard/expenses` · `[id]` | Gastos | Standard | Standard | back local | **Sí** | No | – | – | – | – | – | S3 | Back único | 6 |
| `/dashboard/fixed-assets` · `[id]` | Activos fijos | Standard | Standard | back local | **Sí** | No | – | – | – | – | – | S3 | Back único | 6 |
| `/dashboard/intelligence` | BI hub | Standard | **Command Center** | back local | **Sí** | No | dock flota | Cide | parcial | – | – | S2 | Command center | 4 |
| `/dashboard/intelligence/editor` | BI editor | Standard | **Workbench** | Editor embebido en contenedor del hub; back local | **Sí** | No | dock flota | Cide | **Sí** | **Sí** | – | S2 | Workbench full-screen | 3 |
| `/dashboard/intelligence/object/[key]` | BI objeto | Standard | Standard | back local | **Sí** | No | – | – | parcial | – | – | S3 | Back único | 6 |
| `/dashboard/metrics` · `/reports/*` | Reportes | Standard | Standard | — | – | No | – | – | – | – | – | S3 | Revisar | 6 |
| `/dashboard/documents` | Documentos | Standard | **Workbench** | Visor/gestor potente; revisar full-screen | – | No | dock flota | Cide | parcial | parcial | – | S2 | Evaluar workbench | 3 |
| `/dashboard/settings/*` | Ajustes/Admin | Standard | Standard | back local en varias | **Sí** | No | – | – | – | – | – | S3 | Back único | 6 |
| `/dashboard/admin/*` | Admin | Standard | Standard | back local (`approvals`, `numbering`) | **Sí** | No | – | – | – | – | – | S3 | Back único | 6 |
| `/dashboard/chat` | Mensajería | Bare ✅ | Bare | Ya "bare" (sin cromo) | No | No | oculto ✅ | n/a | No | – | – | – | Conservar | — |
| `/dashboard/select-workspace` | Selector | Bare ✅ | Bare | Ya "bare" | No | No | oculto ✅ | n/a | No | – | – | – | Conservar | — |
| `/dashboard/rh/*` · `/ehs/*` · `/legal` … | Resto admin/ops | Standard | Standard | back local en varias | **Sí** | No | – | – | – | – | – | S3 | Back único por lote | 6 |

> La lista completa de `/dashboard/*` (≈110 rutas) sigue el mismo patrón: el
> **default seguro es `Standard`**; las excepciones (Command Center, Workbench,
> Kiosk) están marcadas arriba. Las rutas no listadas individualmente se tratan
> en el barrido módulo-por-módulo (PR 6).

---

## 4. Hallazgos cuantificados

| Hallazgo | Conteo | Evidencia |
| --- | --- | --- |
| Páginas con flecha de regreso local **además** del wayfinding global | **~58** | `rg "ArrowLeft\|ChevronLeft" src/app/dashboard --include page.tsx` |
| Workbenches con control de tema **local** (sol/luna + `useState`) | **2** | `Layout3DEditor` (CAD), `SlidesEditor` (Office) |
| Rutas que deberían ser **Command Center** y hoy son Standard | **~9** | dashboard, control-tower, line-control-tower, mission-control, quality, quality/analytics, intelligence, live, npi/[id] |
| Rutas que deberían ser **Workbench** full-screen y hoy van encajonadas | **~4** | line-engineering (CAD), visual-aids, intelligence/editor, documents |
| Workbench full-screen **ya correcto** (patrón a replicar) | **1** | `OfficeShell` (`fixed inset-0`) |
| Mecanismos de cromo dispersos consolidables | **3 → 1** | kiosk store + bare prefixes (×2) + checks `office/` → `lib/routeChrome` |

---

## 5. Plan de PRs secuenciales

Cada PR debe ser **pequeño, seguro y verde**.

| PR | Alcance | Estado |
| --- | --- | --- |
| **1. Audit + Shell Taxonomy + quick wins** | Este documento + `AXOS_SHELL_TAXONOMY.md` + `lib/routeChrome` (SSOT de cromo) + dock oculto en workbench/kiosk vía taxonomy + tokens `--primary` en wayfinding | **✅ esta PR** |
| **2. App shell / navigation cleanup** | Migrar `ChatWidget`/`Cide` a `routeChrome`; evaluar sidebar desktop; back canónico en wayfinding | ⏳ |
| **3. Workbench full-screen** | CAD (`Layout3DEditor`), visual-aids, intelligence/editor, documents → frame tipo `OfficeShell`; quitar temas locales (CAD/Slides) | ⏳ |
| **4. Dashboard / command centers** | Hero + KPIs + cola de atención en dashboard, control-tower, line-control-tower, quality, intelligence, live | ⏳ |
| **5. Landing renaissance** | `/` y `/login`: narrativa, motion sobrio, secciones de producto | ⏳ |
| **6. Module-by-module cleanup** | Quitar ~58 backs locales por lotes; densidad/headers; tokens en command palette | ⏳ |

---

## 6. Quick wins entregados en PR 1

1. **`lib/routeChrome` — Shell Taxonomy como fuente única.** Clasifica cada ruta
   en `standard | command-center | workbench | kiosk | landing` combinando
   pathname + el store de Kiosko. Reemplaza la lógica dispersa (prefijos "bare"
   duplicados en `DashboardShell` y `DashboardWayfinding`, checks `office/`).
2. **Dock fuera de los workbenches/kiosks.** `DashboardShell` ya no renderiza el
   dock inferior en rutas workbench/kiosk (antes quedaba en el DOM bajo el
   overlay full-screen de Office). Cero regresión visual, menos capas
   compitiendo y mejor accesibilidad (sin controles ocultos bajo el overlay).
3. **Tokens de acento en el wayfinding.** Se eliminan los `violet-*`
   hardcodeados de `DashboardWayfinding` (prohibidos por el lenguaje visual) a
   favor de `--primary`. La miga es la base del futuro "back único".

Lo demás queda mapeado pero **no** tocado en esta fase, para mantener la PR
pequeña y revisable.
