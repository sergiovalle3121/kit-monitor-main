/* eslint-disable @typescript-eslint/no-explicit-any */
import { summarizeConnectorFreshness, summarizeConnectorRequests } from './axosConnectors';
import { summarizeConnectorRefreshAudit } from './axosConnectorAudit';
import { auditWorkbookFormulas } from './formulaAudit';
import { buildFormulaDependencyGraph, buildFormulaRecalculationPlan } from './formulaDependencies';
import { auditFormulaErrors } from './formulaErrorAudit';
import { auditDataValidations } from './dataValidationAudit';
import { auditWorkbookProtection } from './protectionAudit';
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
  const formulaErrors = auditFormulaErrors(content);
  const dataValidation = auditDataValidations(content);
  const protection = auditWorkbookProtection(content);
  const findings: WorkbookHealthFinding[] = [];

  if (label === 'industrial') findings.push({ severity: 'warning', code: 'industrial-size', message: 'Workbook en escala industrial: considera dividir datos o usar conectores refrescables.' });
  else if (label === 'large') findings.push({ severity: 'info', code: 'large-size', message: 'Workbook grande: monitorea charts, pivots y autosave.' });

  if (audit.unknownAxosFunctions.length) findings.push({ severity: 'critical', code: 'unknown-axos-functions', message: `Funciones AXOS desconocidas: ${audit.unknownAxosFunctions.join(', ')}` });
  if (audit.externalReferences) findings.push({ severity: 'warning', code: 'external-references', message: `${audit.externalReferences} fórmula(s) con referencias externas.` });
  if (audit.volatile) findings.push({ severity: 'info', code: 'volatile-formulas', message: `${audit.volatile} fórmula(s) volátiles pueden recalcular con frecuencia.` });
  if (dependencies.cycles.length) findings.push({ severity: 'critical', code: 'formula-cycles', message: `${dependencies.cycles.length} ciclo(s) de fórmulas detectados.` });
  if (dependencies.missingReferences.length) findings.push({ severity: 'warning', code: 'missing-formula-references', message: `${dependencies.missingReferences.length} referencia(s) de fórmula apuntan a hojas faltantes.` });
  if (!recalcPlan.ready && recalcPlan.order.length) findings.push({ severity: 'info', code: 'partial-recalc-plan', message: `${recalcPlan.order.length} fórmula(s) siguen teniendo orden de recálculo seguro.` });
  if (formulaErrors.byError['#REF!']) findings.push({ severity: 'critical', code: 'formula-ref-errors', message: `${formulaErrors.byError['#REF!']} celda(s) muestran #REF! y requieren reparación.` });
  if (formulaErrors.byError['#DIV/0!']) findings.push({ severity: 'warning', code: 'formula-div-zero-errors', message: `${formulaErrors.byError['#DIV/0!']} celda(s) muestran #DIV/0!.` });
  const otherFormulaErrors = formulaErrors.total - formulaErrors.byError['#REF!'] - formulaErrors.byError['#DIV/0!'];
  if (otherFormulaErrors) findings.push({ severity: 'warning', code: 'formula-visible-errors', message: `${otherFormulaErrors} celda(s) muestran errores de fórmula visibles.` });
  if (dataValidation.invalid) findings.push({ severity: 'warning', code: 'data-validation-invalid', message: `${dataValidation.invalid} celda(s) incumplen reglas de validación de datos.` });
  if (protection.unprotectedConnectors.length) findings.push({ severity: 'warning', code: 'connector-ranges-unprotected', message: `${protection.unprotectedConnectors.length} conector(es) no tienen rango protegido.` });
  if (protection.lockedRanges || protection.sheetLocks) findings.push({ severity: 'info', code: 'workbook-protection', message: `${protection.sheetLocks} hoja(s) y ${protection.lockedRanges} rango(s) protegidos.` });

  const comments = Array.isArray(content?.comments) ? content.comments : [];
  const openComments = comments.filter((c: any) => !c.resolved).length;
  if (openComments) findings.push({ severity: 'info', code: 'open-comments', message: `${openComments} comentario(s) abiertos antes de publicar.` });

  const connectors = Array.isArray(content?.connectors) ? content.connectors : [];
  const freshness = summarizeConnectorFreshness(connectors, now);
  const connectorRequests = summarizeConnectorRequests(connectors);
  if (freshness.stale) findings.push({ severity: 'warning', code: 'stale-connectors', message: `${freshness.stale} conector(es) están vencidos críticamente.` });
  if (freshness.due) findings.push({ severity: 'info', code: 'connector-refresh-due', message: `${freshness.due} conector(es) requieren refresh según su política.` });
  if (freshness.invalid) findings.push({ severity: 'warning', code: 'invalid-connectors', message: `${freshness.invalid} conector(es) tienen metadata inválida.` });
  if (connectorRequests.invalid) findings.push({ severity: 'warning', code: 'invalid-connector-params', message: `${connectorRequests.invalid} conector(es) tienen parámetros incompletos o inválidos para refresh vivo.` });
  const localFallback = connectors.filter((c: any) => c.lastRefreshSource === 'local').length;
  const connectorWarnings = connectors.filter((c: any) => Array.isArray(c.lastRefreshWarnings) && c.lastRefreshWarnings.length > 0).length;
  const apiRefreshed = connectors.filter((c: any) => c.lastRefreshSource === 'api').length;
  if (localFallback) findings.push({ severity: 'warning', code: 'connector-local-fallback', message: `${localFallback} conector(es) usan fallback local; refresca contra API antes de publicar.` });
  if (connectorWarnings) findings.push({ severity: 'info', code: 'connector-refresh-warnings', message: `${connectorWarnings} conector(es) reportaron warnings del backend.` });
  if (apiRefreshed && !freshness.due && !freshness.stale && !freshness.invalid) findings.push({ severity: 'info', code: 'connector-api-provenance', message: `${apiRefreshed} conector(es) tienen procedencia API registrada.` });
  const connectorAudit = Array.isArray(content?.connectorAudit) ? content.connectorAudit : [];
  const connectorAuditSummary = summarizeConnectorRefreshAudit(connectorAudit);
  if (connectorAuditSummary.fallback) findings.push({ severity: 'warning', code: 'connector-refresh-audit-fallback', message: `${connectorAuditSummary.fallback} evento(s) recientes de refresh usaron fallback local.` });
  if (connectorAuditSummary.warnings) findings.push({ severity: 'info', code: 'connector-refresh-audit-warnings', message: `${connectorAuditSummary.warnings} evento(s) de refresh registraron warnings.` });
  if (connectors.length && !connectorAuditSummary.total) findings.push({ severity: 'info', code: 'missing-connector-audit', message: 'Hay conectores sin historial de refresh auditable en el workbook.' });
  if (connectors.length && !stats.charts) findings.push({ severity: 'info', code: 'connectors-without-charts', message: 'Hay conectores sin charts persistidos; considera crear dashboard.' });

  const penalty = findings.reduce((sum, finding) => sum + (finding.severity === 'critical' ? 35 : finding.severity === 'warning' ? 15 : 5), 0);
  return { label, findings, score: Math.max(0, 100 - penalty) };
}

export function formatWorkbookHealthReport(report: WorkbookHealthReport): string {
  if (!report.findings.length) return `Salud del workbook: ${report.score}/100 · ${report.label}\nSin hallazgos relevantes.`;
  return [`Salud del workbook: ${report.score}/100 · ${report.label}`, ...report.findings.map((f) => `${f.severity.toUpperCase()} [${f.code}] ${f.message}`)].join('\n');
}
