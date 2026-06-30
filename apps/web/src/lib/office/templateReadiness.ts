/* eslint-disable @typescript-eslint/no-explicit-any */

export type SheetTemplateReadinessLevel = 'blank' | 'starter' | 'analysis' | 'connected' | 'governed';

export interface SheetTemplateReadinessMetrics {
  sheets: number;
  formulas: number;
  charts: number;
  pivots: number;
  connectors: number;
  tables: number;
  validations: number;
  protectedRanges: number;
  namedRanges: number;
  comments: number;
  dashboardSheets: number;
  printLayout: boolean;
}

export interface SheetTemplateReadinessSummary {
  score: number;
  level: SheetTemplateReadinessLevel;
  label: string;
  metrics: SheetTemplateReadinessMetrics;
  badges: string[];
  warnings: string[];
}

export interface SheetTemplateBuildSource {
  id: string;
  build: () => any | Promise<any>;
}

const EMPTY_METRICS: SheetTemplateReadinessMetrics = {
  sheets: 0,
  formulas: 0,
  charts: 0,
  pivots: 0,
  connectors: 0,
  tables: 0,
  validations: 0,
  protectedRanges: 0,
  namedRanges: 0,
  comments: 0,
  dashboardSheets: 0,
  printLayout: false,
};

function sheetsOf(content: any): any[] {
  if (Array.isArray(content)) return content;
  return Array.isArray(content?.sheets) ? content.sheets : [];
}

function formulaCount(sheets: any[]): number {
  return sheets.reduce((sum, sheet) => sum + ((sheet?.celldata ?? []) as any[]).filter((cell) => (
    typeof cell?.v?.f === 'string'
    || (typeof cell?.v?.v === 'string' && cell.v.v.startsWith('='))
  )).length, 0);
}

function validationCount(sheets: any[]): number {
  return sheets.reduce((sum, sheet) => (
    sum + Object.keys(sheet?.dataVerification ?? sheet?.dataVerificationConfig ?? {}).length
  ), 0);
}

function protectedRangeCount(sheets: any[]): number {
  return sheets.reduce((sum, sheet) => (
    sum
    + (sheet?.axosProtection?.sheetLocked ? 1 : 0)
    + (Array.isArray(sheet?.axosProtection?.ranges) ? sheet.axosProtection.ranges.length : 0)
  ), 0);
}

function hasPromiseShape(value: any): value is Promise<any> {
  return !!value && typeof value === 'object' && typeof value.then === 'function';
}

function labelFor(level: SheetTemplateReadinessLevel): string {
  if (level === 'governed') return 'Governed';
  if (level === 'connected') return 'Connected';
  if (level === 'analysis') return 'Analysis';
  if (level === 'starter') return 'Starter';
  return 'Blank';
}

function levelFor(score: number, metrics: SheetTemplateReadinessMetrics): SheetTemplateReadinessLevel {
  if (!metrics.sheets) return 'blank';
  if (score >= 85) return 'governed';
  if (score >= 70) return 'connected';
  if (score >= 50) return 'analysis';
  return 'starter';
}

function badgesFor(metrics: SheetTemplateReadinessMetrics): string[] {
  const badges: string[] = [];
  if (metrics.dashboardSheets) badges.push('Dashboard');
  if (metrics.connectors) badges.push('Connector');
  if (metrics.pivots) badges.push('Pivots');
  if (metrics.charts) badges.push('Charts');
  if (metrics.formulas) badges.push('Formulas');
  if (metrics.tables) badges.push('Tables');
  if (metrics.validations) badges.push('Validation');
  if (metrics.protectedRanges) badges.push('Protected');
  if (metrics.namedRanges) badges.push('Named ranges');
  if (metrics.printLayout) badges.push('Print');
  return badges;
}

function warningsFor(metrics: SheetTemplateReadinessMetrics): string[] {
  const warnings: string[] = [];
  if (!metrics.sheets) {
    warnings.push('Blank template has no industrial workbook payload.');
    return warnings;
  }
  if (!metrics.formulas) warnings.push('No formulas detected; template is a static grid.');
  if (metrics.connectors && !metrics.protectedRanges) warnings.push('Connector metadata exists without protected connector ranges.');
  if ((metrics.connectors || metrics.pivots || metrics.charts) && !metrics.printLayout) warnings.push('No print layout metadata for report export.');
  if ((metrics.connectors || metrics.pivots || metrics.charts) && !metrics.namedRanges) warnings.push('No named ranges for governed formula/navigation handoff.');
  if (!metrics.charts && !metrics.pivots && !metrics.connectors) warnings.push('No chart, pivot, or AXOS connector layer yet.');
  return warnings;
}

export function analyzeSheetTemplateReadiness(content: any): SheetTemplateReadinessSummary {
  const sheets = sheetsOf(content);
  const metrics: SheetTemplateReadinessMetrics = {
    sheets: sheets.length,
    formulas: formulaCount(sheets),
    charts: Array.isArray(content?.charts) ? content.charts.length : 0,
    pivots: Array.isArray(content?.pivots) ? content.pivots.length : 0,
    connectors: Array.isArray(content?.connectors) ? content.connectors.length : 0,
    tables: Array.isArray(content?.tables) ? content.tables.length : 0,
    validations: validationCount(sheets),
    protectedRanges: protectedRangeCount(sheets),
    namedRanges: Array.isArray(content?.names) ? content.names.length : 0,
    comments: Array.isArray(content?.comments) ? content.comments.length : 0,
    dashboardSheets: sheets.filter((sheet) => /dashboard|control room|tablero/i.test(String(sheet?.name ?? ''))).length,
    printLayout: !!content?.printLayout,
  };

  if (!metrics.sheets) {
    const level = levelFor(0, metrics);
    return { score: 0, level, label: labelFor(level), metrics, badges: ['Blank'], warnings: warningsFor(metrics) };
  }

  const score = Math.min(100, 30
    + (metrics.formulas ? 15 : 0)
    + (metrics.charts ? 12 : 0)
    + (metrics.pivots ? 20 : 0)
    + (metrics.connectors ? 12 : 0)
    + (metrics.tables ? 8 : 0)
    + (metrics.validations ? 7 : 0)
    + (metrics.protectedRanges ? 7 : 0)
    + (metrics.namedRanges ? 5 : 0)
    + (metrics.printLayout ? 5 : 0)
    + (metrics.comments ? 3 : 0)
    + (metrics.dashboardSheets ? 4 : 0));
  const level = levelFor(score, metrics);
  return {
    score,
    level,
    label: labelFor(level),
    metrics,
    badges: badgesFor(metrics),
    warnings: warningsFor(metrics),
  };
}

export function summarizeSheetTemplateBuild(template: SheetTemplateBuildSource): SheetTemplateReadinessSummary {
  try {
    const content = template.build();
    if (hasPromiseShape(content)) {
      return {
        score: 0,
        level: 'starter',
        label: 'Starter',
        metrics: { ...EMPTY_METRICS },
        badges: ['Review'],
        warnings: ['Template build is async; readiness is evaluated after opening.'],
      };
    }
    return analyzeSheetTemplateReadiness(content);
  } catch (error) {
    return {
      score: 0,
      level: 'starter',
      label: 'Starter',
      metrics: { ...EMPTY_METRICS },
      badges: ['Error'],
      warnings: [error instanceof Error ? error.message : `Template ${template.id} could not be analyzed.`],
    };
  }
}
