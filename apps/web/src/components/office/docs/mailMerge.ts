/**
 * Combinar correspondencia (Mail Merge) estilo Word: un documento PLANTILLA con campos
 * `{{nombre}}` + una tabla de datos (CSV/TSV) → un documento por registro, concatenados con
 * saltos de página. Todo es transformación PURA del JSON de TipTap, así que se prueba sin DOM.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

/** Parser CSV/TSV mínimo pero correcto: comillas, comas/tabs y comillas escapadas (""). */
export function parseDelimited(text: string, delimiter?: string): { headers: string[]; rows: Record<string, string>[] } {
  const src = String(text ?? '').replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  if (!src.trim()) return { headers: [], rows: [] };
  const delim = delimiter ?? (src.split('\n')[0].includes('\t') ? '\t' : ',');
  const records: string[][] = [];
  let field = '', row: string[] = [], inQ = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQ) {
      if (ch === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); records.push(row); field = ''; row = []; }
    else field += ch;
  }
  row.push(field); records.push(row);
  const headers = (records.shift() ?? []).map((h) => h.trim());
  const rows = records
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
  return { headers, rows };
}

/** Nombres de los campos `{{campo}}` que aparecen en el documento (únicos, en orden). */
export function findMergeFields(json: any): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  (function walk(node: any) {
    if (!node) return;
    if (typeof node.text === 'string') {
      for (const m of node.text.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) { const f = m[1].trim(); if (f && !seen.has(f)) { seen.add(f); out.push(f); } }
    }
    if (Array.isArray(node.content)) node.content.forEach(walk);
  })(json);
  return out;
}

/** Sustituye los campos `{{campo}}` por los valores de `row` en una COPIA del documento. */
export function mergeDoc(json: any, row: Record<string, string>): any {
  const replace = (text: string) => text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (full, name) => {
    const key = String(name).trim();
    return Object.prototype.hasOwnProperty.call(row, key) ? String(row[key] ?? '') : full;
  });
  const clone = (node: any): any => {
    if (node == null || typeof node !== 'object') return node;
    const out: any = Array.isArray(node) ? [] : {};
    for (const k of Object.keys(node)) {
      if (k === 'text' && typeof node.text === 'string') out.text = replace(node.text);
      else if (k === 'content' && Array.isArray(node.content)) out.content = node.content.map(clone);
      else out[k] = node[k];
    }
    return out;
  };
  return clone(json);
}

/** Combina la plantilla con TODOS los registros → un único documento con saltos de página. */
export function mailMergeDocs(json: any, rows: Record<string, string>[]): any {
  if (!rows.length) return mergeDoc(json, {});
  const content: any[] = [];
  rows.forEach((row, i) => {
    const merged = mergeDoc(json, row);
    const blocks = Array.isArray(merged?.content) ? merged.content : [];
    if (i > 0) content.push({ type: 'pageBreak' });
    content.push(...blocks);
  });
  return { ...json, content };
}
