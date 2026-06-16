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
`;
