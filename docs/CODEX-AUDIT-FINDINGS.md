# Auditoría de las contribuciones de Codex — hallazgos

Auditoría (solo-lectura) de todo lo aportado por el agente **Codex** (ramas `codex/*`,
etiqueta `codex`). Verdicto por pieza + hallazgos con evidencia `archivo:línea` y fix
recomendado. **Todo lo de abajo ya está mergeado en `main`** salvo donde se indique.

> Lanes: la corrección de estos hallazgos toca **office** (Codex) y **line-engineering/CAD**
> (otra sesión). Se documentan aquí para que sus dueños los arreglen sin pisarnos.

## Resumen de severidad

| # | Área | Severidad | Estado |
|---|------|-----------|--------|
| 1 | SheetEditor: "protección" no se aplica | **Media/Alta** (falsa garantía) | en main (#646) |
| 2 | CAD parser: unidades/targets | **Alta** (corrompe el comando principal) | en main (#649) |
| 3 | Migración comments: falta `uuid-ossp` | Baja (latente; dormido por synchronize) | en main (#650) |
| 4 | XLSX: pérdida en casos borde | Media | en main (#651) |
| 5 | AXOS_SUPPLIER_SCORE / template cacheado | Baja (visible) | en main (#651) |

---

## 1. SheetEditor — la protección de celdas NO se aplica (falsa garantía)

`apps/web/src/components/office/SheetEditor.tsx`. El único punto que consulta
`isCellProtected` es `beforeUpdateCell` (~`:239`), que solo intercepta el **tecleo manual**
en la rejilla. Todos los demás caminos de escritura la saltan porque usan `setCellValue`/
`handlePaste`/mutación directa de `celldata` (que no re-disparan el hook):

- Barra de fórmulas `commitFormulaBar` (~`:291`), autofill/IA (~`:560`), Solver/goal-seek (~`:738`).
- Pegar (`runGridCommand('paste')` → `wb.handlePaste`, ~`:342`), formato rápido, limpiar
  formato, insertar/borrar fila-columna (`shiftRows`/`shiftCols`), sort, fill, transpose.

**Efecto:** el toast "Celda protegida…" promete algo que no se cumple. Para el caso de uso
(bloquear celdas de fórmula en templates industriales) **no protege**.

**Fix recomendado:** o (a) forzar `isCellProtected` en TODOS los mutadores (envolver
`setCellValue`/`handlePaste`/los helpers que clonan `celldata`), o (b) dejar de prometer
protección en la UI hasta que (a) esté.

## 2. CAD command engine — bugs de parser (unidades y targets)

`apps/web/src/lib/cad/commands/parser.ts` (motor puro bajo `lib/cad/commands/`).

- **Alta — `cm` mal escalado ×100.** El regex de unidades (`:3`) omite `cm`; con unidad
  ausente cae a metros (`:31`). `"50cm"` → 50000 mm. Fix: añadir `cm` (×10) al regex/tabla.
- **Alta — `in`/`ft` se parsean pero NUNCA se convierten** (`:30-34` → `registry.ts:60-65`):
  `12in` se usa como 12 mm. Fix: convertir in→25.4 mm, ft→304.8 mm.
- **Alta — extracción de targets rota para nombres cortos** (`:5-10`): el split por
  `entre| y | e | a ` parte targets de 1 letra; `"entre A y B"` da `targetA="<prefijo>"`,
  `targetB="y B"`. Fix: tokenizar por límites de palabra, no por subcadena.
- **Media — snapshots `before` son referencias vivas a `context.objects`, no copias**
  (`registry.ts:77,108,146,361`): si el host muta cajas in-place, el undo restaura el estado
  ya movido. Fix: clonar en el snapshot.
- **Media — `openAiCompatibleToolSchemas()` emite JSON-Schema inválido** (`registry.ts` ~`:530`):
  tipos `"string[]"`/`"enum"` crudos, no válidos para tool-calling de un LLM.
- Menores: distribute puede dar gap negativo → solapa (sin warning); history stack sin tope.

`registry.spec.ts` es un smoke happy-path (no en CI) y no cubre nada de lo anterior.

## 3. Migración de comments — falta `CREATE EXTENSION "uuid-ossp"`

`apps/api/src/.../migrations/20260627120000-CreateOfficeDocumentComments.ts`. Usa
`uuid_generate_v4()` como default del id pero, a diferencia de ~10 migraciones hermanas,
**no** habilita la extensión. Funciona hoy solo porque otra migración la habilita antes;
en ejecución standalone/reordenada falla. (Doblemente latente: con `synchronize` ON las
migraciones ni corren.) Fix: anteponer `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`.

## 4. XLSX round-trip — pérdida en casos borde

`apps/web/src/lib/office/xlsxStyled.ts` (ExcelJS) / `xlsx.ts` (SheetJS). El caso común
(nota + hyperlink en celda con valor) round-trip bien. Bordes:
- Nota en celda **vacía** se pierde (`xlsxStyled.ts:122-126`).
- Tooltip de hyperlink se escribe pero no se relee (`:298` vs `:123`).
- `xlsx.ts:49,62` fija autor `'AXOS'` y colapsa múltiples comentarios en una nota.

## 5. AXOS_SUPPLIER_SCORE + valor cacheado del template

`apps/web/src/components/office/sheets/industrialFunctions.ts:131-140` — `AXOS_SUPPLIER_SCORE`
trata `cost` como "más es mejor" en un promedio ponderado: un proveedor más barato puntúa
**peor** salvo que el caller normalice el costo. Y en `lib/office/templates.ts` el Supplier
Scorecard siembra `v: 0.95625` donde la fórmula `=B2*0.35+C2*0.35+D2*0.15+E2*0.15` da
**0.95825** (cosmético hasta recalcular).

`AXOS_SUM_VISIBLE` (`:153`) suma todo el rango pese al nombre (filtro no implementado).

---

## Lo que está SANO (sin acción)

- **#640 (web lint)** — sin regresiones (useCall capture seguro; ChatWidget diferido; skills derivado).
- **#650 (backend de comments)** — endpoints **autenticados**, SQL **parametrizado**, input
  validado (DTOs con `@MaxLength`/`@IsInt`/`@Max`), tenant-safe (hereda el modelo por-email del
  módulo office). Sin inyección. El `AxosRef` + export DOCX correctos.
- **#651 `industrialFunctions.ts`** — OEE/Cpk/yield/cost-rollup/ABC matemáticamente correctos
  (salvo los traps semánticos del punto 5).
