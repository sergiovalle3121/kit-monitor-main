# NIGHT_LOG_DOCS — Editor de Documentos (Word) de AXOS

> Sesión nocturna autónoma. Objetivo: acercar el editor de **Documentos** a Microsoft Word
> construyendo profundidad sobre TipTap/ProseMirror (MIT). Rama de trabajo:
> `claude/eloquent-euler-eYstb` (rama designada por el entorno para esta sesión; el texto de
> la tarea mencionaba `claude/office-docs`, pero el entorno está configurado para esta rama —
> misma intención de seguridad: rama de feature, sin merge a `main`, PR abierto sin mergear).

## Reglas respetadas
- No se toca el ribbon compartido (`components/office/ribbon/**`) — sólo se consume.
- No se toca `OfficeShell.tsx`, `office/[id]/page.tsx`, `Sheet*`, `Slide*`, `slideAssets.ts`,
  `charts.ts`/`xlsx.ts`/`pptx.ts`/`sheetOps.ts`, `dashboard/page.tsx`, `SearchPalette.tsx`,
  `globals.css`, `eslint.config.mjs`, ni nada fuera de Docs.
- Archivos propios editados: `DocEditor.tsx`, `DocStyleGallery.tsx`, `DocPageSetup.tsx`,
  `DocSymbolPicker.tsx`, `DocComments.tsx`, `DocFindReplace.tsx`, `DocOutline.tsx`,
  `DocTableMenu.tsx`, `DocPageView.tsx`, `docExtensions.ts`, `docPageExtensions.ts`,
  `commentMark.ts`, `lib/office/docx.ts`, `styles/tiptap.css`.
- Archivos nuevos bajo `components/office/docs/` y con prefijo `Doc*`.

## Dependencias nuevas
- `katex@^0.17.0` (MIT) + `@types/katex@^0.16.8` (MIT) — ecuaciones LaTeX. Sólo se carga en
  el chunk del editor de Docs (que ya es `dynamic`/`ssr:false`).

## Bitácora (orden cronológico)

### Wave 1 — Motor + profundidad base (tsc + lint + next build en verde)
Capa de extensiones nuevas (`components/office/docs/`):
- **listNumbering.ts** — numeración multinivel real: esquema *legal* `1, 1.1, 1.1.1`
  (counters CSS), esquema *outline* `I, A, 1, a`, y reiniciar/fijar numeración
  (`setListScheme`, `restartNumbering`).
- **mathExtension.ts** — ecuaciones LaTeX con **KaTeX**: nodos `mathInline` /
  `mathBlock` con NodeView, `renderHTML` con KaTeX ya renderizado (la vista de
  impresión conserva la fórmula), comandos insertar/actualizar. Diálogo
  `DocEquation.tsx` con vista previa en vivo y paleta de símbolos por categoría.
- **footnotes.ts** — notas al pie mínimas estables: `footnoteRef` (superíndice
  autonumerado) + `footnoteList` (área de notas viva, como la TOC). UI
  `DocFootnotes.tsx` (insertar/editar/área).
- **insertNodes.ts** — letra capital (`DropCap`), cuadro de texto/llamada
  (`Callout` con tonos), salto de columna (`ColumnBreak`), marcador (`Bookmark`)
  y referencia cruzada (`CrossRef`, clic = navegar). UI `DocInsertExtras.tsx`.
- **trackChanges.ts** — control de cambios mínimo estable: marcas
  `insertion`/`deletion` (autor+fecha), modo sugerencias (texto escrito se marca
  como inserción vía `handleTextInput`), proponer eliminación, aceptar/rechazar
  (todo o por cambio). Panel `DocTrackChanges.tsx`.
- **tableCellAttrs.ts** — sombreado (color de fondo) y alineación vertical de celda.
- **searchHighlight.ts** — resaltado en vivo de todas las coincidencias de
  búsqueda (decoraciones PM, se remapean al editar).
- **focusLine.ts** — modo enfoque (resalta el bloque activo, atenúa el resto).
Controles de ribbon nuevos (todos consumiendo el ribbon compartido, sin tocarlo):
- `DocListMenu`, `DocViewTools` (zoom, marcas ¶, regla, enfoque, lectura,
  ortografía), `DocWordCount` (palabras/caracteres/frases/párrafos/tiempo de
  lectura/legibilidad Fernández-Huerta), `DocTemplates` (en blanco, carta, memo,
  reporte, instrucción de trabajo).
Integración en `DocEditor.tsx`: encabezados 1-6, estado de vista (zoom/marcas/
enfoque/lectura/regla/ortografía/sugerencias) aplicado a la página.
CSS de todo lo anterior en `tiptap.css`.

### Wave 2 — Búsqueda avanzada, comentarios con hilos, tablas pro, diseño de página, fidelidad .docx
- **Buscar y reemplazar avanzado** (`DocFindReplace.tsx`): regex (con retro-referencias
  `$1`/`$&`), palabra completa, distinguir mayúsculas, resaltado en vivo de todas
  las coincidencias (vía `searchHighlight`), navegación y reemplazo uno/todo.
- **Comentarios con hilos** (`commentMark.ts` + `DocComments.tsx`): responder,
  resolver/reabrir, autor + fecha, panel lateral con el hilo completo.
- **Tablas pro** (`DocTableMenu.tsx`): sombreado de celda (paleta), alineación
  vertical (arriba/centro/abajo), fila/columna de encabezado, combinar/dividir,
  insertar/eliminar — todo contextual a la tabla.
- **Diseño de página** (`DocPageSetup.tsx` + `docPageExtensions.ts`): bordes de
  página (fino/grueso/doble), números de línea (aprox. por bloque), y atributo
  «primera página distinta» (para encabezado/pie).
- **Fidelidad .docx** (`lib/office/docx.ts`): notas al pie **reales** de Word
  (API `footnotes` + `FootnoteReferenceRun`), encabezados 1-6, ecuaciones (LaTeX
  como texto), cuadros de texto (contenido), referencias cruzadas, y marcas de
  control de cambios (inserción subrayada / eliminación tachada).

### Wave 3 — Firma, leyendas, símbolos, estilos, primera página distinta
- **Línea de firma** (`signatureLine.ts`) — nodo con línea + nombre/cargo; export .docx.
- **Leyenda de figura** — estilo con nombre «caption» (botón en Insertar + galería).
- **Símbolos ampliados** (`DocSymbolPicker.tsx`) — +categorías Diacríticos y Formas,
  más caracteres en las existentes.
- **Galería de estilos ampliada** (`DocStyleGallery.tsx`) — Sin espaciado, Referencia
  (versalitas), Leyenda, y «Borrar formato (a Normal)».
- **Primera página distinta** — atributo + toggle en Disposición; aplicado en la
  vista de página (Paged.js `@page:first`) y en el export .docx (`titlePage` + first
  header/footer en blanco).

### Wave 4 — Citas y bibliografía
- **Citas** (`citations.ts` + `DocCitations.tsx`): nodo de cita en línea
  «(Autor, año)» con la referencia completa guardada; diálogo de inserción
  (autor/año/título) con vista previa; clic en la cita salta a la bibliografía.
- **Bibliografía**: nodo en vivo que recoge y ordena las fuentes únicas (como la
  TOC). Export .docx con sangría francesa.

### Wave 5 — Encabezado / pie de página WYSIWYG
- **Encabezado y pie** (`DocHeaderFooter.tsx`): editor en la pestaña Disposición
  (texto de encabezado, pie y números de página) que se guarda en `pageMeta` y se
  **muestra en la página** del editor (no sólo en impresión), además de la vista
  paginada (Paged.js) y el export .docx ya existentes.

### Wave 6 — Atajos Word, selector de tabla, imagen por archivo
- **Atajos de teclado** (`docShortcuts.ts`): Ctrl+Alt+0/1/2/3/4 (Normal / Encabezado
  1-4), Ctrl+Shift+7/8 (lista numerada / con viñetas) — auténticos de Word,
  evitando combinaciones que captura el navegador.
- **Selector visual de tabla** (`DocTableInsert.tsx`): cuadrícula al pasar el ratón
  (hasta 8×10) en vez del 3×3 fijo.
- **Insertar imagen por archivo** (`DocImageInsert.tsx`): subir desde archivo (data
  URL, límite 5 MB) o desde URL.

### Wave 7 — Formato de párrafo (espaciado + sangría de primera línea)
- **paragraphFormat.ts** + **DocParagraphMenu.tsx**: espaciado antes/después del
  párrafo y sangría de primera línea (atributos inline sobre párrafo/encabezado),
  con export .docx (`spacing` + `indent.firstLine`). Verificado que el `style`
  fusiona con `indent`/`textAlign` (no se pisan).

### Hardening y verificación
- Comentarios: al actualizar un hilo (responder/resolver) ahora se quita y vuelve
  a poner la marca para no acumular marcas duplicadas (la marca `comment` permite
  solaparse, por lo que re-aplicar `setMark` no reemplazaba).
- **Prueba de humo del esquema (headless)**: como el `next build` NO construye el
  esquema (eso ocurre al instanciar el editor en el navegador), se validó con
  jsdom + `getSchema` que: el esquema se construye (31 nodos, 13 marcas), todos los
  nodos/marcas nuevos existen, los atributos globales caen sobre nodos válidos, y
  un documento con cada nodo (incl. ecuaciones) **serializa** vía `DOMSerializer`
  sin error y KaTeX renderiza. (Artefacto de verificación, no se versiona.)

### Diferido (con estimación)
- **Control de cambios con interceptación total** (pegar/IME/borrado como
  sugerencia, fusión de revisiones): subsistema de especialista; sin banco de
  pruebas en navegador esta noche se entrega la versión mínima estable. Est.
  1-2 días con pruebas e2e.
- **Notas al pie por página impresa** (vs. al final del documento): requiere
  integrar con el paginador. Est. ~1 día.
