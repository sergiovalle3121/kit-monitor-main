import * as XLSX from 'xlsx';
import {
  DemandSeries,
  ForecastChart,
  ForecastRecord,
  MethodResult,
  MethodSummary,
  OperationalDecision,
  OperationalRow,
  RiskScenario,
  StockSource,
  WorkbookParseResult,
} from './forecast.models';
import { ForecastWorkbookParser } from './forecast.parser';
import { ForecastAnalytics } from './forecast.analytics';

export class ForecastEngine {
  static analyzeWorkbook(workbook: XLSX.WorkBook, fileName: string): WorkbookParseResult {
    return ForecastWorkbookParser.analyzeWorkbook(workbook, fileName);
  }

  static buildDemandSeries(...args: Parameters<typeof ForecastWorkbookParser.buildDemandSeries>): DemandSeries[] {
    return ForecastWorkbookParser.buildDemandSeries(...args);
  }

  static buildForecastRecord(...args: Parameters<typeof ForecastAnalytics.buildForecastRecord>): ForecastRecord {
    return ForecastAnalytics.buildForecastRecord(...args);
  }

  static buildMethodSummaries(records: ForecastRecord[]): MethodSummary[] {
    return ForecastAnalytics.buildMethodSummaries(records);
  }

  static buildForecastChart(record: ForecastRecord | null, method: MethodResult | null, chartWidth: number, chartHeight: number, padding: number): ForecastChart | null {
    return ForecastAnalytics.buildForecastChart(record, method, chartWidth, chartHeight, padding);
  }

  static buildRiskScenario(record: ForecastRecord | null, iterations: number, leadTimeDays: number, stockValue: number | null, stockSource: StockSource, stockNote: string | null): RiskScenario | null {
    return ForecastAnalytics.buildRiskScenario(record, iterations, leadTimeDays, stockValue, stockSource, stockNote);
  }

  static buildOperationalRows(...args: Parameters<typeof ForecastAnalytics.buildOperationalRows>): OperationalRow[] {
    return ForecastAnalytics.buildOperationalRows(...args);
  }

  static buildOperationalDecision(...args: Parameters<typeof ForecastAnalytics.buildOperationalDecision>): OperationalDecision {
    return ForecastAnalytics.buildOperationalDecision(...args);
  }

  static estimateMaterialStockoutProbability(record: ForecastRecord, days: number): number | null {
    return ForecastAnalytics.estimateMaterialStockoutProbability(record, days);
  }

  static modelLabel(model: Parameters<typeof ForecastAnalytics.modelLabel>[0]): string {
    return ForecastAnalytics.modelLabel(model);
  }
}
