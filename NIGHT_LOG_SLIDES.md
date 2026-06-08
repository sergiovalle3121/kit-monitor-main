# NIGHT_LOG — Presentaciones (Slides) hacia PowerPoint

Sesión nocturna dedicada a llevar las **Presentaciones** de AXOS lo más cerca
posible de Microsoft PowerPoint, construyendo sobre **Fabric.js** (MIT). Corre en
paralelo con las sesiones de Docs y Hojas — **rama propia, PR sin mergear**.

> Rama de trabajo: `claude/optimistic-hawking-n4cB9` (asignada por el harness para
> esta sesión; cumple todas las reglas de seguridad: no se mergea a `main`, PR
> abierto, sólo archivos de Slides).

## Alcance / archivos tocados (sólo Slides)
- `apps/web/src/components/office/SlidesEditor.tsx`
- `apps/web/src/components/office/SlideActions.tsx`
- `apps/web/src/components/office/SlideSorter.tsx`
- `apps/web/src/components/office/SlideIconPicker.tsx`
- `apps/web/src/components/office/slideAssets.ts`
- `apps/web/src/lib/office/pptx.ts`
- `apps/web/src/lib/office/slidesPdf.ts`
- **NUEVOS** bajo `apps/web/src/components/office/slides/**` y con prefijo `Slide*`.

No se tocó: ribbon compartido, OfficeShell, `office/[id]/page.tsx`, Docs/Hojas,
`charts.ts`/`docx.ts`/`xlsx.ts`/`sheetOps.ts`, dashboard, SearchPalette, `globals.css`.

## Dependencias
- Sin dependencias nuevas. Todo se construye sobre lo ya instalado:
  `fabric@7` (MIT), `pptxgenjs@4` (MIT), `jspdf@4` (MIT), `framer-motion` (MIT),
  `lucide-react` (ISC). Licencias permisivas verificadas.

---

## Bitácora

### Sesión nocturna de profundidad PowerPoint
Construyendo encima de lo que ya existía (editor Fabric + PR #258: layouts,
temas, guías/snap/grid, tablas, iconos, animaciones con orden/tiempo, vista de
presentador, números/pie).

#### Lote 1 — Formas, efectos de imagen, agrupar, girar, export PNG
Nuevos módulos en `components/office/slides/`:
- `shapes.ts` — biblioteca ampliada de formas (polígonos + curvas SVG):
  pentágono, hexágono, octágono, trapecio, paralelogramo, cruz, flechas
  (izq/arr/abj/doble), galón, etiqueta, estrellas 4/6, rayo, cinta, corazón,
  nube, bocadillo, sol. Cada forma lleva pista para mapear a preset nativo .pptx.
- `ShapeGallery.tsx` — galería visual (previews SVG en vivo) en Insertar ▸ Formas.
- `imageEffects.ts` — filtros Fabric (brillo, contraste, saturación, desenfoque,
  B/N, sepia, invertir) persistidos en prop `imgFx`; recorte por relación de
  aspecto (1:1…9:16) y quitar recorte.
- `ImageEffectsPanel.tsx` — panel de sliders/toggles para el popover «Efectos».
- `exportImages.ts` — exporta cada diapositiva a **PNG** (multiplier 2).

En `SlidesEditor.tsx`:
- Grupo **Imagen** (Formato) visible al seleccionar imagen: recortar, efectos,
  +brillo, +contraste, reemplazar imagen, restablecer.
- **Agrupar/Desagrupar** (Ctrl+G / Ctrl+Shift+G) con la API v7 (`removeAll`).
- **Girar**: 90° izq/der + ángulo numérico preciso.
- `capture()` ahora serializa props custom nuevas (`imgFx`, `chartSpec`, `smart`, `conn`).
- Reaplica filtros de imagen al cargar cada diapositiva.

En `pptx.ts`: mapa `HINT_TO_PRESET` (formas Fabric → presets nativos PowerPoint),
incluidas las formas con curvas (corazón/nube/bocadillo/sol exportan como
preset, no como imagen). En `SlideActions.tsx`: opción **Imágenes (PNG)**.

Verificado: `tsc` ✓, `eslint` ✓ (sólo warnings preexistentes), `next build` ✓.

#### Lote 2 — Gráficos desde datos (backlog #1)
- `slides/chart.ts` — motor de gráficos: un gráfico es un `Group` de Fabric con
  prop `chartSpec` (tipo, título, etiquetas, series). Se dibuja con primitivas
  nativas (rect/línea/polilínea/path/texto) → barras, líneas, área y pastel,
  con ejes, cuadrícula, leyenda y título.
- `SlideChartEditor.tsx` — modal con selector de tipo, título, **tabla de datos
  editable** (agregar/quitar filas y series) y **vista previa en vivo**.
- En `SlidesEditor.tsx`: botón **Insertar ▸ Gráfico**; doble clic en un gráfico
  reabre el editor con sus datos; al aplicar se reconstruye conservando
  posición/escala/ángulo. Usa color de texto y fuente del tema.
- En `pptx.ts`: `addChartObject` exporta el gráfico como **gráfico NATIVO de
  PowerPoint** (`slide.addChart`) — editable en PPT, con colores de la paleta.

Verificado: `tsc` ✓, `eslint` ✓, `next build` ✓.

#### Lote 3 — SmartArt (backlog #4)
- `slides/smartart.ts` — genera diagramas desde una lista de texto: **proceso**
  (pasos →), **lista** (barras numeradas), **ciclo** (nodos en círculo con
  flechas), **jerarquía** (organigrama 2 niveles) y **pirámide** (niveles). Cada
  diagrama es un `Group` con prop `smart = { kind, items }`.
- `SlideSmartArtEditor.tsx` — modal con selector de tipo, textarea (una línea por
  elemento) y vista previa en vivo.
- En `SlidesEditor.tsx`: botón **Insertar ▸ SmartArt**; doble clic reabre el
  editor; al aplicar reconstruye conservando posición/escala. Como son formas y
  texto nativos, exportan a formas reales en .pptx (vía el handler de grupos).

Verificado: `tsc` ✓, `eslint` ✓ (0 errores), `next build` ✓.

#### Lote 4 — Conectores anclados (backlog #2)
- `slides/connectors.ts` — conector = `Polyline` que une dos formas por sus
  **puntos de conexión más cercanos** y se recalcula al mover/escalar/rotar las
  formas (`object:moving/scaling/rotating` → `refreshConnectors`). Soporta
  flecha (barbas en la punta). Se autoeliminan si una forma desaparece.
  Geometría en vivo con `setDimensions()` + invariante `left=pathOffset`.
- En `SlidesEditor.tsx`: con **2 formas seleccionadas** aparecen **Conectar** y
  **Conectar con flecha** (Formato ▸ Organizar). Reaplica el bloqueo del
  conector al cargar; refresca conectores tras cargar la diapositiva. Guarda
  `connId` por forma.
- En `pptx.ts`: el conector exporta como **línea nativa** con punta de flecha
  (`endArrowType`) usando los extremos absolutos guardados en `conn`.

Verificado: `tsc` ✓, `eslint` ✓, `next build` ✓.

#### Lote 5 — Texto pro + Buscar/Reemplazar global (backlog #6)
- `SlideFindReplace.tsx` — panel **buscar y reemplazar en TODAS las
  diapositivas**: cuenta coincidencias, «Siguiente» (navega y selecciona el
  objeto), «Reemplazar todo» (devuelve nº de reemplazos). Atajo **Ctrl+H**.
- En `SlidesEditor.tsx` (texto pro sobre Textbox): **interlineado** (1,0–2,0),
  **espaciado entre letras** (charSpacing), **viñetas** (toggle por línea),
  **niveles** (aumentar/disminuir sangría), **contorno de texto** (stroke) y
  **WordArt** (degradado+sombra / contorno / sombra). Sin props nuevas de
  serialización (lineHeight/charSpacing/stroke son nativas de Fabric).

Verificado: `tsc` ✓, `eslint` ✓ (0 errores), `next build` ✓.

#### Lote 6 — Presentación pro (backlog #12)
En el modo presentación (componente `Present`):
- **Puntero láser** (L): punto rojo luminoso que sigue el cursor.
- **Lápiz/tinta** (P): dibuja anotaciones sobre la diapositiva (SVG, tinta por
  diapositiva); **borrar** (E).
- **Pantalla en negro** (B).
- **Navegador de miniaturas** (G): cuadrícula para saltar a cualquier diapositiva.
- Barra de herramientas con botones para todo; atajos de teclado coherentes.

Verificado: `tsc` ✓, `eslint` ✓, `next build` ✓.

#### Lote 7 — Transiciones + animaciones + línea de tiempo (backlog #9)
- **Transiciones**: + Deslizar arriba, Empujar, Revelar, Voltear (además de
  fundido/deslizar/zoom).
- **Animaciones de entrada**: + arriba/izquierda/derecha, Girar, Rebote.
- Nuevo **retraso** por objeto (`animDelay`, ms) usado en la secuencia.
- `SlideAnimationPanel.tsx` — **panel/línea de tiempo de animación** de la
  diapositiva: lista los objetos, permite asignar animación, **orden**,
  **duración** y **retraso**, y seleccionar el objeto. Opciones compartidas
  movidas a `slideAssets.ts` (evita import circular).

Verificado: `tsc` ✓, `eslint` ✓, `next build` ✓.

#### Lote 8 — Zoom/Ajustar + Botones de acción (backlog #14, #10)
- **Zoom**: Vista ▸ Zoom (alejar/acercar/%, **Ajustar a pantalla**, 100%) usando
  el zoom de viewport de Fabric (`setZoom` + `setDimensions`); no afecta la
  serialización.
- **Botones de acción**: Insertar ▸ Botón de acción → grupo (rect+texto) con
  hipervínculo de navegación: **Inicio / Anterior / Siguiente / Final / Ir a
  diapositiva**. El modo presentación resuelve los tipos relativos
  (`first/prev/next/last/slide/url`).

Verificado: `tsc` ✓, `eslint` ✓, `next build` ✓.

#### Lote 9 — Panel de selección / capas (backlog #11)
- `SlideLayersPanel.tsx` — lista los objetos de la diapositiva (frente arriba)
  con **visibilidad** (ocultar/mostrar), **bloqueo**, **orden Z** (traer
  adelante / enviar atrás por pasos) y **seleccionar**. Vista ▸ Panel de
  selección (excluyente con el panel de animación). Serializa `visible`.

Verificado: `tsc` ✓, `eslint` ✓, `next build` ✓.

#### Lote 10 — Recorte interactivo de imagen (refina backlog #3)
- Modo de **recorte con marco arrastrable** sobre la imagen: arrastra/escala el
  marco y aplica (Enter) o cancela (Esc). Calcula `cropX/cropY/width/height` en
  píxeles naturales respetando la escala y el recorte previo. Barra flotante con
  Aplicar/Cancelar. Convive con los recortes por relación de aspecto (lote 1).

Verificado: `tsc` ✓, `eslint` ✓, `next build` ✓.

#### Lote 11 — Alinear/distribuir multi-objeto + brocha de formato (backlog #11)
- **Alinear** ahora es contextual: con 1 objeto, al lienzo; con varios, relativo
  a la selección (izq/centro/der/arriba/medio/abajo).
- **Distribuir** horizontal/vertical (espaciado equidistante de centros) con 3+
  objetos seleccionados.
- **Brocha de formato**: copiar/pegar formato (relleno, borde, sombra, opacidad,
  esquinas; y tipografía completa en textos).

Verificado: `tsc` ✓, `eslint` ✓, `next build` ✓.

#### Lote 12 — Estilos rápidos de forma + más temas (backlog #5, #8)
- `slides/quickStyles.ts` + `QuickStyleGallery.tsx` — galería de **estilos
  rápidos** (sólido, sombra, contorno, tinte, oscuro, degradado, cristal,
  papel, borde grueso) con previews en vivo según el acento del tema; se aplican
  a la forma seleccionada (relleno/borde/esquinas/sombra).
- **Temas**: +6 (Océano, Pizarra, Rosa, Arena, Grafito, Esmeralda) → 12 en total.

Verificado: `tsc` ✓, `eslint` ✓, `next build` ✓.

#### Lote 13 — Gráficos: dona, barras horizontales/apiladas, opciones (backlog #1)
- Nuevos tipos: **dona** (pie con hueco) y **barras horizontales**; opción
  **apilado** (barras/área), **leyenda** on/off, **etiquetas de valor** y
  **selector de paleta** (5 paletas) en el editor.
- `chart.ts` reescribe el render cartesiano para soportar orientación, apilado y
  etiquetas; el pie soporta dona y porcentajes.
- `pptx.ts` mapea dona (`holeSize`), barras horizontales (`barDir:'bar'`),
  apilado (`barGrouping:'stacked'`), leyenda y valores al gráfico nativo.

Verificado: `tsc` ✓, `eslint` ✓, `next build` ✓.

#### Lote 14 — Tamaño de diapositiva 16:9 / 4:3 (backlog #7)
- Relación de aspecto del mazo (`ratio` en el modelo): **16:9 (960×540)** o
  **4:3 (960×720)**. Diseño ▸ Tamaño.
- El lienzo de Fabric gestiona sus dimensiones imperativamente (`setDimensions`)
  para que React no lo borre; la altura `ch = slideHeight(ratio)` se propaga a
  guías/snap, alineación, zoom/ajuste, **presentación** (aspecto y deck),
  **clasificador**, **PDF**, **PNG** y **.pptx** (altura de layout; las
  posiciones son px@96dpi en ambas relaciones, así que `sx/sy` no cambian).
  Las posiciones de los objetos se conservan al cambiar de tamaño.

Verificado: `tsc` ✓, `eslint` ✓, `next build` ✓.

#### Lote 15 — Secciones (backlog #7)
- **Secciones** que agrupan diapositivas con encabezados en la barra de
  miniaturas. Modelo: arreglo `sections` paralelo a las diapositivas (como
  `notes`), así no hay corrimiento de índices al agregar/duplicar/borrar/
  reordenar. Agregar sección en la diapositiva actual, **renombrar** y **quitar**.

Verificado: `tsc` ✓, `eslint` ✓, `next build` ✓.

### Diferido (con estimación)
- **Secciones en el clasificador** y colapsar/expandir: el sorter es una rejilla;
  insertar encabezados de ancho completo + colapso. Estimación: ~0.5 día.
- **Patrón de diapositivas (master) editable** (backlog #7): editor de
  marcadores/placeholders. Estimación: ~1 día.
- **Video/audio embebido** (backlog #10): Fabric no reproduce media; requiere
  capa HTML sincronizada y export limitado en .pptx. Estimación: ~1–1.5 días.
- **Import .pptx**: no hay lib permisiva estable de alta fidelidad. Estimación:
  alto; documentar y evaluar parser propio mínimo (~2–3 días).
