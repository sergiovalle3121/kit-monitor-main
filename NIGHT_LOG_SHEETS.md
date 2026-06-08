# NIGHT_LOG — Hojas de cálculo (Excel) a nivel Microsoft

Sesión nocturna dedicada a llevar las **Hojas de cálculo** de AXOS lo más cerca
posible de Microsoft Excel, construyendo sobre Fortune-Sheet (MIT) y su motor de
fórmulas.

- **Rama de trabajo:** `claude/wizardly-goodall-LfB7g` (rama de sesión asignada
  por el harness; cumple el rol de la `claude/office-sheets` del brief: nunca se
  mergea a `main`, PR abierto para revisión del dueño). Se anota aquí por
  transparencia: el harness enruta esta sesión por esa rama y prohíbe empujar a
  otra sin permiso.
- **No se toca:** ribbon compartido (`components/office/ribbon/**`),
  `OfficeShell.tsx`, `office/[id]/page.tsx`, nada de Docs/Slides, `globals.css`,
  `eslint.config.mjs`, ni nada fuera de Hojas.
- **Archivos propios:** `SheetEditor.tsx`, `SheetTools.tsx`, `SheetCharts.tsx`,
  `SheetActions.tsx`, `SheetDataDialog.tsx`, `SheetFindReplace.tsx`,
  `SheetFunctionWizard.tsx`, `lib/office/sheetOps.ts`, `lib/office/xlsx.ts`,
  `lib/office/charts.ts`, y nuevos `Sheet*` / `components/office/sheets/**`.

## Verificación
- `tsc --noEmit` limpio (base verde antes de empezar).
- Lint: las Hojas no tenían **errores** (solo *warnings* preexistentes de refs en
  `SheetEditor`). No se introducen errores nuevos.
- **Specs de lógica pura** (pivot, agregaciones, orden multinivel, etc.) en
  `components/office/sheets/*.spec.ts`, ejecutables con `npx tsx` (sin añadir
  dependencias ni tocar la config de build). Node 22 + tsx resuelven el alias
  `@/` y las importaciones sin extensión.

---

## Bitácora (orden cronológico)

### Arranque
- Reconocimiento del estado actual (PR #258 ya trae: asistente de funciones,
  buscar/reemplazar, diálogo de datos, formato condicional avanzado,
  `sheetOps.ts`, gráficos ampliados). Estrategia: **construir profundidad encima**
  sin rehacer lo existente.

### 1) Tablas dinámicas (pivot) — motor propio + UI  ✅ v1 sólida
**Lógica pura** en `lib/office/sheetOps.ts`:
- `buildPivot(sheet, cfg)` → matriz lista para volcar a celdas. Soporta:
  - **Filas y columnas anidadas** (N niveles), ordenadas (numérico/alfabético `es`).
  - **Múltiples campos de Valores**, cada uno con su agregación.
  - **9 agregaciones**: suma, cuenta, cuenta-A, promedio, mín, máx, producto,
    desv. estándar (muestra) y varianza (`aggregate()` reutilizable).
  - **Subtotales** del campo de fila externo, **totales de fila** (columna «Total
    general») y **total general** (fila).
  - **Filtros por valor** por campo.
  - Buckets en una sola pasada O(N) para escalar a miles de filas.
- `pivotToCelldata(res, r0, c0)` → celldata de Fortune-Sheet con estilos
  (cabeceras azules, subtotales/totales sombreados, números alineados a la derecha).
- Helpers: `readMatrix`, `usedRange`, `pivotFields`, `fieldValues`, `colName`, `a1`,
  `roundNice`.

**UI**: `SheetPivot.tsx` — constructor con **arrastrar y soltar** campos a
Filtros/Columnas/Filas/Valores (con *fallback* de clic), selector de agregación por
valor, editor de filtro por valores (checkboxes), reordenado de campos (anidación),
detección automática del rango (`usedRange`), y destino **hoja nueva** o **celda de
la hoja actual**.

**Integración**: pestaña **Insertar → Tabla dinámica** en `SheetEditor`. Genera la
tabla en una hoja nueva «Tabla dinámica N» o en una celda destino (sin pisar fuera
de la región), y re-monta el grid.

**Spec**: `components/office/sheets/pivot.spec.ts` (24 aserciones, `npx tsx`): cubre
agregaciones, pivot 1D/2D, promedio, subtotales, filtros y múltiples valores.
Verde. `tsc` y lint sin errores.

> Nota técnica: las claves de los buckets del pivot usan `JSON.stringify` (libres de
> colisión) en vez de un separador mágico.

### 2) Formato de número + estilos de celda  ✅
**Lógica pura** en `sheetOps.ts`:
- `formatNumber(value, code, opts)` — subconjunto práctico tipo Excel:
  número/miles, **moneda**, **contable** (negativos entre paréntesis), **porcentaje**,
  **científico** (exponente con 2 dígitos), **fracción** (aprox. p/q≤99), **fecha/hora**
  con *tokenizer* propio que distingue `mm` mes vs. minuto y soporta seriales Excel,
  ISO y `Date`. `NUMFMT_PRESETS` para la UI.
- `applyNumberFormat(sheet, range, code)` — hornea `m` y guarda el código en `ct.fa`.
- `applyCellStyle(sheet, range, style)` + `CELL_STYLES` (Normal/Título/Encabezado/
  Énfasis/Total/Bueno/Malo/Neutral/Nota) y alineación/ajuste de texto (`ht`/`vt`/`tb`).
  Crea celdas vacías solo en rangos pequeños (≤4000) para no inflar el modelo.

**UI**: `SheetFormatDialog.tsx` — pestañas **Número** (galería de presets + código
personalizado + símbolo de moneda + **vista previa en vivo**) y **Estilos** (galería +
alineación/ajuste). Pestaña **Formato** en el ribbon; prefija el rango con la
**selección actual** del grid (`getSelection`).

**Specs**: `numfmt.spec.ts` (27) y `cellstyle.spec.ts` (9). Verdes.
</content>
</invoke>
