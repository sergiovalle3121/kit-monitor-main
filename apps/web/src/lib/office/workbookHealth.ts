/* eslint-disable @typescript-eslint/no-explicit-any */
import { summarizeConnectorFreshness } from './axosConnectors';
import { auditWorkbookFormulas } from './formulaAudit';
import { buildFormulaDependencyGraph, buildFormulaRecalculationPlan } from './formulaDependencies';
import { normalizeWorkbookApproval } from './workbookApproval';
import { estimateWorkbookStats, workbookPerformanceLabel } from './workbookPerformance';

export type WorkbookHealthSeverity = 'info' | 'warning' | 'critical';
export interface WorkbookHealthFinding { severity: WorkbookHealthSeverity; code: string; message: string }
export interface WorkbookHealthReport { label: ReturnType<typeof workbookPerformanceLabel>; findings: WorkbookHealthFinding[]; score: number }

export function analyzeWorkbookHealth(content: any, now = new Date()): WorkbookHealthReport {
  const stats = estimateWorkbookStats(content);
  const label = workbookPerformanceLabel(stats);
  const audit = auditWorkbookFormulas(content);
  const dependencies = buildFormulaDependencyGraph(content);
  const recalcPlan = buildFormulaRecalculationPlan(dependencies);
  const findings: WorkbookHealthFinding[] = [];

  if (label === 'industrial') findings.push({ severity: 'warning', code: 'industrial-size', message: 'Workbook en escala industrial: considera dividir datos o usar conectores refrescables.' });
  else if (label === 'large') findings.push({ severity: 'info', code: 'large-size', message: 'Workbook grande: monitorea charts, pivots y autosave.' });

  if (audit.unknownAxosFunctions.length) findings.push({ severity: 'critical', code: 'unknown-axos-functions', message: `Funciones AXOS desconocidas: ${audit.unknownAxosFunctions.join(', ')}` });
  if (audit.externalReferences) findings.push({ severity: 'warning', code: 'external-references', message: `${audit.externalReferences} fórmula(s) con referencias externas.` });
  if (audit.volatile) findings.push({ severity: 'info', code: 'volatile-formulas', message: `${audit.volatile} fórmula(s) volátiles pueden recalcular con frecuencia.` });
  if (dependencies.cycles.length) findings.push({ severity: 'critical', code: 'formula-cycles', message: `${dependencies.cycles.length} ciclo(s) de fórmulas detectados.` });
  if (dependencies.missingReferences.length) findings.push({ severity: 'warning', code: 'missing-formula-references', message: `${dependencies.missingReferences.length} referencia(s) de fórmula apuntan a hojas faltantes.` });
  if (!recalcPlan.ready && recalcPlan.order.length) findings.push({ severity: 'info', code: 'partial-recalc-plan', message: `${recalcPlan.order.length} fórmula(s) siguen teniendo orden de recálculo seguro.` });

  const governance = governanceOf(content);
  const openComments = governance.openComments;
  if (openComments) findings.push({ severity: 'info', code: 'open-comments', message: `${openComments} comentario(s) abiertos antes de publicar.` });

  if (governance.assignedComments) findings.push({ severity: 'info', code: 'assigned-comments', message: `${governance.assignedComments} comentario(s) tienen responsable asignado.` });
  if (governance.pendingApprovals) findings.push({ severity: 'warning', code: 'pending-approvals', message: `${governance.pendingApprovals} aprobación(es) pendientes antes de liberar o exportar.` });
  if (governance.rejectedApprovals) findings.push({ severity: 'critical', code: 'rejected-approvals', message: `${governance.rejectedApprovals} aprobación(es) rechazadas requieren acción.` });
  const summary = deriveSheetSummary(content);
  if (summary.unprotectedFormulas) findings.push({ severity: 'warning', code: 'unprotected-formulas', message: `${summary.unprotectedFormulas} fórmula(s) no protegidas pueden alterarse antes de aprobar.` });
  if (summary.protectedSheets || summary.protectedRanges) findings.push({ severity: 'info', code: 'protected-areas', message: `${summary.protectedSheets} hoja(s) y ${summary.protectedRanges} rango(s) protegidos.` });
  if (governance.exportWarnings) findings.push({ severity: 'warning', code: 'export-warnings', message: `${governance.exportWarnings} advertencia(s) de exportación requieren revisión.` });
  if (governance.sharingStatus !== 'private' || governance.sharedPrincipals) findings.push({ severity: 'info', code: 'sharing-status', message: `Compartición: ${governance.sharingStatus}${governance.sharedPrincipals ? ` · ${governance.sharedPrincipals} colaborador(es)` : ''}.` });
  const approval = normalizeWorkbookApproval(content?.approval);
  if (approval.status === 'draft') findings.push({ severity: 'info', code: 'approval-draft', message: 'Workbook en draft: envíalo a revisión antes de usarlo como evidencia controlada.' });
  if (approval.status === 'in_review') findings.push({ severity: 'info', code: 'approval-in-review', message: `Workbook en revisión${approval.requestedBy ? ` solicitado por ${approval.requestedBy}` : ''}.` });
  if (approval.status === 'rejected') findings.push({ severity: 'warning', code: 'approval-rejected', message: `Workbook rechazado${approval.notes ? `: ${approval.notes}` : '; revisa notas antes de publicar.'}` });

  const connectors = Array.isArray(content?.connectors) ? content.connectors : [];
  const freshness = summarizeConnectorFreshness(connectors, now);
  if (freshness.stale) findings.push({ severity: 'warning', code: 'stale-connectors', message: `${freshness.stale} conector(es) están vencidos críticamente.` });
  if (freshness.due) findings.push({ severity: 'info', code: 'connector-refresh-due', message: `${freshness.due} conector(es) requieren refresh según su política.` });
  if (connectors.filter((c: any) => ['failed', 'error'].includes(String(c?.status ?? c?.lastStatus ?? '').toLowerCase()) || !!c?.lastError || !!c?.error).length) findings.push({ severity: 'critical', code: 'failed-queries', message: `${connectors.filter((c: any) => ['failed', 'error'].includes(String(c?.status ?? c?.lastStatus ?? '').toLowerCase()) || !!c?.lastError || !!c?.error).length} consulta(s) fallidas en conectores AXOS.` });
  if (freshness.invalid) findings.push({ severity: 'warning', code: 'invalid-connectors', message: `${freshness.invalid} conector(es) tienen metadata inválida.` });
  if (connectors.length && !stats.charts) findings.push({ severity: 'info', code: 'connectors-without-charts', message: 'Hay conectores sin charts persistidos; considera crear dashboard.' });

  const penalty = findings.reduce((sum, finding) => sum + (finding.severity === 'critical' ? 35 : finding.severity === 'warning' ? 15 : 5), 0);
  return { label, findings, score: Math.max(0, 100 - penalty) };
}

export function formatWorkbookHealthReport(report: WorkbookHealthReport): string {
  if (!report.findings.length) return `Salud del workbook: ${report.score}/100 · ${report.label}\nSin hallazgos relevantes.`;
  return [`Salud del workbook: ${report.score}/100 · ${report.label}`, ...report.findings.map((f) => `${f.severity.toUpperCase()} [${f.code}] ${f.message}`)].join('\n');
}

export interface SheetRangeRef { r1: number; c1: number; r2: number; c2: number }
export interface SheetSelectionStats { range: string; count: number; nums: number; sum: number; average: number; min: number | null; max: number | null; formulas: number; comments: number; protected: boolean; invalid: number }
export interface SheetSummary { sheets: number; usedCells: number; formulas: number; charts: number; pivots: number; validations: number; comments: number; protectedRanges: number; protectedSheets: number; unprotectedFormulas: number; namedRanges: number; filters: number; connectors: number; failedQueries: number }
export interface WorkbookGovernanceSummary { openComments: number; resolvedComments: number; assignedComments: number; pendingApprovals: number; rejectedApprovals: number; approvedApprovals: number; exportWarnings: number; sharingStatus: string; sharedPrincipals: number }
export interface DerivedWorkbookHealth extends SheetSummary, WorkbookGovernanceSummary { unsupportedXlsxFeatures: number; importWarnings: number; staleAxosConnectors: number; approvalStatus: ReturnType<typeof normalizeWorkbookApproval>['status']; score: number; findings: WorkbookHealthFinding[] }

function sheetsOf(content: any): any[] { return Array.isArray(content) ? content : (Array.isArray(content?.sheets) ? content.sheets : []); }
function colNameLocal(n: number): string { let s = ''; n += 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - m) / 26); } return s; }
export function formatSheetRange(input?: Partial<SheetRangeRef> | string | null): string {
  if (!input) return 'Sin selección';
  if (typeof input === 'string') return input;
  const r1 = Math.max(0, input.r1 ?? 0), c1 = Math.max(0, input.c1 ?? 0), r2 = Math.max(r1, input.r2 ?? r1), c2 = Math.max(c1, input.c2 ?? c1);
  const a = `${colNameLocal(c1)}${r1 + 1}`, b = `${colNameLocal(c2)}${r2 + 1}`;
  return a === b ? a : `${a}:${b}`;
}
function parseA1(range: string): SheetRangeRef | null {
  const m = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i.exec(range.trim());
  if (!m) return null;
  const toCol = (s: string) => s.toUpperCase().split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const r1 = Number(m[2]) - 1, c1 = toCol(m[1]), r2 = m[4] ? Number(m[4]) - 1 : r1, c2 = m[3] ? toCol(m[3]) : c1;
  return { r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2) };
}
function rangeContainsCell(range: string | undefined, r: number, c: number): boolean {
  const parsed = range ? parseA1(String(range).replace(/^[^!]+!/, '')) : null;
  return !!parsed && r >= parsed.r1 && r <= parsed.r2 && c >= parsed.c1 && c <= parsed.c2;
}
function isFormulaCell(cd: any): boolean { return typeof cd?.v?.f === 'string' || (typeof cd?.v?.v === 'string' && cd.v.v.startsWith('=')); }
function isCellProtected(sheet: any, cd: any): boolean {
  const protection = sheet?.axosProtection ?? {};
  if (protection.sheetLocked) return true;
  const ranges = Array.isArray(protection.ranges) ? protection.ranges : [];
  return ranges.some((p: any) => p?.locked !== false && rangeContainsCell(p?.range, Number(cd?.r ?? -1), Number(cd?.c ?? -1)));
}
function governanceOf(content: any): WorkbookGovernanceSummary {
  const comments = Array.isArray(content?.comments) ? content.comments : [];
  const approvals = Array.isArray(content?.approvals) ? content.approvals : [];
  const shared = Array.isArray(content?.sharedWith) ? content.sharedWith : (Array.isArray(content?.shares) ? content.shares : []);
  const rawStatus = content?.sharingStatus ?? content?.shareStatus ?? (shared.length ? 'shared' : (content?.visibility ?? 'private'));
  return {
    openComments: comments.filter((c: any) => !c?.resolved).length,
    resolvedComments: comments.filter((c: any) => !!c?.resolved).length,
    assignedComments: comments.filter((c: any) => !!(c?.assignee || c?.assignedTo || c?.assigneeId)).length,
    pendingApprovals: approvals.filter((a: any) => ['pending', 'requested', 'in_review'].includes(String(a?.status ?? '').toLowerCase())).length,
    rejectedApprovals: approvals.filter((a: any) => ['rejected', 'changes_requested'].includes(String(a?.status ?? '').toLowerCase())).length,
    approvedApprovals: approvals.filter((a: any) => ['approved', 'signed'].includes(String(a?.status ?? '').toLowerCase())).length,
    exportWarnings: Array.isArray(content?.exportWarnings) ? content.exportWarnings.length : 0,
    sharingStatus: String(rawStatus || 'private'),
    sharedPrincipals: shared.length,
  };
}
function raw(cd: any): any { const v = cd?.v; return v && typeof v === 'object' ? (v.v ?? v.m ?? v.f ?? '') : v; }
export function deriveSheetSelectionStats(sheet: any, rangeInput: string | SheetRangeRef, comments: any[] = []): SheetSelectionStats {
  const rng = typeof rangeInput === 'string' ? parseA1(rangeInput) : rangeInput;
  const range = formatSheetRange(rangeInput as any);
  if (!sheet || !rng) return { range, count: 0, nums: 0, sum: 0, average: 0, min: null, max: null, formulas: 0, comments: 0, protected: false, invalid: 0 };
  const cells = (sheet.celldata ?? []).filter((cd: any) => cd.r >= rng.r1 && cd.r <= rng.r2 && cd.c >= rng.c1 && cd.c <= rng.c2);
  const values = cells.map(raw).filter((v: any) => v !== '' && v != null);
  const nums = values.map(Number).filter(Number.isFinite);
  const sum = nums.reduce((a: number, b: number) => a + b, 0);
  const protection = sheet.axosProtection ?? {};
  const protectedRanges = Array.isArray(protection.ranges) ? protection.ranges : [];
  return { range, count: values.length, nums: nums.length, sum, average: nums.length ? sum / nums.length : 0, min: nums.length ? Math.min(...nums) : null, max: nums.length ? Math.max(...nums) : null, formulas: cells.filter((cd: any) => typeof cd?.v?.f === 'string').length, comments: comments.filter((c) => c.range === range || c.range === formatSheetRange(range)).length, protected: !!protection.sheetLocked || protectedRanges.some((p: any) => p.range === range), invalid: cells.filter((cd: any) => cd?.v?.bg === '#fee2e2' || cd?.v?.axosInvalid).length };
}
export function deriveSheetSummary(content: any): SheetSummary {
  const sheets = sheetsOf(content);
  const validations = sheets.reduce((sum, s) => sum + Object.keys(s?.dataVerification ?? s?.dataVerificationConfig ?? {}).length, 0);
  const protectedSheets = sheets.filter((s) => !!s?.axosProtection?.sheetLocked).length;
  const protectedRanges = sheets.reduce((sum, s) => sum + (Array.isArray(s?.axosProtection?.ranges) ? s.axosProtection.ranges.length : 0), 0);
  const filters = sheets.filter((s) => !!(s?.filter_select || s?.config?.filter_select)).length;
  const formulas = sheets.reduce((sum, s) => sum + ((s?.celldata ?? []) as any[]).filter(isFormulaCell).length, 0);
  const unprotectedFormulas = sheets.reduce((sum, s) => sum + ((s?.celldata ?? []) as any[]).filter((cd) => isFormulaCell(cd) && !isCellProtected(s, cd)).length, 0);
  const connectors = Array.isArray(content?.connectors) ? content.connectors : [];
  const failedQueries = connectors.filter((c: any) => ['failed', 'error'].includes(String(c?.status ?? c?.lastStatus ?? '').toLowerCase()) || !!c?.lastError || !!c?.error).length;
  return { sheets: sheets.length, usedCells: sheets.reduce((sum, s) => sum + ((s?.celldata ?? []) as any[]).length, 0), formulas, charts: Array.isArray(content?.charts) ? content.charts.length : 0, pivots: Array.isArray(content?.pivots) ? content.pivots.length : 0, validations, comments: Array.isArray(content?.comments) ? content.comments.length : 0, protectedRanges, protectedSheets, unprotectedFormulas, namedRanges: Array.isArray(content?.names) ? content.names.length : 0, filters, connectors: connectors.length, failedQueries };
}
export function deriveWorkbookHealth(content: any, now = new Date()): DerivedWorkbookHealth {
  const summary = deriveSheetSummary(content);
  const report = analyzeWorkbookHealth(content, now);
  const governance = governanceOf(content);
  const connectors = Array.isArray(content?.connectors) ? content.connectors : [];
  const freshness = summarizeConnectorFreshness(connectors, now);
  const approval = normalizeWorkbookApproval(content?.approval);
  return { ...summary, ...governance, unsupportedXlsxFeatures: Array.isArray(content?.unsupportedXlsxFeatures) ? content.unsupportedXlsxFeatures.length : 0, importWarnings: Array.isArray(content?.importWarnings) ? content.importWarnings.length : 0, staleAxosConnectors: freshness.stale + freshness.invalid, approvalStatus: approval.status, score: report.score, findings: report.findings };
}
