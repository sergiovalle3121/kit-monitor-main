/* eslint-disable @typescript-eslint/no-explicit-any */
import { buildPivot, pivotToCelldata, type PivotConfig } from './sheetOps';
import { applySlicersToPivotConfig, type AxosSlicer, type AxosTimelineFilter } from '../../components/office/sheets/slicer';

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
    const slicers = Array.isArray(src.slicers) ? (src.slicers as AxosSlicer[]) : [];
    const timelines = Array.isArray(src.timelines) ? (src.timelines as AxosTimelineFilter[]) : [];
    const config = applySlicersToPivotConfig(src, pivot.config, { slicers, timelines, pivotId: pivot.id });
    const result = buildPivot(src, config);
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
