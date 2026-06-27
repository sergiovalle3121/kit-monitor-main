/* eslint-disable @typescript-eslint/no-explicit-any */
import { summarizeConnectorFreshness } from './axosConnectors';
import { auditWorkbookFormulas } from './formulaAudit';
import { buildFormulaDependencyGraph, buildFormulaRecalculationPlan } from './formulaDependencies';
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

  const comments = Array.isArray(content?.comments) ? content.comments : [];
  const openComments = comments.filter((c: any) => !c.resolved).length;
  if (openComments) findings.push({ severity: 'info', code: 'open-comments', message: `${openComments} comentario(s) abiertos antes de publicar.` });

  const connectors = Array.isArray(content?.connectors) ? content.connectors : [];
  const freshness = summarizeConnectorFreshness(connectors, now);
  if (freshness.stale) findings.push({ severity: 'warning', code: 'stale-connectors', message: `${freshness.stale} conector(es) están vencidos críticamente.` });
  if (freshness.due) findings.push({ severity: 'info', code: 'connector-refresh-due', message: `${freshness.due} conector(es) requieren refresh según su política.` });
  if (freshness.invalid) findings.push({ severity: 'warning', code: 'invalid-connectors', message: `${freshness.invalid} conector(es) tienen metadata inválida.` });
  if (connectors.length && !stats.charts) findings.push({ severity: 'info', code: 'connectors-without-charts', message: 'Hay conectores sin charts persistidos; considera crear dashboard.' });

  const penalty = findings.reduce((sum, finding) => sum + (finding.severity === 'critical' ? 35 : finding.severity === 'warning' ? 15 : 5), 0);
  return { label, findings, score: Math.max(0, 100 - penalty) };
}

export function formatWorkbookHealthReport(report: WorkbookHealthReport): string {
  if (!report.findings.length) return `Salud del workbook: ${report.score}/100 · ${report.label}\nSin hallazgos relevantes.`;
  return [`Salud del workbook: ${report.score}/100 · ${report.label}`, ...report.findings.map((f) => `${f.severity.toUpperCase()} [${f.code}] ${f.message}`)].join('\n');
}
