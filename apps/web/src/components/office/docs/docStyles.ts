/**
 * CSS de profundidad «tipo Word» para el editor de Documentos.
 *
 * Vive aquí (dentro del carril de Docs) en lugar de en `styles/tiptap.css`
 * —que está fuera del carril— y se inyecta una sola vez vía un `<style>` desde
 * `DocEditor`. Sólo añade selectores NUEVOS (no pisa los de tiptap.css), así que
 * convive sin conflictos con la hoja compartida.
 */
export const DOC_EXTRA_CSS = `
/* ───────────── Control de cambios: modos de visualización ───────────── */
/* «Sin marcas» (final): el documento como si se aceptaran los cambios. */
.doc-track-final .doc-del { display: none; }
.doc-track-final .doc-ins { color: inherit; text-decoration: none; }
/* «Original»: el documento como si se rechazaran los cambios. */
.doc-track-original .doc-ins { display: none; }
.doc-track-original .doc-del { color: inherit; text-decoration: none; }
/* «Sencillo»: texto final + barra de cambio en el margen (sin marcas inline). */
.doc-track-simple .doc-del { display: none; }
.doc-track-simple .doc-ins { color: inherit; text-decoration: none; }

/* Barra de cambio en el margen (bloques con inserciones/eliminaciones). Se
   muestra en los modos «Todas las marcas» y «Sencillo», como en Word. */
.tiptap-page .ProseMirror .doc-change-bar { position: relative; }
.doc-track-markup .ProseMirror .doc-change-bar::before,
.doc-track-simple .ProseMirror .doc-change-bar::before {
  content: ''; position: absolute; left: -16px; top: 0.1em; bottom: 0.1em;
  width: 2px; background: #f59e0b; border-radius: 2px; pointer-events: none;
}
@media print {
  .doc-track-markup .ProseMirror .doc-change-bar::before,
  .doc-track-simple .ProseMirror .doc-change-bar::before { display: none; }
}

/* ───────────── Tabla de contenido: puntos guía + nº de página ───────────── */
.tiptap-page .ProseMirror .doc-toc-item { display: flex; align-items: baseline; }
.tiptap-page .ProseMirror .doc-toc-item .doc-toc-text { flex-shrink: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tiptap-page .ProseMirror .doc-toc-item .doc-toc-dots {
  flex: 1 1 auto; align-self: flex-end; margin: 0 6px 0.18em; min-width: 14px;
  border-bottom: 1px dotted currentColor; opacity: 0.45; height: 0;
}
.tiptap-page .ProseMirror .doc-toc-item .doc-toc-page {
  flex-shrink: 0; color: #4b5563; font-variant-numeric: tabular-nums; font-size: 0.85em; min-width: 1.2em; text-align: right;
}
@media (prefers-color-scheme: dark) { .tiptap-page .ProseMirror .doc-toc-item .doc-toc-page { color: #9ca3af; } }
`;
