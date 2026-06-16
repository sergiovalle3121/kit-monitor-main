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

### Wave 8 — Cambiar mayúsculas/minúsculas (Aa)
- **changeCase.ts** + **DocChangeCase.tsx**: Tipo oración, minúsculas, MAYÚSCULAS,
  Cada Palabra, aLTERNAR. Preserva las marcas (reemplaza por nodo de texto del
  mismo largo, con guarda contra cambios de longitud unicode → no corrompe).

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

### Wave 9 — Accesibilidad (texto alternativo de imagen)
- Botón «Texto alternativo» al seleccionar una imagen (atributo `alt`, ya soportado
  por la extensión Image).

### Diferido (con estimación)
- **Control de cambios con interceptación total** (pegar/IME/borrado como
  sugerencia, fusión de revisiones): subsistema de especialista; sin banco de
  pruebas en navegador esta noche se entrega la versión mínima estable. Est.
  1-2 días con pruebas e2e.
- **Notas al pie por página impresa** (vs. al final del documento): requiere
  integrar con el paginador. Est. ~1 día.
- **Imágenes en el export .docx**: requiere leer dimensiones naturales (async) y
  `ImageRun` con el buffer; se evita exportarlas mal (aspecto/tamaño). En pantalla
  y en PDF/impresión sí se ven. Est. ~0.5 día.
- **Numeración multinivel real en .docx** (definiciones de numeración de Word):
  el esquema *legal* ya exporta los números jerárquicos correctos como texto
  (`1.`, `1.1.`, `1.1.1.`); falta usar campos de numeración nativos de Word para
  que se renumeren solos al editar en Word. Est. ~0.5 día.
- **Saltos de sección y encabezado/pie por sección**: hoy un solo "section" por
  documento. Est. ~1 día.

## Sesión F2 (rama `claude/wizardly-babbage-5dtfdj`) — paridad con Word, fase 2

> Continúa sobre lo anterior. Carril estricto: SOLO
> `components/office/Doc*.tsx`, `components/office/docs/**`, `docExtensions.ts`,
> `docPageExtensions.ts`. **NO** se toca `OfficeShell`, `page.tsx`, `Sheet*`,
> `Slide*`, ni —a diferencia de la fase 1— `lib/office/docx.ts` ni
> `styles/tiptap.css` (ambos fuera del carril). El CSS nuevo se inyecta vía un
> `<style>` desde `DocEditor` con la constante `docs/docStyles.ts` (sólo
> selectores nuevos, no pisa la hoja compartida). La fidelidad .docx que requiera
> tocar `lib/office/docx.ts` queda anotada como «fuera de carril».

### F2 · Wave 1 — Control de cambios: modos de visualización + barra de cambio
- **Modos «Mostrar para revisión»** (como Word) en la pestaña *Revisar*: *Todas las
  revisiones* (marcas completas), *Revisiones sencillas* (texto final + barra de
  cambio en el margen), *Sin marcas (final)* (como si se aceptara todo) y
  *Original* (como si se rechazara todo). Implementado con una clase
  `doc-track-<modo>` en la página + CSS inyectado (sin marcas inline en final/
  original). Satisface el «vista con/sin marcas» de la tarea.
- **Barra de cambio en el margen**: decoración ProseMirror (`changeBarPlugin`) que
  marca cada bloque con inserciones/eliminaciones; el CSS la pinta sólo en los
  modos *Todas*/*Sencillo*. Se recalcula sola en cada cambio de estado.
- **Contador de cambios** en la cabecera del panel de revisión.
- Archivos: `docs/trackChanges.ts` (decoración + helpers), `docs/DocTrackChanges.tsx`
  (selector de modo + contador), `docs/docStyles.ts` (nuevo, CSS inyectado),
  `DocEditor.tsx` (estado `trackView`, clase en la página, `<style>`).
- Puertas: `tsc` 0, `eslint` carril 0, `next build` verde.

### F2 · Wave 2 — Tabla de contenido automática (niveles + nº de página + actualizar)
- **Niveles configurables**: el nodo `toc` ahora tiene `maxLevel` (1-6). Se puede
  insertar a 1-2 / 1-3 / todos, y cambiar los niveles de un TOC existente.
- **Números de página estimados** con **puntos guía** (leader dots), medidos del
  DOM (rAF, sin reflow por tecla; normaliza el `zoom` de la página). Es una
  estimación —como Word hasta repaginar— a partir de la altura imprimible según
  el tamaño/orientación/márgenes.
- **«Actualizar tabla»** (comando `updateToc`, incrementa `rev`) y `setTocLevels`,
  expuestos en un control nuevo `DocToc` (pestaña *Referencias*).
- Archivos: `docExtensions.ts` (nodo `Toc` reescrito: attrs, comandos, NodeView con
  medición), `docs/DocToc.tsx` (nuevo), `DocEditor.tsx` (usa `DocToc`, quita el
  botón suelto y el icono sin uso), `docs/docStyles.ts` (CSS de puntos guía).
- Puertas: `tsc` 0, `eslint` carril 0, `next build` verde.

### F2 · Wave 3a — Saltos de sección + ajustes por sección (en pantalla)
- **Nodo `sectionBreak`** (atómico de bloque) con ajustes propios: tipo
  (`nextPage`/`continuous`), encabezado, pie, números de página (con reinicio en N
  y formato decimal/romano/alfabético), columnas (hereda/1/2/3) y orientación
  (hereda/vertical/horizontal). Todo viaja en el JSON (atributos) y se serializa a
  `data-*` para que la vista paginada lo lea.
- **Divisor en pantalla** con resumen de los ajustes + botón «Configurar» que abre
  un modal de edición (patrón de evento, como las notas al pie).
- **Encabezado/pie/numeración por sección en pantalla**: el overlay de la página
  ahora muestra la **sección activa** (la del cursor) vía `effectiveSection`, e
  indica «Sección N» y el número de página de reinicio.
- En impresión, `nextPage` fuerza salto de página; `continuous` no.
- Control nuevo `DocSections` en *Disposición* (insertar salto + modal de ajustes).
- Archivos: `docPageExtensions.ts` (nodo `SectionBreak`, helpers `effectiveSection`,
  formatos de numeración), `docs/DocSections.tsx` (nuevo), `DocEditor.tsx` (registro
  + overlay por sección), `docs/docStyles.ts` (CSS del divisor).
- Puertas: `tsc` 0, `eslint` carril 0, `next build` verde.

### F2 · Wave 3b — Vista paginada por secciones (Paged.js)
- **`DocPageView` ahora pagina por sección**: divide el HTML en los
  `div[data-section-break]` y genera **páginas con nombre** (`@page secN`) por
  sección con su encabezado/pie, numeración (formato decimal/romano/alfabético +
  reinicio vía `counter-reset: page`), columnas y orientación propias. La sección 0
  usa el `@page` por defecto (con el encabezado/pie del toolbar / documento).
- **Fallback robusto**: si algo falla con las secciones, cae a la vista de una sola
  sección (comportamiento anterior) y, en último caso, a un mensaje. La vista
  previa nunca queda rota.
- Helpers extraídos: `CONTENT_CSS`, `sizeFor`, `marginFor`, `marginBoxes`,
  `buildSectioned`. Los marcadores de salto de sección no se renderizan en el PDF.
- Archivo: `DocPageView.tsx` (lane). Reusa `PAGE_FORMAT_CSS` de `docPageExtensions`.
- Nota: el «continuo» en la vista paginada inicia página nueva (limitación de las
  páginas con nombre de Paged.js); en el editor se respeta como continuo.
- Puertas: `tsc` 0, `eslint` carril 0, `next build` verde.

### F2 · Wave 4 — Notas al final + línea entre columnas
- **Notas al final** (endnotes): corriente independiente de las notas al pie, con
  numeración propia en romanos minúscula (i, ii, iii…). Nodos `endnoteRef`
  (marcador ◆) y `endnoteList` (área «Notas al final»), insertar/editar/área.
  Las notas al pie quedan **intactas** (mismo esquema) para no romper documentos.
- `DocFootnotes` ahora gestiona ambos tipos (pie y final) con un solo diálogo y el
  menú con las 4 acciones. Grupo de *Referencias* renombrado a «Notas al pie y al
  final».
- **Línea entre columnas** (`pageColumnRule`): toggle en *Disposición* (activo sólo
  con ≥2 columnas), aplicado en pantalla (`doc-cols-rule`) y en la vista paginada
  (`column-rule`) para la sección 0 y las secciones con columnas propias.
- Archivos: `docs/footnotes.ts` (nodos endnote + helpers), `docs/DocFootnotes.tsx`
  (reescrito para 2 tipos), `docPageExtensions.ts` (attr `pageColumnRule`),
  `DocPageSetup.tsx` (toggle), `DocEditor.tsx` (registro endnotes + clase), 
  `DocPageView.tsx` (column-rule), `docs/docStyles.ts` (CSS).
- Puertas: `tsc` 0, `eslint` carril 0, `next build` verde.

### F2 · Wave 5 — Estilos de párrafo: redefinir según la selección (consistentes)
- **«Redefinir estilo según la selección»** (Word): captura el formato de la
  selección (fuente/tamaño/color/negrita/cursiva/subrayado/alineación/interlineado)
  y lo guarda en `pageMeta.styleDefs[clave]`. La redefinición se aplica a **todos**
  los bloques de ese estilo del documento (consistencia), inyectando CSS generado
  desde `styleDefs`. Hay también «Restablecer estilo».
- Las claves de estilo de encabezado (`h1`-`h6`) son las que alimentan la TOC, así
  que redefinirlas mantiene el documento y su índice coherentes («ligado a la TOC»).
- El formato inline explícito sigue ganando sobre el estilo (como en Word).
- Archivos: `docPageExtensions.ts` (attr `styleDefs`), `docs/docStyles.ts`
  (`StyleProps` + `styleDefsToCss`), `DocStyleGallery.tsx` (redefinir/restablecer),
  `DocEditor.tsx` (segundo `<style>` con las reglas de estilo).
- Puertas: `tsc` 0, `eslint` carril 0, `next build` verde.

### F2 · Wave 6 — Pulir paginación: guías de salto de página en el lienzo
- **Guías de salto de página** (toggle en *Vista*): líneas discontinuas en el
  lienzo continuo que marcan dónde rompería cada página, con etiqueta «Página N».
  Se miden con el mismo cálculo de altura imprimible que la estimación de la TOC
  (consistencia entre el índice y las guías). Re-mide en cada cambio/resize vía rAF
  (sin reflow por tecla) y desaparecen en impresión.
- La paginación «real» (flujo por páginas con sus márgenes/encabezados) sigue en la
  *Vista de página* (Paged.js), ahora por sección; estas guías son la pista visual
  en el editor mientras se escribe.
- Archivos: `DocEditor.tsx` (estado + efecto de medición + overlays),
  `docs/DocViewTools.tsx` (toggle), `docs/docStyles.ts` (CSS de las guías).
- Puertas: `tsc` 0, `eslint` carril 0 (sin warnings), `next build` verde.

### F2 · Wave 7 — Control de cambios por autor
- **Aceptar / rechazar por autor**: el panel de revisión agrupa los cambios por
  autor, con cabecera por grupo (nombre + contador + «Aceptar/Rechazar todo de este
  autor»). Comandos nuevos `acceptChangesByAuthor` / `rejectChangesByAuthor` y helper
  `changeAuthors`. Se refactorizó accept/reject-all a un único `resolveChanges`
  (una transacción, sin cambiar el comportamiento).
- Archivos: `docs/trackChanges.ts` (helper + comandos), `docs/DocTrackChanges.tsx`
  (panel agrupado por autor).
- Puertas: `tsc` 0, `eslint` carril 0, `next build` verde.

### F2 · Wave 8 — Saltos de línea y de página por párrafo (paginación real)
- **Atributos de paginación de párrafo** (Word «Líneas y saltos de página»):
  *conservar con el siguiente* (`break-after:avoid`), *conservar líneas juntas*
  (`break-inside:avoid`) y *salto de página antes* (`break-before:page`). Atributos
  globales sobre párrafo/encabezado (estilo inline + `data-*`), con comandos toggle
  y entradas en el menú de párrafo.
- **Control de viuda/huérfana** y *encabezados pegados a su texto* por defecto en la
  vista paginada (`orphans/widows:2`, `h1-h4 { break-after/inside: avoid }`), para
  que el contenido fluya por páginas como Word.
- Archivos: `docs/paragraphFormat.ts` (attrs + comandos), `docs/DocParagraphMenu.tsx`
  (entradas), `DocPageView.tsx` (reglas de fragmentación en `CONTENT_CSS`).
- Puertas: `tsc` 0, `eslint` carril 0, `next build` verde.

### F2 · Wave 9 — Tabla de ilustraciones (lista de figuras)
- **Nodo `tableOfFigures`** vivo: lista los párrafos con estilo «Leyenda» con número
  correlativo, puntos guía y nº de página estimado (mismo motor que la TOC). Clic =
  saltar a la figura. Botón «Tabla de ilustraciones» en *Referencias* (junto a la
  TOC). Helper `collectCaptions`.
- Archivos: `docExtensions.ts` (`TableOfFigures` + `collectCaptions`),
  `docs/DocToc.tsx` (botón), `DocEditor.tsx` (registro). Reusa el CSS `doc-toc`.
- Puertas: `tsc` 0, `eslint` carril 0, `next build` verde.

## Resumen final de la sesión
Se llevó el editor de Documentos muy cerca de Word, todo con código propio sobre
TipTap/ProseMirror (MIT) + KaTeX (MIT). **No se tocó** el ribbon compartido,
OfficeShell, la página del editor, Sheets/Slides, libs compartidas, `globals.css`
ni nada fuera de Docs. Archivos nuevos bajo `components/office/docs/` (24) + edits
a los `Doc*`/`docx.ts`/`tiptap.css` permitidos. 9 «waves», cada una con
`tsc` + `eslint` (mis archivos, 0/0) + `next build` en verde, y verificación
headless del esquema/serialización (jsdom + getSchema + DOMSerializer).
Rama `claude/eloquent-euler-eYstb`, **PR #263 abierto sin mergear**.
