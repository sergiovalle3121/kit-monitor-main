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

> Ampliación posterior: **«Mostrar valores como % del total»** por campo de valor
> (`showAs: 'pctTotal'`), formateado como porcentaje en la salida.

> **Actualizable**: cada tabla dinámica creada en hoja nueva guarda su definición
> (`content.pivots`); el botón **Insertar → Actualizar tablas dinámicas** vuelve a
> calcularlas sobre el origen actual y reescribe la hoja destino. Si la hoja destino se
> renombró/borró, se omite sin perder la definición.

> Spec del pivot: **30 aserciones** (incluye el camino combinado columnas × filas
> anidadas × subtotales × totales, y % del total).

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

### 3) Datos: orden multinivel, subtotales y minigráficos  ✅
**Lógica pura** en `sheetOps.ts`:
- `sortRangeMulti(sheet, {range, hasHeader, keys[]})` — ordena por **varias columnas**
  en orden de prioridad (numérico/alfabético `es`).
- `applySubtotals(sheet, {range, groupColRel, valueColRels[], fn, hasHeader})` — inserta
  filas de **subtotal por grupo consecutivo** + **total general** (estilizadas) y
  desplaza el contenido inferior.
- `buildSparkline(values, type)` / `applySparkline(sheet, dataRange, cell, type)` —
  **minigráficos en celda** unicode (barras ▁▂▃▅▇ o pérdidas/ganancias ▲▼).

**UI**: `SheetDataDialog` ampliado — orden con hasta **3 niveles** (añadir/quitar),
**Subtotales** (grupo + columnas de valor + función) y **Sparkline** (rango → celda
destino + tipo). Botones en el ribbon: **Datos → Subtotales**, **Insertar → Sparkline**;
«Ordenar rango» ahora es multinivel.

**Spec**: `data.spec.ts` (15). Verde.

> Ampliación: **autofiltro no destructivo** — `buildFilter(sheet, {range, hasHeader,
> criteria[]})` + `matchesCriterion` (=, ≠, >, ≥, <, ≤, contiene, no contiene, vacío,
> no vacío; AND de criterios). Genera una **hoja nueva «Filtro N»** con las filas que
> cumplen, sin tocar el origen. UI: modo «Filtrar» en `SheetDataDialog`; ribbon
> Datos → «Filtrar a hoja». Spec `filter.spec.ts` (13).

> Checkpoint: `next build` verde tras los hitos 1–3.

### 4) Gráficos pro  ✅
**`charts.ts`**: nuevos tipos **burbuja** (X/Y/Tamaño con radio escalado 4–24) y
**combinado** (barras + líneas por serie). Modelo ampliado: `SeriesOpt` por serie
(tipo, **eje secundario** Y2, color), títulos de eje X/Y/Y2, `usesSecondaryAxis`,
`seriesLabels`. `buildChartData` aplica overrides por serie y `yAxisID`.

**`SheetCharts.tsx`**: `chartOptions` con **eje Y secundario** (grid independiente) y
títulos de ejes; registrado `BubbleController`. Editor de gráfica ampliado:
títulos de eje, y un panel **«Series y ejes»** con color, tipo (en combo) y eje
(Y/Y2) por serie; el selector de hoja muestra el nombre real.

**Spec**: `charts.spec.ts` (14) — barras, combo, eje secundario, color por serie,
burbuja. Verde.

> Checkpoint: `next build` verde tras los gráficos pro.

### 5) Asistente de funciones ampliado  ✅
`SheetFunctionWizard.tsx` reescrito: **~70 funciones** en 8 categorías
(Matemáticas, Estadística, Lógica, Texto, Fecha y hora, Búsqueda, **Financieras**),
cada una con **sintaxis, descripción y ayuda por argumento** (incluye opcionales).
Layout maestro-detalle: categorías · lista buscable · panel de detalle con
**inserción guiada** (`=NOMBRE(`) e **inserción de plantilla** (`=NOMBRE(arg1; arg2)`).
- *Diferido*: autocompletado **dentro** del editor de celda al escribir `=` — el
  motor de Fortune-Sheet es dueño del input del grid; interceptarlo es frágil. El
  asistente cubre el descubrimiento e inserción guiada (estimación: 0.5–1 día para
  un overlay sobre el editor nativo, a validar contra futuras versiones del paquete).

### 6) Import/Export .xlsx de alta fidelidad  ✅
`lib/office/xlsx.ts` reescrito con mapeo **puro** y testeable:
- `cellToXlsx` / `xlsxToFortuneV`: valores tipados (n/s/b), **fórmulas** (`f`) y
  **formatos de número** (`z` ↔ `ct.fa`).
- `fortuneToWs` / `wsToFortune`: hojas completas con **combinaciones** (`!merges`) y
  **anchos de columna** (`!cols` ↔ `config.columnlen`). Import con `cellFormula`,
  `cellNF`, `cellStyles`.
- CSV con **delimitador** configurable (coma / punto y coma / tabulación) y BOM.

`SheetActions`: menú de exportación con las 3 variantes CSV.

**Spec**: `xlsx.spec.ts` (16) — mapeo puro + **round-trip real con SheetJS**
(valor, formato de número, fórmula y combinación se conservan).
- *Límite documentado*: SheetJS **edición comunitaria no escribe estilos** (relleno/
  fuente/color) al .xlsx; los estilos visuales se mantienen dentro de AXOS. El número-
  formato, fórmulas, combinaciones y multi-hoja sí round-trip. (Fidelidad total de
  estilos requeriría SheetJS Pro u otra librería permisiva; estimación 1–2 días + due
  diligence de licencia.)

> Checkpoint: `next build` verde tras el hito .xlsx.

### 7) Buscar y reemplazar pro  ✅
`sheetOps.ts`: `findMatches` y `replaceAll` reescritos con `FindOpts`
(`caseSensitive`, **`wholeCell`**, **`regex`**, **`sheetIndex`** para alcance) y
`buildFindRegex` (escape seguro + regex inválida sin lanzar).
`SheetFindReplace.tsx`: alcance **Libro/Hoja actual**, distinguir mayúsculas, celda
completa, expresión regular (con aviso de regex inválida) y reemplazar todo.

**Spec**: `findreplace.spec.ts` (11). Verde.

### 8) Productividad: rellenar series y transponer  ✅
`sheetOps.ts`:
- `fillSeries(seed, count)` — continúa series: **aritméticas** (paso detectado),
  **fechas** (paso en días), **meses/días** (es, respeta mayúscula), **texto con
  número final** ("Item 1"→"Item 2"), o repite el patrón. `applyFill` rellena un
  rango semilla hacia **abajo/derecha** por columnas/filas.
- `transposeRange(sheet, src, dest)` — pegado especial **transponer** (preserva
  estilo y valor).
- Endurecido `toDate` para no confundir texto con números ("Item 1") con fechas.

**UI**: `SheetDataDialog` con modos **Rellenar serie** (dirección + cantidad) y
**Transponer** (celda destino). Ribbon: grupo «Rellenar y transponer» en Datos.

**Spec**: `fill.spec.ts` (25, incl. `copyRange`). Verde.

> Ampliación: **pegado especial** `copyRange(sheet, src, dest, mode)` con modos
> **todo / solo valores / solo formatos**. UI: modo «Pegado especial» en
> `SheetDataDialog` + botón en el ribbon.

### 9) Rangos con nombre + administrador  ✅
`sheetOps.ts`: `validateRangeName` (reglas tipo Excel: forma de celda, reservados R/C,
duplicados), `qualifiedRef` (referencia A1 con hoja entrecomillada) y
`resolveNamedRange` (nombre → rango/hoja, o A1 directo).
`SheetNameManager.tsx`: alta con validación, eliminación, **insertar referencia** en la
celda activa y **copiar** al portapapeles. Persistido en el documento (`names` en el
contenido; `SheetEditor` lo serializa). Ribbon: **Fórmulas → Administrador de nombres**.
- *Nota*: el uso de nombres **dentro del motor de fórmulas** depende de Fortune-Sheet
  (no soporta named ranges nativos); AXOS ofrece registro + inserción/copia de la
  referencia real, y `resolveNamedRange` queda listo para que las funciones propias
  (pivot/gráficas) acepten nombres en el futuro.

**Spec**: `names.spec.ts` (12). Verde.

### 10) Impresión / diseño de página  ✅
`sheetOps.ts`: `buildPrintHtml(sheet, opts)` — documento HTML imprimible del **área
de impresión** (rango o área usada), con **encabezado/pie**, **título**,
**orientación** (vertical/horizontal), **líneas de cuadrícula** y **ajustar al ancho**;
conserva valores y estilos básicos (fondo, color, negrita, alineación) y **escapa HTML**.
`SheetPrintDialog.tsx`: opciones + **vista previa** en iframe (`srcDoc`). Atajo
**Ctrl/⌘+P** y pestaña **Diseño de página → Imprimir** (disponible también en solo
lectura). `doPrint` abre ventana y lanza `print()`.

**Spec**: `print.spec.ts` (9). Verde.

### 11) Formato condicional: barras de datos  ✅
`applyConditional` gana la regla **`databar`**: dibuja una barra proporcional (█/░,
ancho 10) en cada celda numérica del rango, coloreada; **idempotente** (no acumula al
reaplicar, vía `stripIcon` ampliado). Expuesto en `SheetTools` con selector de color.
- *Diferido*: **administrador de reglas** persistente (el enfoque actual «hornea» el
  formato en la celda; un gestor que reevalúe requeriría separar reglas del modelo y
  reconciliar — estimación 1–1.5 días).

**Spec**: `cond.spec.ts` (8) — barras de datos (incl. idempotencia), comparación y limpiar.

**Total de aserciones de lógica pura: 162** (11 specs, `npx tsx`).

---

## Resumen para el revisor

**Qué se construyó (todo sobre Fortune-Sheet, MIT, sin tocar el ribbon compartido):**

| # | Función | Lógica pura nueva (`sheetOps.ts` / `charts.ts` / `xlsx.ts`) | UI |
|---|---------|-----------|----|
| 1 | **Tablas dinámicas** | `buildPivot`, `aggregate`, `pivotToCelldata`, `readMatrix`, `pivotFields`, `fieldValues`, `usedRange` | `SheetPivot.tsx` (DnD) |
| 2 | **Formatos de número + estilos** | `formatNumber`, `applyNumberFormat`, `applyCellStyle`, `toDate`, `NUMFMT_PRESETS`, `CELL_STYLES` | `SheetFormatDialog.tsx` |
| 3 | **Orden multinivel · subtotales · sparklines** | `sortRangeMulti`, `applySubtotals`, `buildSparkline`, `applySparkline` | `SheetDataDialog.tsx` |
| 4 | **Gráficos pro** | burbuja/combo/eje 2º, `seriesLabels`, `usesSecondaryAxis` | `SheetCharts.tsx` |
| 5 | **Asistente de funciones** | (datos) ~70 fns + args | `SheetFunctionWizard.tsx` |
| 6 | **.xlsx alta fidelidad** | `cellToXlsx`, `xlsxToFortuneV`, `fortuneToWs`, `wsToFortune` | `SheetActions.tsx` (CSV opts) |
| 7 | **Buscar/reemplazar pro** | `findMatches`/`replaceAll` + `FindOpts`, `buildFindRegex` | `SheetFindReplace.tsx` |
| 8 | **Rellenar series · transponer** | `fillSeries`, `applyFill`, `transposeRange` | `SheetDataDialog.tsx` |
| 9 | **Rangos con nombre** | `validateRangeName`, `qualifiedRef`, `resolveNamedRange` | `SheetNameManager.tsx` |
| 10 | **Impresión / diseño** | `buildPrintHtml` | `SheetPrintDialog.tsx` |
| 11 | **Formato condicional: barras de datos** | regla `databar` en `applyConditional` | `SheetTools.tsx` |

**Cómo correr las specs** (no requieren runner ni dependencias nuevas):
```
cd apps/web && npx tsx src/components/office/sheets/<nombre>.spec.ts
# specs: pivot, numfmt, cellstyle, data, charts, xlsx, findreplace, fill, names, print, cond
```
`npx tsx` (transitorio, no se añade a `package.json`) resuelve el alias `@/` y las
importaciones sin extensión bajo Node 22.

**Verde:** `tsc --noEmit`, `eslint` (sin errores nuevos; los *warnings* de refs en
`SheetEditor` son preexistentes) y `next build` — validados varias veces durante la sesión.

## Dependencias y licencias
- **Sin dependencias nuevas.** Todo se apoya en lo ya presente:
  - `@fortune-sheet/react` — **MIT** (motor de hoja y fórmulas).
  - `xlsx` (SheetJS) — **Apache-2.0** (import/export).
  - `chart.js` + `react-chartjs-2` — **MIT** (gráficos).
  - `framer-motion` (MIT), `lucide-react` (ISC) para la UI.
- **PROHIBIDO y evitado:** HyperFormula (GPL) y cualquier copyleft. No se introdujo
  ningún paquete; el motor de fórmulas sigue siendo el de Fortune-Sheet.

## Diferido (con estimación)
- **Autocompletado de funciones dentro del editor de celda** al escribir `=`
  (el motor es dueño del input; overlay frágil) — ~0.5–1 día.
- **Administrador de reglas de formato condicional** persistente (hoy se «hornea») — ~1–1.5 días.
- **Fidelidad total de estilos en .xlsx** (SheetJS CE no escribe relleno/fuente/color) — ~1–2 días + licencia.
- **What-if (tabla de datos / buscar objetivo)** y **agrupar/esquema de filas-columnas**
  nativos — dependen de soporte de Fortune-Sheet; no incluidos para no mergear nada inestable.
- **Hipervínculos / proteger rango-hoja**: Fortune-Sheet ofrece parte de forma nativa;
  no se duplicó para evitar comportamiento inconsistente.

## Auto-revisión (code-review multiángulo)
Se pasó una revisión propia (agentes en paralelo: lógica pura, *wiring* React,
consistencia de *callers*). Resultado: contratos de payload y firmas consistentes,
`tsc` 0 errores. **2 bugs reales corregidos** con test de regresión:
1. `fillSeries` no continuaba **meses abreviados** (`['ene','feb']`) — ahora detecta
   `MONTHS_FULL`/`MONTHS_ES`/días y conserva el estilo. (test añadido)
2. `charts.ts num()` devolvía `NaN` (no 0) para celdas no numéricas (`Number('abc') ?? 0`),
   corrompiendo el escalado de burbujas — ahora `Number.isFinite(n) ? n : 0`. (test añadido)

(El modo `copyRange('values')` conserva el número-formato del origen: es el comportamiento
de «Valores y formatos de número» de Excel, intencional.)

## Seguridad / paralelismo
- Solo se tocaron archivos de **Hojas** (`Sheet*`, `lib/office/sheetOps.ts|xlsx.ts|charts.ts`,
  `components/office/sheets/**`). **No** se tocó el ribbon compartido, `OfficeShell`,
  `office/[id]/page.tsx`, Docs/Slides, `globals.css`, `eslint.config.mjs`, ni nada fuera de Office.
- Rama `claude/wizardly-goodall-LfB7g`, **PR abierto sin mergear** (#261) para revisión del dueño.
</content>
</invoke>
