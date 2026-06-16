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

/* ───────────── Saltos de sección ───────────── */
.tiptap-page .ProseMirror .doc-section-break {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  height: 0; border-top: 2px dashed #818cf8; margin: 1.6rem 0; position: relative; padding: 0 6px;
}
.tiptap-page .ProseMirror .doc-section-break[data-break="continuous"] { border-top-style: dotted; }
.tiptap-page .ProseMirror .doc-section-break .doc-section-break-label {
  position: relative; top: -0.75rem; background: #fff; color: #6366f1; font-size: 10px; font-weight: 600;
  padding: 0 8px; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tiptap-page .ProseMirror .doc-section-break .doc-section-break-edit {
  position: relative; top: -0.75rem; background: #eef2ff; color: #4f46e5; font-size: 10px; font-weight: 700;
  padding: 2px 8px; border-radius: 999px; cursor: pointer; flex-shrink: 0;
}
.tiptap-page .ProseMirror .doc-section-break .doc-section-break-edit:hover { background: #e0e7ff; }
@media (prefers-color-scheme: dark) {
  .tiptap-page .ProseMirror .doc-section-break .doc-section-break-label { background: #1a1a1a; color: #a5b4fc; }
  .tiptap-page .ProseMirror .doc-section-break .doc-section-break-edit { background: rgba(99,102,241,0.18); color: #c7d2fe; }
}
/* En impresión, «página siguiente» fuerza salto; «continuo» no. */
@media print {
  .tiptap-page .ProseMirror .doc-section-break[data-break="nextPage"] { break-before: page; border: none; }
  .tiptap-page .ProseMirror .doc-section-break .doc-section-break-label,
  .tiptap-page .ProseMirror .doc-section-break .doc-section-break-edit { display: none; }
}

/* ───────────── Notas al final ───────────── */
.tiptap-page .ProseMirror .doc-endnote-ref { color: #7c3aed; font-weight: 700; cursor: pointer; padding: 0 1px; font-size: 0.7em; vertical-align: super; }
.tiptap-page .ProseMirror .doc-endnote-ref:hover { text-decoration: underline; }
.tiptap-page .ProseMirror .doc-endnote-list { border-top: 1px solid #d1d5db; margin-top: 2em; padding-top: 0.6em; font-size: 0.85em; color: #4b5563; }
@media (prefers-color-scheme: dark) { .tiptap-page .ProseMirror .doc-endnote-list { border-color: rgba(255,255,255,0.15); color: #9ca3af; } }

/* ───────────── Columnas: línea entre columnas ───────────── */
.doc-cols-rule .ProseMirror { column-rule: 1px solid #d1d5db; }
@media (prefers-color-scheme: dark) { .doc-cols-rule .ProseMirror { column-rule-color: rgba(255,255,255,0.18); } }
`;

/** Propiedades de una redefinición de estilo (Word: «redefinir según selección»). */
export interface StyleProps {
  fontFamily?: string | null; fontSize?: string | null; color?: string | null;
  bold?: boolean; italic?: boolean; underline?: boolean;
  textAlign?: string | null; lineHeight?: string | null;
}

const styleSelector = (key: string) => {
  if (/^h[1-6]$/.test(key)) return `.tiptap-page .ProseMirror ${key}`;
  if (key === 'normal') return `.tiptap-page .ProseMirror p:not([data-style])`;
  return `.tiptap-page .ProseMirror [data-style="${key}"]`;
};

const styleDecls = (p: StyleProps) => {
  const d: string[] = [];
  if (p.fontFamily) d.push(`font-family:${p.fontFamily}`);
  if (p.fontSize) d.push(`font-size:${p.fontSize}`);
  if (p.color) d.push(`color:${p.color}`);
  if (p.bold != null) d.push(`font-weight:${p.bold ? 700 : 400}`);
  if (p.italic) d.push('font-style:italic');
  if (p.underline) d.push('text-decoration:underline');
  if (p.textAlign) d.push(`text-align:${p.textAlign}`);
  if (p.lineHeight) d.push(`line-height:${p.lineHeight}`);
  return d.join(';');
};

/** Convierte el mapa de redefiniciones de estilo en reglas CSS inyectables. */
export function styleDefsToCss(defs: Record<string, StyleProps> | null | undefined): string {
  if (!defs) return '';
  return Object.entries(defs)
    .map(([key, props]) => { const decl = styleDecls(props || {}); return decl ? `${styleSelector(key)} { ${decl}; }` : ''; })
    .filter(Boolean)
    .join('\n');
}
