import {
  BomLink,
  DemandSeries,
  ForecastChart,
  ForecastQuality,
  ForecastRecord,
  HistogramBucket,
  MethodResult,
  MethodSummary,
  ModelType,
  OperationCapacityRow,
  OperationalDecision,
  OperationalRow,
  RiskHorizon,
  RiskLevel,
  RiskScenario,
  SectionStateTone,
  StockSource,
  TrendLabel,
  WipOrder,
} from './forecast.models';

export class ForecastAnalytics {
  static buildForecastRecord(series: DemandSeries, minHistoryPeriods: number, sesAlpha: number, horizon: number): ForecastRecord {
    const actuals = series.values.map((value) => this.round(value));
    const statistics = this.seriesStatistics(actuals);
    const diagnostics = this.buildDiagnostics(series, statistics);
    const methods = ['naive', 'ma3', 'ma6', 'ses', 'regression'].flatMap((model) => {
      const result = this.evaluateMethod(model as ModelType, actuals, horizon, sesAlpha);
      return result ? [result] : [];
    }).sort((left, right) => ((left.mape ?? 9999) - (right.mape ?? 9999)) || ((left.mad ?? 9999) - (right.mad ?? 9999)) || (Math.abs(left.bias ?? 9999) - Math.abs(right.bias ?? 9999)));
    const bestMethod = methods[0] ?? null;
    const sufficientHistory = series.observationCount >= minHistoryPeriods;
    const quality = this.qualityLabel(series.observationCount, statistics.cv, statistics.outlierCount, series.missingPeriods);
    const statusTone = this.statusTone(sufficientHistory, quality, series.stock.source);
    return {
      key: series.key,
      material: series.material,
      displayLabel: series.displayLabel,
      location: series.location,
      description: series.description,
      type: series.type,
      periods: series.periods,
      actuals,
      observationCount: series.observationCount,
      sufficientHistory,
      statusTone,
      statusMessage: sufficientHistory ? `${series.observationCount} periodos utiles; ${quality.toLowerCase()} calidad historica.` : 'No hay suficiente historial para pronostico estadistico confiable.',
      quality,
      statistics,
      diagnostics,
      stock: series.stock,
      methods: Object.fromEntries(methods.map((item) => [item.model, item])),
      rankedMethods: methods,
      bestMethod: bestMethod?.model ?? null,
      bestMethodLabel: bestMethod?.label ?? 'Sin metodo dominante',
      recommendedMethod: bestMethod
        ? `Material ${series.material}: mejor metodo = ${bestMethod.label}. Forecast siguiente periodo = ${bestMethod.forecastNext} unidades. Error historico ${bestMethod.mape ?? '-'}% MAPE y ${bestMethod.mad ?? '-'} MAD. ${diagnostics.join(' ')}`
        : `Material ${series.material}: sin metodo robusto por falta de historia. ${diagnostics.join(' ')}`,
      forecastNext: bestMethod?.forecastNext ?? actuals[actuals.length - 1] ?? null,
      trend: statistics.trend,
      error: bestMethod?.mape ?? null,
      mad: bestMethod?.mad ?? null,
      bias: bestMethod?.bias ?? null,
      confidenceBand: bestMethod ? { lower: bestMethod.lowerBound, upper: bestMethod.upperBound } : null,
      periodDays: series.periodDays,
      sourceSheets: series.sourceSheets,
    };
  }

  static buildMethodSummaries(records: ForecastRecord[]): MethodSummary[] {
    return (['naive', 'ma3', 'ma6', 'ses', 'regression'] as ModelType[]).map((model) => {
      const items = records.map((record) => record.methods[model]).filter((item): item is MethodResult => Boolean(item?.validationCount));
      if (!items.length) return { model, label: this.modelLabel(model), avgMape: 0, avgMad: 0, avgBias: 0, samples: 0, reliability: 0 };
      const avgMape = this.round(this.avg(items.map((item) => item.mape ?? 0)));
      const avgMad = this.round(this.avg(items.map((item) => item.mad ?? 0)));
      const avgBias = this.round(this.avg(items.map((item) => Math.abs(item.bias ?? 0))));
      const reliability = this.round(Math.max(0, 100 - Math.min(60, avgMape * 2) - Math.min(20, avgMad) - Math.min(20, avgBias)));
      return { model, label: this.modelLabel(model), avgMape, avgMad, avgBias, samples: items.length, reliability };
    }).sort((left, right) => (right.reliability - left.reliability) || (left.avgMape - right.avgMape));
  }

  static buildForecastChart(record: ForecastRecord | null, method: MethodResult | null, chartWidth: number, chartHeight: number, padding: number): ForecastChart | null {
    if (!record || !method) return null;
    const totalCount = record.actuals.length + method.future.length;
    const labels = [...record.periods, ...Array.from({ length: method.future.length }, (_, index) => `F+${index + 1}`)];
    const maxValue = Math.max(...record.actuals, ...method.fitted, ...method.future, 1);
    const buildX = (index: number) => totalCount <= 1 ? padding : padding + (((chartWidth - (padding * 2)) / (totalCount - 1)) * index);
    const buildY = (value: number) => chartHeight - padding - (((value / maxValue) || 0) * (chartHeight - (padding * 2)));
    const toPoints = (items: Array<{ index: number; value: number }>) => items.map((item) => `${buildX(item.index)},${buildY(item.value)}`).join(' ');
    const labelStep = Math.max(1, Math.ceil(labels.length / 6));
    const anchor = record.actuals[record.actuals.length - 1] ?? 0;
    return {
      actualPoints: toPoints(record.actuals.map((value, index) => ({ index, value }))),
      fittedPoints: toPoints(method.fitted.map((value, index) => ({ index, value }))),
      futurePoints: toPoints([{ index: record.actuals.length - 1, value: anchor }, ...method.future.map((value, index) => ({ index: record.actuals.length + index, value }))]),
      dividerX: buildX(Math.max(record.actuals.length - 1, 0)),
      labels: labels.map((text, index) => ({ x: buildX(index), text: index % labelStep === 0 || index === labels.length - 1 ? text : '' })).filter((item) => item.text),
    };
  }

  static buildRiskScenario(record: ForecastRecord | null, iterations: number, leadTimeDays: number, stockValue: number | null, stockSource: StockSource, stockNote: string | null): RiskScenario | null {
    if (!record) return null;
    const periodDays = Math.max(record.periodDays, 1);
    const dailySeries = record.actuals.map((value) => this.round(Math.max(value / periodDays, 0.0001), 4));
    const empiricalDaily = dailySeries.length ? dailySeries : [Math.max((record.forecastNext ?? record.statistics.mean) / periodDays, 0.01)];
    const maxDays = Math.max(30, Math.max(leadTimeDays, 1));
    const paths = Array.from({ length: iterations }, () => {
      let cumulative = 0;
      const path: number[] = [];
      for (let day = 0; day < maxDays; day++) {
        cumulative += empiricalDaily[Math.floor(Math.random() * empiricalDaily.length)] ?? empiricalDaily[0];
        path.push(this.round(cumulative));
      }
      return path;
    });
    const horizons = Array.from(new Set([7, 14, 30, Math.max(1, leadTimeDays)])).sort((left, right) => left - right);
    const distributions = new Map<number, number[]>();
    horizons.forEach((days) => distributions.set(days, paths.map((path) => this.round(path[Math.max(0, days - 1)] ?? path[path.length - 1] ?? 0)).sort((left, right) => left - right)));
    const leadDistribution = distributions.get(Math.max(1, leadTimeDays)) ?? [];
    const meanDaily = this.round(this.avg(empiricalDaily));
    const coverageDays = stockValue != null && meanDaily > 0 ? this.round(stockValue / meanDaily) : null;
    const stockoutProbability = stockValue == null || !leadDistribution.length ? null : this.round(leadDistribution.filter((value) => value > stockValue).length / leadDistribution.length, 4);
    const horizonsSummary: RiskHorizon[] = [7, 14, 30].map((days) => {
      const values = distributions.get(days) ?? [];
      const demandP50 = this.quantile(values, 0.5);
      return {
        days,
        coverageDays,
        demandP50,
        demandP80: this.quantile(values, 0.8),
        demandP95: this.quantile(values, 0.95),
        stockoutProbability: stockValue == null || !values.length ? null : this.round(values.filter((value) => value > stockValue).length / values.length, 4),
        projectedRemaining: stockValue == null ? null : this.round(stockValue - demandP50),
      };
    });
    const warnings: string[] = [];
    if (stockSource === 'manual') warnings.push('El riesgo usa stock manual.');
    if (stockSource === 'missing') warnings.push('No hay stock cargado; la simulacion solo muestra incertidumbre.');
    if (!record.sufficientHistory) warnings.push('Serie con historial corto; usa este resultado con cautela.');
    return {
      recordKey: record.key,
      displayLabel: record.displayLabel,
      iterations,
      stock: stockValue,
      stockSource,
      stockNote,
      leadTimeDays,
      dailyDemandMean: meanDaily,
      dailyDemandStd: this.round(this.std(empiricalDaily)),
      periodDays,
      histogram: this.histogram(leadDistribution, 16),
      p50: this.quantile(leadDistribution, 0.5),
      p80: this.quantile(leadDistribution, 0.8),
      p95: this.quantile(leadDistribution, 0.95),
      safetyStockSuggested: Math.max(0, Math.round(this.quantile(leadDistribution, 0.95) - this.round(this.avg(leadDistribution)))),
      realisticMin: this.quantile(leadDistribution, 0.1),
      realisticMax: this.quantile(leadDistribution, 0.9),
      stockoutProbability,
      estimatedStockoutDate: coverageDays == null ? null : this.addDays(coverageDays),
      horizons: horizonsSummary,
      sigma: this.round(this.std(empiricalDaily)),
      warnings,
      message: stockValue == null ? 'Se estimo la demanda con bootstrap empirico, pero falta stock para medir quiebre.' : `Riesgo al lead time: ${Math.round((stockoutProbability ?? 0) * 100)}% de probabilidad de stockout.`,
    };
  }

  static buildOperationalRows(capacityRows: OperationCapacityRow[], wipOrders: WipOrder[]): OperationalRow[] {
    const grouped = new Map<string, OperationalRow>();
    capacityRows.forEach((row) => {
      const key = this.materialKey(row.model);
      if (!key) return;
      grouped.set(key, {
        key,
        label: key,
        category: 'model',
        location: row.location ?? null,
        currentStock: row.currentStock ?? 0,
        backlog: row.backlog ?? 0,
        leadTime: row.leadTime ?? 5,
        criticality: row.criticality ?? 55,
        kitTimeMinutes: Math.max(1, row.kitTimeMinutes ?? 45),
        bomAvailable: this.clampPercent(row.bomAvailable ?? 70),
        clientPriority: this.clampPercent(row.clientPriority ?? 60),
        marginImpact: this.clampPercent(row.marginImpact ?? (row.clientPriority ?? 60)),
        workOrderCount: 0,
        activeWip: 0,
        estimatedFields: this.estimatedFields(row),
        sourceSheets: [row.sourceSheet],
      });
    });
    wipOrders.forEach((order) => {
      const key = this.materialKey(order.model);
      if (!key) return;
      const target = grouped.get(key) ?? {
        key,
        label: key,
        category: 'model' as const,
        location: null,
        currentStock: 0,
        backlog: 0,
        leadTime: Math.max(1, order.leadTime ?? 5),
        criticality: 55,
        kitTimeMinutes: 45,
        bomAvailable: 70,
        clientPriority: 60,
        marginImpact: 60,
        workOrderCount: 0,
        activeWip: 0,
        estimatedFields: ['stock', 'backlog', 'criticidad', 'tiempo por kit', 'BOM disponible', 'prioridad cliente'],
        sourceSheets: [],
      };
      target.workOrderCount += 1;
      target.activeWip = this.round(target.activeWip + (order.wip ?? 0));
      target.backlog = this.round(target.backlog + Math.max((order.planned ?? order.quantity ?? 0) - (order.wip ?? 0), 0));
      target.leadTime = Math.max(target.leadTime, order.leadTime ?? target.leadTime);
      if (!target.sourceSheets.includes(order.sourceSheet)) target.sourceSheets.push(order.sourceSheet);
      grouped.set(key, target);
    });
    return Array.from(grouped.values()).sort((left, right) => right.backlog - left.backlog);
  }

  static buildOperationalDecision(row: OperationalRow, forecasts: ForecastRecord[], dailyCapacityHours: number, dailyAvailableMinutes: number, maxBacklog: number, efficiencyPercent: number): OperationalDecision {
    const matchedMaterials = this.linkMaterials(row, forecasts).slice(0, 6);
    const matchingQuality = this.matchingQuality(matchedMaterials);
    const weightedForecast = matchedMaterials.length ? this.round(this.weightedAverage(matchedMaterials.map((item) => ({ value: item.forecastNext ?? 0, weight: Math.max(item.score, 1) })))) : 0;
    const expectedDemand = Math.max(row.backlog, weightedForecast, row.activeWip);
    const coverage = expectedDemand > 0 ? this.round(row.currentStock / expectedDemand) : null;
    const stockoutProbability = matchedMaterials.filter((item) => item.riskProbability != null).length
      ? this.round(this.weightedAverage(matchedMaterials.filter((item) => item.riskProbability != null).map((item) => ({ value: item.riskProbability as number, weight: Math.max(item.score, 1) }))), 4)
      : null;
    const backlogScore = this.round((row.backlog / Math.max(1, maxBacklog)) * 100);
    const kitsPossible = row.kitTimeMinutes > 0 ? Math.floor(dailyAvailableMinutes / row.kitTimeMinutes) : 0;
    const capacityCoverage = row.backlog > 0 ? Math.min(1, kitsPossible / row.backlog) : 1;
    const feasibility = this.round((row.bomAvailable * 0.45) + (capacityCoverage * 100 * 0.35) + (efficiencyPercent * 0.2));
    const heuristicRisk = this.heuristicRisk(coverage, row.bomAvailable, row.criticality, row.leadTime);
    const riskScore = stockoutProbability == null ? heuristicRisk : this.round((stockoutProbability * 100 * 0.7) + (heuristicRisk * 0.3));
    const score = this.round((backlogScore * 0.3) + (row.criticality * 0.25) + (riskScore * 0.2) + (row.marginImpact * 0.15) + (feasibility * 0.1));
    const riskLevel: RiskLevel = riskScore >= 67 || (coverage != null && coverage < 1) ? 'Alto' : riskScore >= 34 || (coverage != null && coverage < 1.5) ? 'Medio' : 'Bajo';
    const warnings: string[] = [];
    if (matchingQuality === 'Sin match' || matchingQuality === 'Debil') warnings.push('El matching material-modelo es debil; el riesgo usa heuristica, no BOM real.');
    if (row.estimatedFields.length) warnings.push(`Hay supuestos estimados en: ${row.estimatedFields.join(', ')}.`);
    return {
      key: row.key,
      label: row.label,
      location: row.location,
      currentStock: row.currentStock,
      backlog: row.backlog,
      leadTime: row.leadTime,
      criticality: row.criticality,
      kitTimeMinutes: row.kitTimeMinutes,
      bomAvailable: row.bomAvailable,
      clientPriority: row.clientPriority,
      marginImpact: row.marginImpact,
      expectedDemand,
      coverage,
      riskLevel,
      riskScore,
      stockoutProbability,
      feasibility,
      dailyCapacityHours,
      dailyAvailableMinutes,
      kitsPossible,
      score,
      reasons: [`Backlog ${row.backlog} unidades`, `Criticidad ${Math.round(row.criticality)}/100`, `Factibilidad ${Math.round(feasibility)}%`],
      warnings,
      recommendedAction: this.operationalAction(riskLevel, matchingQuality, feasibility, row.bomAvailable, kitsPossible, row.backlog),
      matchingQuality,
      matchedMaterials,
      forecastReference: matchedMaterials[0]?.material ?? null,
    };
  }

  static estimateMaterialStockoutProbability(record: ForecastRecord, days: number): number | null {
    if (record.stock.value == null) return null;
    return this.buildRiskScenario(record, 1200, Math.max(1, days), record.stock.value, record.stock.source, record.stock.note)?.stockoutProbability ?? null;
  }

  static modelLabel(model: ModelType): string {
    return model === 'naive' ? 'Naive' : model === 'ma3' ? 'Moving average 3' : model === 'ma6' ? 'Moving average 6' : model === 'ses' ? 'Suavizacion exponencial' : 'Regresion lineal';
  }

  private static evaluateMethod(model: ModelType, actuals: number[], horizon: number, sesAlpha: number): MethodResult | null {
    if (!actuals.length) return null;
    const validationCount = actuals.length >= 8 ? 3 : actuals.length >= 5 ? 2 : actuals.length >= 3 ? 1 : 0;
    const errors: number[] = [];
    if (validationCount > 0) {
      const start = actuals.length - validationCount;
      for (let index = start; index < actuals.length; index++) {
        const train = actuals.slice(0, index);
        if (!train.length) continue;
        errors.push(this.round(this.forecastValue(model, train, sesAlpha) - actuals[index]));
      }
    }
    const fitted = this.fittedSeries(model, actuals, sesAlpha);
    const future = this.futureSeries(model, actuals, horizon, sesAlpha);
    const errorStd = Math.max(this.std(errors), this.avg(errors.map((error) => Math.abs(error))) || 0, actuals.length > 1 ? this.std(actuals) * 0.15 : 1, 1);
    return {
      model,
      label: this.modelLabel(model),
      fitted,
      future,
      forecastNext: this.round(future[0] ?? actuals[actuals.length - 1] ?? 0),
      mape: errors.length ? this.round(this.avg(errors.map((error, idx) => {
        const actual = actuals[actuals.length - errors.length + idx];
        return actual === 0 ? 0 : Math.abs(error) / Math.abs(actual);
      })) * 100) : null,
      mad: errors.length ? this.round(this.avg(errors.map((error) => Math.abs(error)))) : null,
      bias: errors.length ? this.round(this.avg(errors)) : null,
      validationCount,
      lowerBound: this.round(Math.max(0, (future[0] ?? 0) - (1.28 * errorStd))),
      upperBound: this.round(Math.max(future[0] ?? 0, (future[0] ?? 0) + (1.28 * errorStd))),
    };
  }

  private static fittedSeries(model: ModelType, values: number[], sesAlpha: number): number[] {
    if (model === 'naive') return values.map((value, index) => this.round(index === 0 ? value : values[index - 1]));
    if (model === 'ma3') return values.map((_, index) => this.round(this.avg(values.slice(Math.max(0, index - 3), index) || [values[0]])));
    if (model === 'ma6') return values.map((_, index) => this.round(this.avg(values.slice(Math.max(0, index - 6), index) || [values[0]])));
    if (model === 'ses') {
      const fitted: number[] = [values[0] ?? 0];
      for (let index = 1; index < values.length; index++) fitted.push(this.round((sesAlpha * values[index - 1]) + ((1 - sesAlpha) * fitted[index - 1])));
      return fitted;
    }
    const slope = this.slope(values);
    const intercept = this.intercept(values, slope);
    return values.map((_, index) => this.round(intercept + (slope * (index + 1))));
  }

  private static futureSeries(model: ModelType, values: number[], horizon: number, sesAlpha: number): number[] {
    if (!values.length) return Array.from({ length: horizon }, () => 0);
    if (model === 'naive') return Array.from({ length: horizon }, () => this.round(values[values.length - 1]));
    if (model === 'ma3') return Array.from({ length: horizon }, () => this.round(this.avg(values.slice(-Math.min(3, values.length)))));
    if (model === 'ma6') return Array.from({ length: horizon }, () => this.round(this.avg(values.slice(-Math.min(6, values.length)))));
    if (model === 'ses') {
      const fitted = this.fittedSeries(model, values, sesAlpha);
      const last = this.round((sesAlpha * values[values.length - 1]) + ((1 - sesAlpha) * fitted[fitted.length - 1]));
      return Array.from({ length: horizon }, () => last);
    }
    const slope = this.slope(values);
    const intercept = this.intercept(values, slope);
    return Array.from({ length: horizon }, (_, index) => this.round(intercept + (slope * (values.length + index + 1))));
  }

  private static forecastValue(model: ModelType, values: number[], sesAlpha: number): number {
    return this.futureSeries(model, values, 1, sesAlpha)[0] ?? values[values.length - 1] ?? 0;
  }

  private static linkMaterials(row: OperationalRow, forecasts: ForecastRecord[]): BomLink[] {
    const modelText = this.normalize(row.label);
    const modelTokens = this.tokens(modelText);
    return forecasts.map((record) => {
      const materialText = this.normalize(record.material);
      const materialTokens = this.tokens(materialText);
      let score = 0;
      const reasons: string[] = [];
      const tokenScore = this.tokenSimilarity(modelTokens, materialTokens);
      if (tokenScore > 0) { score += Math.round(tokenScore * 40); reasons.push(`tokens ${Math.round(tokenScore * 100)}%`); }
      const suffixScore = this.suffixSimilarity(row.label, record.material);
      if (suffixScore > 0) { score += Math.round(suffixScore * 25); reasons.push('prefijo/sufijo compatible'); }
      if (row.location && record.location && this.normalize(row.location) === this.normalize(record.location)) { score += 25; reasons.push('misma localidad'); }
      if (record.description && modelTokens.some((token) => token.length >= 3 && this.normalize(record.description ?? '').includes(token))) { score += 8; reasons.push('catalogo sugiere cercania'); }
      return {
        model: row.label,
        material: record.material,
        location: record.location,
        score: Math.min(100, score),
        source: 'heuristic',
        reason: reasons.join(', ') || 'sin señal fuerte',
        forecastNext: record.forecastNext,
        riskProbability: this.estimateMaterialStockoutProbability(record, Math.max(7, row.leadTime)),
      } satisfies BomLink;
    }).filter((link) => link.score >= 18).sort((left, right) => right.score - left.score);
  }

  private static matchingQuality(links: BomLink[]): OperationalDecision['matchingQuality'] {
    if (!links.length) return 'Sin match';
    const average = this.avg(links.slice(0, 3).map((link) => link.score));
    if (average >= 70) return 'Fuerte';
    if (average >= 50) return 'Media';
    return 'Debil';
  }

  private static operationalAction(riskLevel: RiskLevel, matchingQuality: OperationalDecision['matchingQuality'], feasibility: number, bomAvailable: number, kitsPossible: number, backlog: number): string {
    if (matchingQuality === 'Sin match') return 'Falta relacion BOM/material-modelo; prioriza completar el mapping antes de prometer corrida.';
    if (riskLevel === 'Alto' && bomAvailable < 70) return 'Escalar faltantes y cerrar disponibilidad BOM antes de liberar a produccion.';
    if (riskLevel === 'Alto' && feasibility >= 70) return 'Liberar con seguimiento diario y proteccion de materiales criticos.';
    if (feasibility >= 75 && kitsPossible >= Math.max(1, backlog)) return 'Tiene capacidad suficiente para entrar en la siguiente ventana operativa.';
    return 'Programar con control cercano y revisar capacidad, matching y BOM antes de comprometer la corrida.';
  }

  private static seriesStatistics(values: number[]): ForecastRecord['statistics'] {
    const mean = this.round(this.avg(values));
    const stdDev = this.round(this.std(values));
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 0);
    const cv = mean > 0 ? this.round(stdDev / mean, 4) : 0;
    const slope = this.slope(values);
    return { mean, stdDev, min, max, cv, outlierCount: this.outlierCount(values), trend: this.trend(slope, values), slope: this.round(slope, 4) };
  }

  private static buildDiagnostics(series: DemandSeries, statistics: ForecastRecord['statistics']): string[] {
    const diagnostics: string[] = [];
    if (series.observationCount < 4) diagnostics.push('Historial insuficiente.');
    else if (series.observationCount < 6) diagnostics.push('Historial corto pero utilizable con cautela.');
    if (statistics.cv <= 0.15) diagnostics.push('Serie estable.');
    if (statistics.cv >= 0.35) diagnostics.push('Serie volatil.');
    if (statistics.trend === 'Creciente') diagnostics.push('Tendencia creciente.');
    if (statistics.trend === 'Decreciente') diagnostics.push('Tendencia decreciente.');
    if (statistics.outlierCount > 0) diagnostics.push(`${statistics.outlierCount} outlier(s) simples detectados.`);
    if (series.missingPeriods > 0) diagnostics.push(`${series.missingPeriods} periodo(s) faltante(s) completado(s) como 0.`);
    if (series.stock.source === 'missing') diagnostics.push('Sin stock cargado para Riesgo.');
    return diagnostics.length ? diagnostics : ['Serie sin alertas relevantes.'];
  }

  private static qualityLabel(observationCount: number, cv: number, outlierCount: number, missingPeriods: number): ForecastQuality {
    if (observationCount < 4) return 'Insuficiente';
    if (observationCount >= 8 && cv <= 0.3 && outlierCount <= 1 && missingPeriods <= 1) return 'Alta';
    if (observationCount >= 6 && cv <= 0.45 && outlierCount <= 2) return 'Media';
    return 'Baja';
  }

  private static statusTone(sufficientHistory: boolean, quality: ForecastQuality, stockSource: StockSource): SectionStateTone {
    if (!sufficientHistory) return 'insufficient';
    if (quality === 'Baja') return 'warning';
    if (stockSource === 'missing') return 'partial';
    return 'ready';
  }

  private static heuristicRisk(coverage: number | null, bomAvailable: number, criticality: number, leadTime: number): number {
    const coveragePenalty = coverage == null ? 45 : coverage >= 2 ? 10 : coverage >= 1 ? 35 : 70;
    return this.round(Math.min(100, coveragePenalty + ((100 - bomAvailable) * 0.35) + (criticality * 0.2) + Math.min(leadTime * 6, 25)));
  }

  private static tokenSimilarity(left: string[], right: string[]): number {
    const union = new Set([...left, ...right]);
    if (!union.size) return 0;
    const overlap = [...union].filter((token) => left.includes(token) && right.includes(token)).length;
    return overlap / union.size;
  }

  private static suffixSimilarity(left: string, right: string): number {
    const cleanLeft = left.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cleanRight = right.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!cleanLeft || !cleanRight) return 0;
    if (cleanLeft.slice(-4) === cleanRight.slice(-4)) return 1;
    if (cleanLeft.slice(-3) === cleanRight.slice(-3)) return 0.7;
    if (cleanLeft.slice(0, 5) === cleanRight.slice(0, 5)) return 0.5;
    return 0;
  }

  private static estimatedFields(row: OperationCapacityRow): string[] {
    const fields: string[] = [];
    if (row.currentStock == null) fields.push('stock');
    if (row.backlog == null) fields.push('backlog');
    if (row.leadTime == null) fields.push('lead time');
    if (row.criticality == null) fields.push('criticidad');
    if (row.kitTimeMinutes == null) fields.push('tiempo por kit');
    if (row.bomAvailable == null) fields.push('BOM disponible');
    if (row.clientPriority == null) fields.push('prioridad cliente');
    if (row.marginImpact == null) fields.push('margen impacto');
    return fields;
  }

  private static histogram(samples: number[], bucketCount: number): HistogramBucket[] {
    if (!samples.length) return [];
    const sorted = [...samples].sort((left, right) => left - right);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const size = Math.max((max - min) / bucketCount, 1);
    const counts = Array.from({ length: bucketCount }, () => 0);
    sorted.forEach((value) => {
      const index = Math.max(0, Math.min(bucketCount - 1, Math.floor((value - min) / size)));
      counts[index]++;
    });
    const maxCount = Math.max(...counts, 1);
    return counts.map((count, index) => ({ label: `${Math.round(min + (size * index))}-${Math.round(min + (size * (index + 1)))}`, count, ratio: count / maxCount }));
  }

  private static quantile(sorted: number[], probability: number): number {
    if (!sorted.length) return 0;
    const index = (sorted.length - 1) * probability;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return this.round(sorted[lower]);
    return this.round(sorted[lower] + ((sorted[upper] - sorted[lower]) * (index - lower)));
  }

  private static addDays(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + Math.max(0, Math.round(days)));
    return date.toISOString().slice(0, 10);
  }

  private static avg(values: number[]): number {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  private static weightedAverage(items: Array<{ value: number; weight: number }>): number {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    return totalWeight ? items.reduce((sum, item) => sum + (item.value * item.weight), 0) / totalWeight : 0;
  }

  private static std(values: number[]): number {
    if (values.length <= 1) return 0;
    const mean = this.avg(values);
    return Math.sqrt(values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / Math.max(values.length - 1, 1));
  }

  private static slope(values: number[]): number {
    if (values.length <= 1) return 0;
    let sumX = 0; let sumY = 0; let sumXY = 0; let sumX2 = 0;
    values.forEach((value, index) => {
      const x = index + 1;
      sumX += x; sumY += value; sumXY += x * value; sumX2 += x * x;
    });
    const divisor = (values.length * sumX2) - (sumX * sumX);
    return divisor === 0 ? 0 : ((values.length * sumXY) - (sumX * sumY)) / divisor;
  }

  private static intercept(values: number[], slope: number): number {
    const sumY = values.reduce((sum, value) => sum + value, 0);
    const sumX = ((values.length + 1) * values.length) / 2;
    return (sumY - (slope * sumX)) / values.length;
  }

  private static trend(slope: number, actuals: number[]): TrendLabel {
    const baseline = Math.max(this.avg(actuals), 1);
    const ratio = slope / baseline;
    return ratio >= 0.05 ? 'Creciente' : ratio <= -0.05 ? 'Decreciente' : 'Estable';
  }

  private static outlierCount(values: number[]): number {
    if (values.length < 4) return 0;
    const mean = this.avg(values);
    const std = this.std(values);
    return std === 0 ? 0 : values.filter((value) => Math.abs((value - mean) / std) > 2.5).length;
  }

  private static normalize(value: string): string {
    return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  private static tokens(value: string): string[] {
    return value.split(' ').filter(Boolean);
  }

  private static materialKey(value: string): string {
    return value.trim().toUpperCase();
  }

  private static clampPercent(value: number): number {
    return this.round(Math.max(0, Math.min(100, value)));
  }

  private static round(value: number, decimals = 2): number {
    const factor = 10 ** decimals;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }
}
