/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Helpers puros de performance para AXOS Sheets.
 *
 * Objetivos:
 * - Evitar autosaves redundantes cuando Fortune-Sheet emite el mismo payload varias veces.
 * - Obtener métricas baratas para diagnosticar workbooks medianos/grandes sin recorrer UI React.
 * - Mantener todo determinístico y testeable fuera del editor.
 */

export interface WorkbookStats {
  sheets: number;
  cells: number;
  formulas: number;
  styledCells: number;
  comments: number;
  charts: number;
  pivots: number;
  validations: number;
  connectors: number;
  approxJsonBytes: number;
}

export interface SignatureState {
  signature?: string;
}

const STYLE_KEYS = ['bg', 'fc', 'bl', 'it', 'fs', 'ff', 'ht', 'vt', 'tb', 'cl', 'un', 'bd', 'ct'];

function stableNormalize(value: any): any {
  if (Array.isArray(value)) return value.map(stableNormalize);
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, any> = {};
  for (const key of Object.keys(value).sort()) {
    const v = value[key];
    if (typeof v === 'function' || typeof v === 'undefined') continue;
    out[key] = stableNormalize(v);
  }
  return out;
}

export function stableWorkbookString(value: any): string {
  return JSON.stringify(stableNormalize(value));
}

export function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function workbookSignature(value: any): string {
  const stable = stableWorkbookString(value);
  return `${stable.length}:${fnv1a32(stable)}`;
}

export function shouldEmitWorkbook(value: any, state: SignatureState): boolean {
  const next = workbookSignature(value);
  if (state.signature === next) return false;
  state.signature = next;
  return true;
}

export function estimateWorkbookStats(content: any): WorkbookStats {
  const sheets = Array.isArray(content) ? content : (Array.isArray(content?.sheets) ? content.sheets : []);
  let cells = 0;
  let formulas = 0;
  let styledCells = 0;
  let validations = 0;
  for (const sheet of sheets) {
    const celldata = Array.isArray(sheet?.celldata) ? sheet.celldata : [];
    cells += celldata.length;
    for (const cd of celldata) {
      const v = cd?.v;
      if (v && typeof v === 'object') {
        if (v.f) formulas++;
        if (STYLE_KEYS.some((k) => v[k] != null)) styledCells++;
      }
    }
    validations += sheet?.dataVerification && typeof sheet.dataVerification === 'object' ? Object.keys(sheet.dataVerification).length : 0;
  }
  const json = stableWorkbookString(content ?? {});
  return {
    sheets: sheets.length,
    cells,
    formulas,
    styledCells,
    validations,
    comments: Array.isArray(content?.comments) ? content.comments.length : 0,
    charts: Array.isArray(content?.charts) ? content.charts.length : 0,
    pivots: Array.isArray(content?.pivots) ? content.pivots.length : 0,
    connectors: Array.isArray(content?.connectors) ? content.connectors.length : 0,
    approxJsonBytes: new TextEncoder().encode(json).length,
  };
}

export function workbookPerformanceLabel(stats: WorkbookStats): 'small' | 'medium' | 'large' | 'industrial' {
  if (stats.cells >= 100_000 || stats.approxJsonBytes >= 8_000_000) return 'industrial';
  if (stats.cells >= 25_000 || stats.approxJsonBytes >= 2_000_000) return 'large';
  if (stats.cells >= 5_000 || stats.approxJsonBytes >= 500_000) return 'medium';
  return 'small';
}
