# AXOS OS — Night Log · Carril TEMPLATES (Office)

Bitácora del carril de **plantillas de Office** (Documentos / Hojas / Diapositivas).
Rama: `claude/zen-einstein-eicv79`. Reglas: SOLO frontend; NO tocar
`apps/api`/esquema/`app.module.ts`; verde (eslint + tsc + next build) → commit; **sin
PR salvo que se pida**. Archivos del carril:
`apps/web/src/lib/office/templates.ts`,
`apps/web/src/components/office/docs/DocTemplates.tsx`,
`apps/web/src/components/office/TemplateGallery.tsx`.

---

## ▶ RETOMAR AQUÍ

> **Objetivo de la sesión:** convertir las ~14 plantillas (slides = 3 cascarones de
> texto sobre blanco) en una **biblioteca rica y diseñada** que compita con
> PowerPoint/Word/Excel, **reusando los motores que ya existen** (Fabric en slides,
> TipTap en docs, Fortune-sheet en hojas). Metas: Slides 18-24 · Docs 12-15 ·
> Hojas 10-12.

### Capacidades REALES de los motores (verificado por grep — NO inventar)
- **Slides (Fabric v6, `SlidesEditor.loadInto` → `c.loadFromJSON`)**: cada slide es
  el `c.toJSON()` de un `StaticCanvas` → `{ version, background, objects: [...] }`.
  Objetos válidos: `Textbox`, `Rect` (con `rx/ry`), `Circle` (`radius`), `Line`,
  `Triangle`, `Polygon`. Props estándar de Fabric (left/top/width/height/fill/
  fontSize/fontWeight/fontStyle/fontFamily/textAlign/stroke/strokeWidth/opacity/
  lineHeight/charSpacing/angle). El fondo del slide sale de `json.background`.
  `applyTemplate` IGNORA `content.theme/footer/ratio/master` → los colores
  literales del template se renderizan tal cual (no dependen del tema activo).
  El contrato del mazo es `{ version: 2, slides: [...] }`.
- **Docs (TipTap)**: `StarterKit` (heading/paragraph/bulletList/orderedList/
  listItem/blockquote/codeBlock/horizontalRule) + `TableKit` (table/tableRow/
  tableHeader/tableCell; cell attrs globales `backgroundColor`, `verticalAlign`),
  `TaskList`/`TaskItem` (`attrs.checked`), `TextAlign`, `Highlight`,
  `TextStyleKit` (mark `textStyle` con `color`/`fontFamily`/`fontSize`),
  `Callout` (nodo, `attrs.tone` ∈ neutral/info/success/warning/danger),
  `NamedStyle` (`attrs.styleName` ∈ title/subtitle/nospacing/reference/caption),
  `Toc`. El doc es `{ type:'doc', content:[...] }`.
- **Hojas (Fortune-sheet)**: `sheets[]` con `{ name, celldata:[{r,c,v}], row,
  column, order, status, config }`. Celda `v = { v, m, ct:{fa,t}, bl, bg, fc, fs,
  ht }`. **Fórmula** = `v.f = '=SUM(...)'` + cache `v`/`m` (confirmado por
  `sheets/xlsx.spec.ts`). `fa` = formato numérico ('0.0%', '#,##0', '"$"#,##0.00').
  `ht`: 0=centro,1=izq,2=der. `config.columnlen={col:px}`. `status:1` = hoja activa.

### Hecho (en verde) — entrega inicial (commit 1)
Biblioteca rica y diseñada, reusando los 3 motores. Puertas: **tsc 0 · eslint 0
errores · next build OK** + smoke headless propio (estructura docs/sheets + render
de slides contra un mock de Fabric).
- **Slides (18 plantillas → 85 diapositivas diseñadas).** Kit de diseño en
  `templates.ts`: 4 paletas (Corporativo azul, Medianoche oscuro, Minimal,
  Industrial) + 11 layouts (Portada [3 variantes band/split/minimal], Agenda,
  Sección divisoria a color, Contenido, Dos columnas, Comparación, Cita, Equipo,
  Timeline/Proceso, KPIs con bloque de número grande, Cierre). Catálogo: 4 mazos
  completos por tema (11 slides c/u, todos los layouts) + 6 mazos por caso de uso
  (Propuesta, QBR, KPIs, Caso de éxito, Kickoff, Revisión de producción) + 8
  diapositivas sueltas de inicio rápido. Fondos pintados (Rect/Circle de acento),
  jerarquía tipográfica y composición — nada de texto sobre blanco pelón.
- **Docs (12 + blank).** Formales: Informe (portada+TOC+tabla+callout), Carta,
  Memorándum, Propuesta (tabla de precios), Acta (asistentes/agenda/tareas).
  Planta (diferenciadores): SOP (control de doc + EPP + pasos + registro), 8D
  (D1-D8 + 5 por qué), FAI AS9102 (Forms 1/2/3), Plan de control (matriz), Checklist
  de auditoría LPA/5S, CAPA, Entrega de turno. Con estilos de encabezado
  (title/subtitle), tablas pobladas y callouts por tono.
- **Sheets (10 + blank).** Manufactura: Programa de producción, Tracker OEE
  (OEE=D×R×C), Conteo de inventario (dif. + valor), Conteo cíclico (exactitud),
  Pareto de defectos (% y % acumulado), Plan de capacidad (utilización), Bitácora
  de mantenimiento (MTTR). Negocio: Presupuesto, Inventario, Tareas. Con
  encabezados con relleno, formatos numéricos ($/%/miles), fila de inmovilizado y
  **fórmulas reales** (`v.f` + cache).
- **TemplateGallery.tsx**: agrupación por categoría, scroll para bibliotecas
  grandes y preview con color de acento por tarjeta.
- **DocTemplates.tsx**: ahora lee `TEMPLATES.doc` (fuente única) agrupado por
  categoría — sin duplicar contenido.
- `TemplateDef` extendido con `category?`/`accent?` (retro-compatible) +
  `TEMPLATE_CATEGORIES` para el orden de secciones.

### Hecho (en verde) — commit 2 (llevar la biblioteca al tope del rango)
Puertas verdes de nuevo (tsc 0 · eslint 0 · next build OK · smoke headless OK).
**Totales finales: docs 15 · sheets 12 · slides 23 (89 diapositivas).**
- Docs +2 (Calidad y planta): **NCR** (no conformidad → contención + disposición
  MRB + cierre) y **A3** (resolución de problemas Toyota en una hoja).
- Sheets +1 (Manufactura / MES): **Bitácora de paros (Andon)** con duración por
  evento y % del total (Pareto) vía fórmulas.
- Slides +4 (Diapositivas sueltas): Agenda, Contenido, Dos columnas y
  Timeline/Proceso → ahora **todos** los layouts están disponibles como inicio
  rápido de una sola diapositiva, además de los mazos completos y por caso de uso.

### Verificación reproducible (headless, sin navegador)
- `tsc --noEmit -p apps/web/tsconfig.json` → 0.
- `eslint` sobre los 3 archivos del carril → 0 errores/0 warnings (los warnings de
  `SlidesEditor.tsx` son **preexistentes** y fuera del carril; no se tocó).
- `next build` → OK.
- Smoke propio: se transpila `templates.ts` a CJS y se ejecuta cada `build()` —
  docs/sheets se validan como JSON puro (tablas bien formadas, fórmulas `=…` con
  `ct.t='n'`, 1 hoja activa por libro); las slides se renderizan contra un **mock
  de Fabric** para cazar errores de layout (89 diapositivas, objetos y tipos OK).

### Pendiente / ideas para próximas rebanadas (opcional, no bloqueante)
- Más temas/variantes de slides (p. ej. portada "split" para todos los temas;
  layout de imagen + texto; PPAP/Gemba walk en docs; 5S scorecard en sheets).
- Previews reales (miniatura renderizada) en la galería en vez del acento de color
  — requeriría render fuera de pantalla; hoy se usa un preview con acento (ligero).

### Decisiones de diseño
- `templates.ts` es la **única fuente** de las plantillas de Documento; tanto el
  modal `TemplateGallery` (nuevo documento) como el menú "Plantillas" del ribbon
  (`DocTemplates.tsx`) leen `TEMPLATES.doc` → sin duplicar contenido (regla
  AGENTS §No-Duplication).
- `TemplateDef` se extendió con `category?` y `accent?` (ambos opcionales →
  retro-compatible). La galería agrupa por categoría y hace scroll para soportar
  bibliotecas grandes.
- Slides: kit de diseño con 4 **paletas/temas** (Corporativo azul, Medianoche
  oscuro, Minimal, Industrial) + 11 layouts (Portada, Agenda, Sección, Contenido,
  Dos columnas, Comparación, Cita, Equipo, Timeline/Proceso, KPIs, Cierre). Cada
  template compone esos layouts → mazos completos por tema + mazos por caso de uso
  + diapositivas sueltas.

### Simplificaciones anotadas (no se dejó nada roto)
- (se anotará aquí cualquier cosa que el motor no soporte y se haya simplificado).
