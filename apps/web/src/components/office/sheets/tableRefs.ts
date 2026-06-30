/**
 * Referencias estructuradas de Excel (`Tabla[Columna]`, `Tabla[#Todo]`, `Tabla[#Encabezados]`).
 *
 * Como `LET` (§31), se resuelven por **preprocesado de cadena** antes del parser: cada
 * `Nombre[…]` se sustituye por su rango A1 (calificado con la hoja). Una tabla con nombre vive en
 * el contenido del libro; `SheetEditor` mantiene un **registro** global (`setTableRegistry`) que
 * el parche de `parse` consulta. Puro y testeable (la expansión no toca el DOM).
 *
 * Formas soportadas: `T[Col]` (datos de una columna), `T[]`/`T[#Datos]` (cuerpo de datos),
 * `T[#Encabezados]`/`T[#Headers]` (fila de cabecera), `T[#Todo]`/`T[#All]` (cabecera + datos),
 * y `T[[Col con espacios]]` / `T[[#Todo]]`. (La forma `T[@Col]` de «esta fila» no se soporta:
 * el preprocesado no conoce la fila del cursor.)
 */

export interface TableDef { name: string; sheetName: string; r1: number; c1: number; r2: number; c2: number; headers: string[] }

export type TableReadinessSeverity = 'info' | 'warning' | 'error';
export type TableReadinessStatus = 'ready' | 'review' | 'blocked';

export interface TableReadinessIssue {
  key: string;
  severity: TableReadinessSeverity;
  message: string;
}

export interface TableReadinessReport {
  status: TableReadinessStatus;
  score: number;
  rows: number;
  columns: number;
  dataRows: number;
  structuredReferences: boolean;
  issues: TableReadinessIssue[];
}

export interface TableRangeReadinessInput {
  range: string;
  hasHeader?: boolean;
  totalRow?: boolean;
  withFilter?: boolean;
  tableName?: string;
  existingTableNames?: string[];
}

function colIndex(s: string): number | null {
  let n = 0;
  const text = s.toUpperCase();
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code < 65 || code > 90) return null;
    n = n * 26 + (code - 64);
  }
  return n - 1;
}

function parseA1Range(range: string): { r1: number; c1: number; r2: number; c2: number } | null {
  const text = String(range ?? '').toUpperCase().replace(/\s/g, '');
  const [a, b = a] = text.split(':');
  const parseRef = (ref: string) => {
    const m = /^([A-Z]+)([1-9][0-9]*)$/.exec(ref);
    if (!m) return null;
    const c = colIndex(m[1]);
    if (c == null) return null;
    return { r: Number(m[2]) - 1, c };
  };
  const A = parseRef(a);
  const B = parseRef(b);
  if (!A || !B) return null;
  return { r1: Math.min(A.r, B.r), c1: Math.min(A.c, B.c), r2: Math.max(A.r, B.r), c2: Math.max(A.c, B.c) };
}

function isCellReferenceLike(name: string): boolean {
  return parseA1Range(name) != null;
}

function tableNameIssues(name?: string, existing: string[] = []): TableReadinessIssue[] {
  const text = String(name ?? '').trim();
  if (!text) return [];
  const issues: TableReadinessIssue[] = [];
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(text) || isCellReferenceLike(text)) {
    issues.push({
      key: 'invalid_table_name',
      severity: 'error',
      message: 'El nombre de tabla debe iniciar con letra o guion bajo, no contener espacios y no parecer una celda.',
    });
  }
  if (existing.some((x) => String(x).trim().toLowerCase() === text.toLowerCase())) {
    issues.push({
      key: 'duplicate_table_name',
      severity: 'error',
      message: 'Ya existe una tabla con ese nombre; las referencias estructuradas quedarian ambiguas.',
    });
  }
  return issues;
}

function reportFor(
  issues: TableReadinessIssue[],
  rows: number,
  columns: number,
  dataRows: number,
  structuredReferences: boolean,
): TableReadinessReport {
  const errors = issues.filter((x) => x.severity === 'error').length;
  const warnings = issues.filter((x) => x.severity === 'warning').length;
  const infos = issues.filter((x) => x.severity === 'info').length;
  const status: TableReadinessStatus = errors ? 'blocked' : warnings ? 'review' : 'ready';
  const score = issues.some((x) => x.key === 'invalid_range')
    ? 0
    : Math.max(0, 100 - (errors * 35) - (warnings * 15) - (infos * 5));
  return { status, score, rows, columns, dataRows, structuredReferences: structuredReferences && errors === 0, issues };
}

/** Preflight for the visible "format as table" workflow before it writes style/filter metadata. */
export function analyzeTableRangeReadiness(input: TableRangeReadinessInput): TableReadinessReport {
  const issues: TableReadinessIssue[] = [];
  const rng = parseA1Range(input.range);
  if (!rng) {
    return reportFor([{
      key: 'invalid_range',
      severity: 'error',
      message: 'Rango A1 invalido. Usa un rango como A1:D20.',
    }], 0, 0, 0, false);
  }

  const rows = rng.r2 - rng.r1 + 1;
  const columns = rng.c2 - rng.c1 + 1;
  const hasHeader = input.hasHeader !== false;
  const dataRows = Math.max(0, rows - (hasHeader ? 1 : 0));
  const structuredReferences = hasHeader && dataRows > 0;

  if (hasHeader && dataRows < 1) {
    issues.push({
      key: 'missing_data_rows',
      severity: 'error',
      message: 'La tabla necesita al menos una fila de datos bajo el encabezado.',
    });
  }
  if (columns < 2) {
    issues.push({
      key: 'single_column_table',
      severity: 'warning',
      message: 'Una sola columna limita filtros, pivots, graficas y analisis industrial.',
    });
  }
  if (!hasHeader) {
    issues.push({
      key: 'no_header',
      severity: 'warning',
      message: 'Sin encabezado no se registra tabla con nombre ni referencias estructuradas.',
    });
  }
  if (input.withFilter !== false && !hasHeader) {
    issues.push({
      key: 'filter_requires_header',
      severity: 'warning',
      message: 'El autofiltro nativo requiere encabezado; no se activara para este rango.',
    });
  }
  if (input.totalRow && dataRows < 2) {
    issues.push({
      key: 'total_row_without_body',
      severity: 'warning',
      message: 'La fila de totales dejaria poca o ninguna fila normal para analizar.',
    });
  }
  if (rows * columns > 8000) {
    issues.push({
      key: 'large_table_range',
      severity: 'info',
      message: 'Rango grande: el estilo evita inflar celdas vacias masivas para proteger rendimiento.',
    });
  }
  issues.push(...tableNameIssues(input.tableName, input.existingTableNames));

  return reportFor(issues, rows, columns, dataRows, structuredReferences);
}

/** Post-registry diagnostics for named tables used by structured references. */
export function analyzeTableDefReadiness(table: TableDef, existingTableNames: string[] = []): TableReadinessReport {
  const rows = Math.max(0, table.r2 - table.r1 + 1);
  const columns = Math.max(0, table.c2 - table.c1 + 1);
  const dataRows = Math.max(0, rows - 1);
  const issues: TableReadinessIssue[] = [];
  issues.push(...tableNameIssues(table.name, existingTableNames.filter((name) => name !== table.name)));
  if (dataRows < 1) {
    issues.push({
      key: 'missing_data_rows',
      severity: 'error',
      message: 'La tabla registrada no tiene filas de datos para referencias estructuradas.',
    });
  }
  if (columns < 1 || table.headers.length !== columns) {
    issues.push({
      key: 'header_count_mismatch',
      severity: 'error',
      message: 'La cantidad de encabezados no coincide con las columnas del rango.',
    });
  }
  const normalizedHeaders = table.headers.map((header) => String(header ?? '').trim().toLowerCase());
  if (normalizedHeaders.some((header) => !header)) {
    issues.push({
      key: 'blank_headers',
      severity: 'error',
      message: 'Hay encabezados vacios; Excel no puede crear referencias estructuradas confiables.',
    });
  }
  const seen = new Set<string>();
  if (normalizedHeaders.some((header) => header && (seen.has(header) || !seen.add(header)))) {
    issues.push({
      key: 'duplicate_headers',
      severity: 'error',
      message: 'Hay encabezados duplicados; las referencias Tabla[Columna] quedarian ambiguas.',
    });
  }
  return reportFor(issues, rows, columns, dataRows, issues.every((x) => x.severity !== 'error'));
}

let REGISTRY: TableDef[] = [];
/** Registra las tablas con nombre del libro (lo llama el editor cuando cambian las hojas). */
export function setTableRegistry(tables: TableDef[]): void { REGISTRY = Array.isArray(tables) ? tables : []; }
export function getTableRegistry(): TableDef[] { return REGISTRY; }

function colName(c: number): string { let s = ''; c += 1; while (c > 0) { const r = (c - 1) % 26; s = String.fromCharCode(65 + r) + s; c = Math.floor((c - 1) / 26); } return s; }
const quoteSheet = (sn: string) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(sn) ? sn : `'${sn.replace(/'/g, "''")}'`);

/** Rango A1 (calificado con la hoja) para una especificación dentro de los corchetes. */
function rangeFor(t: TableDef, spec: string): string | null {
  const sh = `${quoteSheet(t.sheetName)}!`;
  const s = spec.trim().replace(/^\[|\]$/g, '').trim(); // admite [[...]]
  const lower = s.toLowerCase();
  const headerRow = t.r1 + 1; // 1-based
  const dataTop = t.r1 + 2, dataBot = t.r2 + 1;
  if (s === '' || lower === '#datos' || lower === '#data') return `${sh}${colName(t.c1)}${dataTop}:${colName(t.c2)}${dataBot}`;
  if (lower === '#encabezados' || lower === '#headers') return `${sh}${colName(t.c1)}${headerRow}:${colName(t.c2)}${headerRow}`;
  if (lower === '#todo' || lower === '#all') return `${sh}${colName(t.c1)}${headerRow}:${colName(t.c2)}${dataBot}`;
  // Nombre de columna (sin distinguir mayúsculas/espacios sobrantes).
  const idx = t.headers.findIndex((h) => h.trim().toLowerCase() === s.toLowerCase());
  if (idx >= 0) { const col = colName(t.c1 + idx); return `${sh}${col}${dataTop}:${col}${dataBot}`; }
  return null;
}

/** Expande todas las referencias estructuradas de `formula` usando `tables` (o el registro). */
export function expandStructuredRefs(formula: string, tables: TableDef[] = REGISTRY): string {
  if (typeof formula !== 'string' || !tables.length || formula.indexOf('[') < 0) return formula;
  let out = ''; let i = 0; let inStr = false;
  while (i < formula.length) {
    const ch = formula[i];
    if (inStr) { out += ch; if (ch === '"') { if (formula[i + 1] === '"') { out += '"'; i += 2; continue; } inStr = false; } i++; continue; }
    if (ch === '"') { inStr = true; out += ch; i++; continue; }
    // ¿Identificador seguido de «[»?
    const m = /^([A-Za-z_][A-Za-z0-9_.]*)\[/.exec(formula.slice(i));
    const prev = out[out.length - 1];
    if (m && !(prev != null && /[A-Za-z0-9_.$!]/.test(prev))) {
      const name = m[1];
      const t = tables.find((x) => x.name.toLowerCase() === name.toLowerCase());
      if (t) {
        // Extrae el contenido de corchetes equilibrando un nivel de anidamiento ([[...]]).
        let j = i + name.length; // en «[»
        let depth = 0; const start = j;
        for (; j < formula.length; j++) { const c = formula[j]; if (c === '[') depth++; else if (c === ']') { depth--; if (depth === 0) { j++; break; } } }
        const inner = formula.slice(start + 1, j - 1);
        const rng = rangeFor(t, inner);
        if (rng) { out += rng; i = j; continue; }
      }
    }
    out += ch; i++;
  }
  return out;
}
