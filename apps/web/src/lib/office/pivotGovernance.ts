/* eslint-disable @typescript-eslint/no-explicit-any */
import { buildPivot, pivotFields, pivotToCelldata, type PivotConfig, type PivotCellOut } from './sheetOps';

export type StoredPivotDefinition = { id: string; config: PivotConfig; sheetName: string };
export type PivotRefreshStatus = 'updated' | 'missing-source' | 'missing-target' | 'empty-result';

export interface PivotRefreshFinding {
  id: string;
  sheetName: string;
  sourceSheetIndex: number;
  status: PivotRefreshStatus;
  rows: number;
  cols: number;
  warnings: string[];
}

export interface PivotRefreshReport {
  updated: number;
  skipped: number;
  findings: PivotRefreshFinding[];
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export type PivotDraftStatus = 'ready' | 'needs-fields' | 'invalid-source' | 'empty-result' | 'warnings';

export interface PivotDraftMissingField {
  zone: 'rows' | 'columns' | 'values' | 'filters';
  field: string;
}

export interface PivotDraftPreview {
  rows: string[][];
  truncatedRows: boolean;
  truncatedColumns: boolean;
}

export interface PivotDraftAnalysis {
  status: PivotDraftStatus;
  canCreate: boolean;
  summary: string;
  fields: string[];
  missingFields: PivotDraftMissingField[];
  warnings: string[];
  resultRows: number;
  resultCols: number;
  preview: PivotDraftPreview;
}

export function analyzePivotDraft(
  sheets: any[],
  cfg: PivotConfig,
  opts: { maxRows?: number; maxCols?: number } = {},
): PivotDraftAnalysis {
  const maxRows = opts.maxRows ?? 8;
  const maxCols = opts.maxCols ?? 6;
  const source = sheets[cfg.sheetIndex];
  if (!source) {
    return emptyDraft('invalid-source', 'La hoja de origen no existe.');
  }

  const fields = pivotFields(source, cfg.range);
  if (!fields.length) {
    return {
      ...emptyDraft('invalid-source', 'No se detectaron encabezados en el rango seleccionado.'),
      fields,
    };
  }

  const missingFields = missingPivotFields(fields, cfg);
  const needsLayout = !(cfg.rows.length || cfg.cols.length) || !cfg.values.length;
  if (needsLayout) {
    return {
      ...emptyDraft('needs-fields', 'Agrega al menos un campo a Filas/Columnas y uno a Valores.'),
      fields,
      missingFields,
      warnings: missingFields.map(formatMissingPivotField),
    };
  }

  if (missingFields.length) {
    return {
      ...emptyDraft('invalid-source', 'La configuracion usa campos que no existen en el rango.'),
      fields,
      missingFields,
      warnings: missingFields.map(formatMissingPivotField),
    };
  }

  const result = buildPivot(source, cfg);
  const preview = previewPivotMatrix(result.matrix, maxRows, maxCols);
  if (!result.matrix.length) {
    return {
      status: 'empty-result',
      canCreate: false,
      summary: result.warnings[0] || 'La tabla dinamica no produciria filas.',
      fields,
      missingFields,
      warnings: result.warnings,
      resultRows: result.nRows,
      resultCols: result.nCols,
      preview,
    };
  }

  const status: PivotDraftStatus = result.warnings.length ? 'warnings' : 'ready';
  return {
    status,
    canCreate: true,
    summary: status === 'ready'
      ? `Preview listo: ${result.nRows} fila(s) x ${result.nCols} columna(s).`
      : `Preview con ${result.warnings.length} advertencia(s).`,
    fields,
    missingFields,
    warnings: result.warnings,
    resultRows: result.nRows,
    resultCols: result.nCols,
    preview,
  };
}

function emptyDraft(status: PivotDraftStatus, summary: string): PivotDraftAnalysis {
  return {
    status,
    canCreate: false,
    summary,
    fields: [],
    missingFields: [],
    warnings: [],
    resultRows: 0,
    resultCols: 0,
    preview: { rows: [], truncatedRows: false, truncatedColumns: false },
  };
}

function missingPivotFields(fields: string[], cfg: PivotConfig): PivotDraftMissingField[] {
  const known = new Set(fields);
  const missing: PivotDraftMissingField[] = [];
  const add = (zone: PivotDraftMissingField['zone'], field: string) => {
    if (!known.has(field)) missing.push({ zone, field });
  };
  cfg.rows.forEach((field) => add('rows', field));
  cfg.cols.forEach((field) => add('columns', field));
  cfg.values.forEach((value) => add('values', value.field));
  (cfg.filters ?? []).forEach((filter) => add('filters', filter.field));
  return missing;
}

function formatMissingPivotField(field: PivotDraftMissingField): string {
  return `${field.zone}: ${field.field} no existe en el rango fuente.`;
}

function previewPivotMatrix(matrix: PivotCellOut[][], maxRows: number, maxCols: number): PivotDraftPreview {
  const rows = matrix.slice(0, maxRows).map((row) => row.slice(0, maxCols).map(formatPivotPreviewValue));
  return {
    rows,
    truncatedRows: matrix.length > maxRows,
    truncatedColumns: matrix.some((row) => row.length > maxCols),
  };
}

function formatPivotPreviewValue(cell: PivotCellOut): string {
  if (cell.v == null) return '';
  if (cell.pct && typeof cell.v === 'number') return `${(cell.v * 100).toFixed(1)}%`;
  return String(cell.v);
}

export function analyzeStoredPivots(sheets: any[], pivots: StoredPivotDefinition[]): PivotRefreshReport {
  return refreshStoredPivots(sheets, pivots, { dryRun: true }).report;
}

export function refreshStoredPivots(
  sheets: any[],
  pivots: StoredPivotDefinition[],
  opts: { dryRun?: boolean } = {},
): { sheets: any[]; report: PivotRefreshReport } {
  const next = opts.dryRun ? sheets : clone(sheets);
  const findings: PivotRefreshFinding[] = [];
  let updated = 0;
  let skipped = 0;

  for (const pivot of pivots) {
    const target = next.find((sheet: any) => sheet?.name === pivot.sheetName);
    const src = next[pivot.config.sheetIndex];
    if (!src) {
      skipped++;
      findings.push(findingFor(pivot, 'missing-source'));
      continue;
    }
    if (!target) {
      skipped++;
      findings.push(findingFor(pivot, 'missing-target'));
      continue;
    }
    const result = buildPivot(src, pivot.config);
    if (!result.matrix.length) {
      skipped++;
      findings.push({ ...findingFor(pivot, 'empty-result'), warnings: result.warnings });
      continue;
    }
    if (!opts.dryRun) {
      target.celldata = pivotToCelldata(result, 0, 0);
      target.row = Math.max(100, result.nRows + 8);
      target.column = Math.max(26, result.nCols + 4);
    }
    updated++;
    findings.push({
      id: pivot.id,
      sheetName: pivot.sheetName,
      sourceSheetIndex: pivot.config.sheetIndex,
      status: 'updated',
      rows: result.nRows,
      cols: result.nCols,
      warnings: result.warnings,
    });
  }

  return { sheets: next, report: { updated, skipped, findings } };
}

export function formatPivotRefreshReport(report: PivotRefreshReport): string {
  if (!report.findings.length) return 'No hay tablas dinámicas guardadas.';
  const broken = report.findings.filter((finding) => finding.status !== 'updated');
  const warn = report.findings.filter((finding) => finding.warnings.length);
  const parts = [`${report.updated} actualizada(s)`, `${report.skipped} omitida(s)`];
  if (broken.length) parts.push(`${broken.length} requieren atención`);
  if (warn.length) parts.push(`${warn.length} con advertencias`);
  return `Tablas dinámicas: ${parts.join(' · ')}.`;
}

function findingFor(pivot: StoredPivotDefinition, status: PivotRefreshStatus): PivotRefreshFinding {
  return {
    id: pivot.id,
    sheetName: pivot.sheetName,
    sourceSheetIndex: pivot.config.sheetIndex,
    status,
    rows: 0,
    cols: 0,
    warnings: [],
  };
}
