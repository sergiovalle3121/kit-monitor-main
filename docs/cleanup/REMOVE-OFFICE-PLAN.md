# Plan de limpieza — Quitar Office + cascarones

> **Estado:** FASE 0 (mapa) + FASE 1 (ejecución) completas, según decisiones del owner.
> Rama: `claude/remove-office-shells-ncvn0u` (rama designada por el harness para esta tarea).

## Decisiones del owner (aplicadas)

- **Q1 (cascarones):** borrar **solo `documents`** (redirect muerto a Office). Se
  **conservan** `lab`, `industrial-engineering`, `metrics` (hubs funcionales) y `chat`
  (mensajería interna; ver nota abajo — pendiente de confirmación final de alcance).
- **Q2 (`lib/office/`):** **borrar los 80 archivos.** Antes de borrar, los 5 archivos de
  **generación de documentos** quedan listados como **referencia histórica** (§8) para
  reconstruir los machotes/plantillas estándar de Jabil más adelante. El resto
  (auditoría/gobernanza de sheets) es peso muerto y se elimina sin más.
- **Q3 (acople `/office-documents` con operador/MES, Balde 2):** **dejar el código
  intacto y anotarlo** (§Hallazgo 3 / §4). No se toca Balde 2.

---

## 0. Resumen ejecutivo y discrepancias detectadas

El alcance pedido fue: **(A)** quitar la suite Office (Docs/Sheets/Slides, front + back +
componentes) y **(B)** borrar 5 "cascarones vacíos" (`documents`, `chat`, `lab`,
`industrial-engineering`, `metrics`) + las páginas dev de Office.

Tras el mapeo exhaustivo (FASE 0) hay **dos hallazgos que contradicen la descripción** y
requieren decisión del owner **antes** de borrar:

### ⚠️ Hallazgo 1 — Los "5 cascarones vacíos" NO están vacíos (salvo uno)

| Ruta | Líneas | ¿Qué es realmente? | ¿Vacío? |
|---|---|---|---|
| `documents` | 13 | Solo `redirect("/dashboard/office")`. Al irse Office, queda muerta. | ✅ Sí — cabo suelto real |
| `chat` | 12 | Monta `<ChatExperience variant="page" />` — el **chat a pantalla completa**. Está cableado en `DashboardDock`, `DashboardTopBar`, `ChatWidget` (botón "ampliar"), `DashboardNavSheet` y `SearchPalette`. | ❌ **No** — feature funcional integrada |
| `lab` | 36 | Hub de departamento (`DepartmentWorkspace`) con KPIs en vivo (`/ncr`) y tiles de navegación. Linkeado en `dashboardAreas`. | ❌ **No** — hub funcional |
| `industrial-engineering` | 44 | Hub con KPIs en vivo (`/line-engineering/kpis`) y navegación. Linkeado en `dashboardAreas` + barrido visual e2e. | ❌ **No** — hub funcional |
| `metrics` | 84 | Hub con KPIs en vivo (`/plans`, cost-rollup) + desglose de costos. Linkeado en `dashboardAreas`, `chat/toolSources` y barrido visual e2e. | ❌ **No** — hub funcional |

Borrar `chat` **rompe** el botón "ampliar chat" del dock/topbar/widget en toda la app.
Borrar `lab`/`industrial-engineering`/`metrics` elimina hubs con datos reales y deja
links muertos en la navegación principal y en un test de barrido visual.

**→ Decisión del owner (ver §5, Q1).** Recomendación: borrar **solo `documents`**;
conservar `chat`, `lab`, `industrial-engineering`, `metrics`.

### ⚠️ Hallazgo 2 — `lib/office/` (~80 archivos) no estaba en la lista de borrado

`apps/web/src/lib/office/` es el motor de la suite (xlsx/docx/pptx, auditorías,
deckGen…). No aparece en la lista explícita del prompt, pero al borrar
`components/office` queda **huérfano**: fuera de Office/dev, solo lo usan
`quality/analytics` y `mission-control` vía `deckGen` (que vamos a desconectar, ver §2).
**→ Decisión del owner (ver §5, Q2).** Recomendación: borrarlo también.

### ⚠️ Hallazgo 3 — Acople del endpoint API `/office-documents` con Balde 2 (operador/MES)

`mes-execution` y el panel del operador construyen URLs `/office-documents/{id}` para
mostrar documentos Office adjuntos a instrucciones de trabajo (tipo de ayuda visual
`office`). Al quitar `OfficeModule` del backend, ese endpoint deja de existir y esas
ayudas visuales tipo "office" darían 404. **Esto toca Balde 2 (operador).**
**→ Decisión del owner (ver §5, Q3).** Recomendación: dejar el código intacto y anotarlo
(las ayudas visuales tipo `office` simplemente no resolverán hasta que se decida su
destino); NO es bloqueante para el resto.

---

## 1. Archivos a BORRAR (suite Office)

**Front (suite):**
- `apps/web/src/app/dashboard/office/` — `page.tsx`, `[id]/page.tsx`
- `apps/web/src/components/office/` — **276 archivos** (el prompt estimaba ~93; conteo real 276)
- `apps/web/src/app/dev/pptx-foreign/`, `apps/web/src/app/dev/pptx-roundtrip/`, `apps/web/src/app/dev/deck-gen/`

**Back (suite):**
- `apps/api/src/modules/office/` — **15 archivos** (controller, service, module, dto, entities, specs)

**Tests e2e que prueban los arneses dev borrados (deben irse con ellos):**
- `apps/web/e2e/golden/10-slides-pptx-roundtrip.spec.ts` → prueba `/dev/pptx-roundtrip`
- `apps/web/e2e/golden/11-ems-deck-gen.spec.ts` → prueba `/dev/deck-gen`
- `apps/web/e2e/golden/12-pptx-foreign-import.spec.ts` → prueba `/dev/pptx-foreign`

**Pendiente de decisión (Q2):**
- `apps/web/src/lib/office/` — **80 archivos** (motor de la suite, huérfano tras lo anterior)

---

## 2. Referencias externas a LIMPIAR (desenredar ANTES de borrar)

Cada fila = referencia fuera de Office que apunta a la suite. "Acción" = qué se hace.

| # | Archivo:línea | Referencia | Acción |
|---|---|---|---|
| 1 | `apps/api/src/app.module.ts:95,189` | `import { OfficeModule }` + registro | Quitar import y entrada en `imports[]` |
| 2 | `apps/web/src/app/dashboard/quality/analytics/page.tsx:19,178-194,195,233` | `GenerateDeckButton` + `buildQualityDeck` (de `lib/office/deckGen`) + `deckEmpty` | Quitar import, función `buildQualityDeckFn`, JSX `<GenerateDeckButton>`, var `deckEmpty`. **Quality sigue sano** (solo pierde el botón "Generar deck") |
| 3 | `apps/web/src/app/dashboard/mission-control/page.tsx:34,263-276,301+` | `GenerateDeckButton` + `buildLineReviewDeck` | Quitar import, `buildLineDeck`, JSX. **Mission-Control sigue sano** (solo pierde "Generar deck") |
| 4 | `apps/web/src/components/searchSources.ts:14,28,31,103-109,190-201,214,232,276` | Fuente de búsqueda `doc` → `GET /office-documents`, href `/dashboard/office/{id}` | Quitar `'doc'` de `SearchKind`/`ENTITY_ORDER`/`buckets`, `RawDoc`, `DOC_TYPE_LABEL`, `mapDocs`, fetch `/office-documents`, `collect('doc',…)`. Búsqueda global sigue con wo/ncr/part/person |
| 5 | `apps/web/src/components/SearchPalette.tsx:70,126` | Entrada rápida "Office" + color `/office` | Quitar la entrada; quitar `'/office'` del mapeo de color `comms` |
| 6 | `apps/web/src/lib/dashboardAreas.ts:106` | Área de navegación "Office" (`href:/dashboard/office`) | Quitar la fila. **Conservar** el token `domain:"office"` que usa Legal (línea 104) y otros |
| 7 | `apps/web/src/app/page.tsx:59` | `{ id:"office", href:"/dashboard/office" }` en la grilla del hub | Quitar la entrada |
| 8 | `apps/web/src/components/landing/LandingBento.tsx:310-325` | Tile "Office" del landing + claves i18n `office.kicker`/`office.body` | Quitar el tile; revisar/limpiar claves i18n |
| 9 | `apps/web/src/lib/routeChrome.ts:46-51,107` | `WORKBENCH_PREFIXES = ["/dashboard/office/"]` + comentarios | Vaciar el array (CAD sigue usando `imperativeWorkbench`); actualizar comentarios |

**Solo si se aprueba borrar los hubs (Q1, variante amplia):** también limpiar
`dashboardAreas.ts:41,73,85,124`, `chat/toolSources.ts:59-61` y
`visual-sweep/evidence3.spec.ts:24-25` (rutas `metrics`/`industrial-engineering`).

---

## 3. Referencias que NO se tocan (token de diseño `office`, coincidencias)

El identificador `"office"` se usa muchísimo como **dominio/color de diseño** (gris),
NO como la suite. **Conservar todo esto** — tocarlo rompería Legal, Reports, etc.:

- `apps/web/src/lib/tokens.ts:35,59`, `apps/web/src/lib/design/domains.ts:40,75` — token de color `office`
- `apps/web/src/lib/cad/architecture.ts:18,121,179` — clasificación CAD "office"
- `apps/web/src/lib/chat/emojis.ts:354` — emoji 🏢
- `apps/web/src/hooks/usePermissions.ts:9` — comentario `'office:*'`
- `apps/web/src/app/dashboard/legal/page.tsx:377`, `reports/page.tsx:62`, `fixed-assets/page.tsx:30` (comentario), `notifications/_lib/sources.ts:64`, `dashboardAreas.ts:104` — `domain:"office"`
- `apps/api/src/seed/seed-demo.ts:1827` — `domain:'office'` de una notificación (href a `/dashboard/notifications`)
- `apps/web/src/app/dashboard/operador/work-instruction-panel.utils.ts` — tipo de ayuda visual `office` (ver Hallazgo 3)
- `apps/web/src/app/globals.css:324` — comentario "Office ribbon" (scrollbar)
- `apps/web/src/app/dashboard/import/page.tsx:85` — `wb.Sheets` (API de la lib `xlsx`, no la suite)
- `apps/web/src/components/line-engineering/plot-sheet.*` — `sheetSize` (plano, no la suite)
- `apps/web/src/app/dashboard/operador/page.tsx:957` — comentario de sección "Sheets"

---

## 4. Backend: tablas huérfanas (NO dropear — regla #3)

Quitar `OfficeModule` deja **9 tablas huérfanas**. Por la regla #3 **NO** se escribe
migración destructiva; las tablas quedan sin uso (inofensivo) y se anotan aquí. Las
**migraciones existentes se conservan** (son historia aplicada; borrarlas no dropea nada
y rompería la integridad del historial):

```
office_documents
office_document_versions
office_comments
office_document_comments
office_document_search_index
office_document_distributions
office_document_signatures
office_document_training_assignments
office_document_review_tasks
```

- 10 migraciones `*Office*` en `apps/api/src/migrations/` → **se quedan**.
- `apps/api/src/seed/forbidden-scan.ts:97-98` referencia `office_documents`/`office_document_versions`
  en su config de redacción → **se queda** (las tablas siguen existiendo; inofensivo).

---

## 5. Decisiones del owner (BLOQUEANTES antes de FASE 1)

**Q1 — Los "5 cascarones":** ¿qué borramos realmente?
- **(Recomendado)** Solo `documents` (cabo suelto real). Conservar `chat`, `lab`, `industrial-engineering`, `metrics`.
- Borrar `documents` + `lab` + `industrial-engineering` + `metrics`; conservar `chat`. (También limpio sus links de nav + e2e.)
- Borrar los 5 tal cual se pidió. (Rompo/limpio dock, topbar, ChatWidget, navsheet, palette, dashboardAreas, toolSources y e2e — el chat full-page deja de existir.)

**Q2 — `lib/office/` (80 archivos huérfanos):** ¿borrar también o dejar?
- **(Recomendado)** Borrar `lib/office/` (nada lo usa tras desconectar `deckGen`).
- Dejarlo (fuera del alcance literal del prompt) — quedaría como código muerto.

**Q3 — Acople `/office-documents` en operador/MES (Balde 2):** ¿cómo lo tratamos?
- **(Recomendado)** Dejar el código intacto, solo anotarlo (ayudas visuales tipo `office` no resolverán; no bloqueante).
- Quitar la rama de ayuda visual `office` en operador/MES (toca Balde 2 — requiere tu OK explícito).

---

## 6. FASE 1 (tras aprobación) — orden de ejecución

1. Limpiar **referencias externas** (§2, filas 1-9) para que nada apunte a Office.
2. Quitar entradas de **navegación / command-palette / búsqueda / landing**.
3. **Borrar** dirs/archivos de Office (front + back + componentes), `lib/office` (si Q2),
   páginas `dev/pptx-*`/`deck-gen`, los e2e correspondientes, y el/los cascarón(es) aprobados en Q1.
4. **Gate:** `npm run build` ✅, typecheck ✅, lint ✅, test ✅. Verificar que **Quality** y
   **Mission-Control** siguen funcionando (sin imports rotos) y que no quedan links muertos.

---

## 7. "Hecho" (entregable)

- Este documento con lo borrado y lo desenredado.
- Office + `lib/office` (80) + páginas `dev/pptx-*` + shell `documents` eliminados.
- Balde 2 intacto; el resto compila y navega sin links muertos; Quality y Mission-Control sanos.
- Tablas huérfanas anotadas (NO dropeadas).
- UN PR (draft), sin mergear.

---

## 8. Referencia histórica — generación de documentos (`lib/office/`, ya borrados)

Estos 5 archivos vivían en `apps/web/src/lib/office/` y se **eliminaron** con el resto de
la suite, pero se documentan aquí a propósito: contienen la lógica de **generación/exportación
de documentos** que servirá de base cuando se construyan los **machotes/plantillas estándar de
Jabil** (SOPs, reportes). Recuperables desde el historial de git (`git show <commit>^:<ruta>`).

| Archivo | Qué hacía | Librerías / notas de interés |
|---|---|---|
| `lib/office/pdf.ts` | Exporta un documento TipTap (JSON) a **PDF** vía HTML intermedio (`tiptapJsonToHtmlDocument` → `jsPDF`). | `jspdf`. Sanitiza nombre de archivo; extrae `<body>` del HTML. |
| `lib/office/docx.ts` | Interop **Word**: `exportDocx` (TipTap JSON → `.docx` con la lib `docx`, MIT) e `importDocx` (`.docx` → HTML con `mammoth`, BSD). | `docx`, `mammoth`, ambas por import dinámico. Maneja imágenes embebidas (data URLs → bytes + dimensiones). |
| `lib/office/templates.ts` | **Galería de plantillas** "nuevo documento": doc/sheet estáticas (TipTap/Fortune-sheet) + slides pintadas con Fabric. Cada plantilla "se ve terminada y profesional al abrir" (paletas reales, fondos, jerarquía tipográfica). | Contrato verificado en `NIGHT_LOG_TEMPLATES.md`. **La referencia más directa para los machotes de Jabil.** |
| `lib/office/slidesPdf.ts` | Rasteriza un **deck de slides** (Fabric StaticCanvas) a **PDF** 16:9 full-bleed, una página por slide. | `fabric`, `jspdf`, import dinámico. |
| `lib/office/typography.ts` | **Tipografía inteligente** (el "Autoformato" de Word): comillas/apóstrofos curvos, raya `—`, elipsis `…`, `© ® ™`, fracciones. Función pura, sin dependencias. | Integración con el editor vivía en `components/office/docs/smartTypography.ts`. |

> El resto de `lib/office/` (auditoría de fórmulas, gobernanza/salud de workbooks, conectores
> AXOS, import/export xlsx/pptx, etc.) era peso muerto tras quitar la suite y se eliminó sin
> reservarlo. Si en el futuro se necesita, está en el historial de git.
