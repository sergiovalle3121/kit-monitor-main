import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { ApiService } from '../../core/api.service';
import { ForecastEngine } from './forecast.engine';
import {
  AppView,
  CatalogRow,
  DemandPoint,
  DemandSeries,
  ForecastChart,
  ForecastRecord,
  MethodResult,
  MethodSummary,
  ModelType,
  OperationCapacityRow,
  OperationalDecision,
  OperationalRow,
  RiskScenario,
  SectionStateTone,
  SheetRole,
  StockPoint,
  StockSource,
  WipOrder,
  WorkbookSheetInfo,
} from './forecast.models';

interface SectionStateView {
  tone: SectionStateTone;
  title: string;
  message: string;
  warnings: string[];
}

@Component({
  selector: 'app-forecast',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './forecast.component.html',
  styleUrls: ['./forecast.component.css'],
})
export class ForecastComponent {
  readonly minHistoryPeriods = 4;
  readonly simulationIterations = 10000;
  readonly chartWidth = 720;
  readonly chartHeight = 260;
  readonly chartPadding = 24;

  readonly modelCards = [
    { key: 'naive' as ModelType, title: 'Naive', useCase: 'Benchmark simple para validar si vale la pena un modelo mas sofisticado.' },
    { key: 'ma3' as ModelType, title: 'Moving average 3', useCase: 'Respuesta rapida cuando la historia es corta pero bastante estable.' },
    { key: 'ma6' as ModelType, title: 'Moving average 6', useCase: 'Suaviza mejor el ruido cuando la serie es madura.' },
    { key: 'ses' as ModelType, title: 'Suavizacion exponencial', useCase: 'Buena base ERP para reaccionar a lo reciente sin sobreajustar.' },
    { key: 'regression' as ModelType, title: 'Regresion lineal', useCase: 'Captura direccion cuando la demanda ya trae tendencia.' },
  ];

  activeView: AppView = 'forecast';
  model: ModelType = 'ses';

  fileName = '';
  sheetName = '';
  demandFormatLabel = '';
  parseError: string | null = null;
  dragOver = false;

  operationFileName = '';
  operationSheetName = '';
  operationParseError: string | null = null;
  operationDragOver = false;

  demandPoints: DemandPoint[] = [];
  stockPoints: StockPoint[] = [];
  catalogRows: CatalogRow[] = [];
  capacityRows: OperationCapacityRow[] = [];
  wipOrders: WipOrder[] = [];
  demandSeries: DemandSeries[] = [];
  operationRows: OperationalRow[] = [];

  demandSheetInfos: WorkbookSheetInfo[] = [];
  operationSheetInfos: WorkbookSheetInfo[] = [];
  demandWarnings: string[] = [];
  operationWarnings: string[] = [];

  forecastResults: ForecastRecord[] = [];
  methodSummaries: MethodSummary[] = [];
  forecastStatusMessage: string | null = null;
  selectedForecastKey: string | null = null;
  resultFilter = '';
  criticalityFilter: 'all' | 'alta' | 'media' | 'baja' | 'insuficiente' = 'all';
  methodFilter: 'all' | ModelType = 'all';
  sesAlpha = 0.35;
  horizon = 3;

  riskLeadTimeDays = 14;
  riskManualStock: number | null = null;
  selectedRiskScenario: RiskScenario | null = null;
  riskStatusMessage: string | null = null;

  operationDecisions: OperationalDecision[] = [];
  operationStatusMessage: string | null = null;
  selectedOperationKey: string | null = null;
  operatorsAvailable = 6;
  hoursPerShift = 8;
  shiftsPerDay = 2;
  efficiencyPercent = 85;
  latestRunId: number | null = null;
  latestScenarioId: number | null = null;
  
  // Math Lab Stats
  planConfidenceScore: number | null = null;
  planProbability: number | null = null;
  sigmaStability = signal<number>(0);
  materialProjections: any[] = [];
  bottleneckResource = signal<string>('Capacidad de Línea');
  favorabilityIndex = signal<number>(0);
  
  logisticsPriorityTop: Array<{ partNumber: string; severity: string; priorityScore: number; recommendation: string }> = [];
  simulationMode: string | null = null;
  dataSufficiencyScore: number | null = null;
  confidenceBand: { low: number; high: number } | null = null;
  calibrationSummary: any = null;
  controlTower: any = null;
  lastPublicationId: number | null = null;

  constructor(private readonly api: ApiService) {}

  setView(view: AppView): void {
    this.activeView = view;
    if (view === 'risk' && !this.selectedRiskScenario && this.selectedForecastRecord) this.runRiskSimulation(false);
    if (view === 'operation' && !this.operationDecisions.length && this.operationRows.length) this.runOperationalPlanning(false);
  }

  setModel(model: ModelType): void {
    this.model = model;
  }

  onDemandDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.ingestWorkbook(file, 'demand');
  }

  onDemandSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.ingestWorkbook(file, 'demand');
  }

  onOperationDrop(event: DragEvent): void {
    event.preventDefault();
    this.operationDragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.ingestWorkbook(file, 'operation');
  }

  onOperationSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.ingestWorkbook(file, 'operation');
  }

  clearDemandFile(): void {
    this.fileName = '';
    this.sheetName = '';
    this.demandFormatLabel = '';
    this.parseError = null;
    this.forecastStatusMessage = null;
    this.riskStatusMessage = null;
    this.demandPoints = [];
    this.stockPoints = [];
    this.catalogRows = [];
    this.demandSeries = [];
    this.demandSheetInfos = [];
    this.demandWarnings = [];
    this.forecastResults = [];
    this.methodSummaries = [];
    this.selectedForecastKey = null;
    this.selectedRiskScenario = null;
    this.riskManualStock = null;
    this.resultFilter = '';
    if (this.operationRows.length) this.runOperationalPlanning(false);
  }

  clearOperationFile(): void {
    this.operationFileName = '';
    this.operationSheetName = '';
    this.operationParseError = null;
    this.operationStatusMessage = null;
    this.capacityRows = [];
    this.wipOrders = [];
    this.operationRows = [];
    this.operationDecisions = [];
    this.selectedOperationKey = null;
    this.operationSheetInfos = [];
    this.operationWarnings = [];
  }

  runForecastAnalysis(setView = false): void {
    if (!this.demandSeries.length) {
      this.forecastStatusMessage = 'Carga un workbook con demanda horizontal o vertical para activar el laboratorio.';
      if (setView) this.activeView = 'forecast';
      return;
    }
    this.sesAlpha = this.clamp(this.sesAlpha, 0.01, 0.99);
    this.horizon = this.clampInt(this.horizon, 1, 12);
    this.forecastResults = this.demandSeries
      .map((series) => ForecastEngine.buildForecastRecord(series, this.minHistoryPeriods, this.sesAlpha, this.horizon))
      .sort((left, right) => ((right.sufficientHistory ? 1 : 0) - (left.sufficientHistory ? 1 : 0)) || ((right.forecastNext ?? 0) - (left.forecastNext ?? 0)));
    this.methodSummaries = ForecastEngine.buildMethodSummaries(this.forecastResults);
    const previousKey = this.selectedForecastKey;
    this.selectedForecastKey = this.forecastResults.some((record) => record.key === previousKey)
      ? previousKey
      : this.forecastResults[0]?.key ?? null;
    this.selectedRiskScenario = null;
    this.riskStatusMessage = null;
    const readyCount = this.forecastResults.filter((record) => record.sufficientHistory).length;
    this.forecastStatusMessage = readyCount
      ? `${readyCount} series listas para forecast. Metodo con mejor confiabilidad global: ${this.bestMethodSummary?.label ?? 'Sin dominante'}.`
      : 'Se cargaron datos, pero ninguna serie tiene historia suficiente para un forecast confiable.';
    this.calculateSigmaStability();
    if (setView) this.activeView = 'forecast';
  }

  private calculateSigmaStability(): void {
    if (!this.forecastResults.length) return;
    const avgCv = this.forecastResults.reduce((acc, r) => acc + (r.statistics.cv || 0), 0) / this.forecastResults.length;
    this.sigmaStability.set(100 - (avgCv * 50)); // Simple heuristic for stability
  }

  runRiskSimulation(setView = true): void {
    const record = this.selectedForecastRecord;
    if (!record) {
      this.selectedRiskScenario = null;
      this.riskStatusMessage = 'Selecciona o carga una serie de demanda para simular riesgo.';
      if (setView) this.activeView = 'risk';
      return;
    }
    this.riskLeadTimeDays = this.clampInt(this.riskLeadTimeDays, 1, 90);
    const stockSource: StockSource = this.riskManualStock != null ? 'manual' : record.stock.source;
    const stockValue = this.riskManualStock != null ? this.riskManualStock : record.stock.value;
    const stockNote = this.riskManualStock != null ? 'Stock manual capturado en UI.' : record.stock.note;
    this.selectedRiskScenario = ForecastEngine.buildRiskScenario(record, this.simulationIterations, this.riskLeadTimeDays, stockValue, stockSource, stockNote);
    this.riskStatusMessage = this.selectedRiskScenario?.message ?? 'No fue posible correr la simulacion.';
    if (setView) this.activeView = 'risk';
  }

  runOperationalPlanning(setView = true): void {
    if (!this.operationRows.length) {
      this.operationStatusMessage = 'Carga una hoja de capacidad o WIP para calcular prioridad operativa.';
      if (setView) this.activeView = 'operation';
      return;
    }
    this.operatorsAvailable = this.clampInt(this.operatorsAvailable, 1, 999);
    this.hoursPerShift = this.clamp(this.hoursPerShift, 1, 24);
    this.shiftsPerDay = this.clampInt(this.shiftsPerDay, 1, 4);
    this.efficiencyPercent = this.clamp(this.efficiencyPercent, 1, 100);
    const dailyCapacityHours = this.round(this.operatorsAvailable * this.hoursPerShift * this.shiftsPerDay * (this.efficiencyPercent / 100));
    const dailyAvailableMinutes = this.round(dailyCapacityHours * 60);
    const maxBacklog = Math.max(...this.operationRows.map((row) => row.backlog), 1);
    this.operationDecisions = this.operationRows
      .map((row) => ForecastEngine.buildOperationalDecision(row, this.forecastResults, dailyCapacityHours, dailyAvailableMinutes, maxBacklog, this.efficiencyPercent))
      .sort((left, right) => right.score - left.score);
    this.selectedOperationKey = this.selectedOperationDecision?.key ?? this.operationDecisions[0]?.key ?? null;
    this.operationStatusMessage = this.operationDecisions.length
      ? 'Operacion enlazo backlog, capacidad y forecast maestro por material con matching heuristico.'
      : 'No se encontraron filas operativas utiles.';
    this.calculateFavorability();
    if (setView) this.activeView = 'operation';
  }

  private calculateFavorability(): void {
    if (!this.operationDecisions.length) return;
    const top = this.operationDecisions[0];
    this.favorabilityIndex.set(top.score);
    
    // Bottleneck logic
    if (this.efficiencyPercent < 80) this.bottleneckResource.set('Eficiencia Operativa');
    else if (top.riskLevel === 'Alto') this.bottleneckResource.set('Suministro de Materiales');
    else this.bottleneckResource.set('Capacidad de Planta');
  }

  publishLatestPlan(): void {
    if (!this.latestRunId && !this.latestScenarioId) return;
    this.api.publishPlan({
      title: `Plan ${new Date().toISOString().slice(0, 16)}`,
      runId: this.latestRunId ?? undefined,
      scenarioId: this.latestScenarioId ?? undefined,
      publishedBy: 'planner-ui',
    }).subscribe({
      next: () => {
        this.operationStatusMessage = 'Plan publicado con trazabilidad de forecast y escenario.';
        this.api.getPlanPublications().subscribe({
          next: (publications) => {
            this.lastPublicationId = publications?.[0]?.id ?? null;
            if (this.lastPublicationId) {
              this.api.registerPlanOutcome(this.lastPublicationId, {
                actualQty: Math.round((this.planProbability ?? 0.6) * (this.forecastResults.reduce((acc, row) => acc + (row.forecastNext ?? 0), 0))),
                shortageEvents: this.logisticsPriorityTop.length ? 1 : 0,
                overtimeHours: this.planProbability && this.planProbability < 0.65 ? 3 : 1,
              }).subscribe(() => this.loadControlTower());
            }
          },
        });
      },
      error: () => {
        this.operationStatusMessage = 'No se pudo publicar el plan.';
      },
    });
  }

  selectForecast(recordKey: string): void {
    this.selectedForecastKey = recordKey;
    this.syncRiskInputs();
    if (this.activeView === 'risk') this.runRiskSimulation(false);
  }

  selectOperational(decisionKey: string): void {
    this.selectedOperationKey = decisionKey;
  }

  get previewDemandRows(): DemandSeries[] {
    return this.demandSeries.slice(0, 8);
  }

  private persistForecastRun(): void {
    if (!this.forecastResults.length) return;
    const payload = {
      name: `Run ${new Date().toISOString().slice(0, 16)}`,
      sourceFile: this.fileName || undefined,
      assumptions: {
        horizon: this.horizon,
        sesAlpha: this.sesAlpha,
      },
      series: this.forecastResults.map((record) => ({
        material: record.material,
        location: record.location ?? undefined,
        championMethod: record.bestMethod ?? 'naive',
        mape: record.error ?? 0,
        mad: record.mad ?? 0,
        bias: record.bias ?? 0,
        forecastNext: record.forecastNext ?? 0,
        forecastHorizon: (record.rankedMethods[0]?.future ?? []).slice(0, this.horizon),
        diagnostics: { quality: record.quality, trend: record.trend, warnings: record.diagnostics },
        confidenceScore: record.quality === 'Alta' ? 90 : record.quality === 'Media' ? 75 : record.quality === 'Baja' ? 60 : 40,
      })),
    };

    this.api.createForecastRun(payload).subscribe({
      next: (run) => {
        this.latestRunId = run?.id ?? null;
      },
      error: () => {
        this.latestRunId = null;
      },
    });
  }

  private persistPlanScenario(): void {
    if (!this.latestRunId || !this.operationRows.length || !this.forecastResults.length) return;
    const plannedDemandUnits = this.forecastResults.reduce((acc, row) => acc + (row.forecastNext ?? 0), 0);
    const dailyCapacityUnits = Math.max(1, this.round(this.operatorsAvailable * this.hoursPerShift * this.shiftsPerDay * (this.efficiencyPercent / 100)));

    this.api.createPlanScenario({
      runId: this.latestRunId,
      name: `Scenario ${new Date().toISOString().slice(0, 16)}`,
      assumptions: {
        horizonDays: this.horizon * 7,
        dailyCapacityUnits,
        efficiencyPercent: this.efficiencyPercent,
        plannedDemandUnits,
        leadTimeDays: this.riskLeadTimeDays,
        scrapRate: 0.03,
      },
      constraints: {
        operatorsAvailable: this.operatorsAvailable,
        shiftsPerDay: this.shiftsPerDay,
      },
    }).subscribe({
      next: (scenario) => {
        this.latestScenarioId = scenario?.id ?? null;
        this.planConfidenceScore = scenario?.viabilityScore ?? null;
        this.planProbability = scenario?.estimatedProbability ?? null;
        this.logisticsPriorityTop = (scenario?.logisticRisk?.items ?? []).slice(0, 5);
        if (this.latestScenarioId) this.runScenarioSimulation(this.latestScenarioId);
      },
      error: () => {
        this.latestScenarioId = null;
      },
    });
  }

  private runScenarioSimulation(scenarioId: number): void {
    this.api.runPlanScenarioSimulation(scenarioId, { numRuns: 500 }).subscribe({
      next: (payload) => {
        const result = payload?.result;
        this.planProbability = result?.probabilityOfPlanSuccess ?? this.planProbability;
        this.planConfidenceScore = payload?.calibratedScore ?? this.planConfidenceScore;
        this.simulationMode = result?.simulationMode ?? null;
        this.dataSufficiencyScore = result?.dataSufficiencyScore ?? null;
        this.confidenceBand = payload?.confidenceBand ?? null;
        this.loadCalibrationSummary();
      },
    });
  }

  private loadCalibrationSummary(): void {
    this.api.getCalibrationSummary().subscribe({
      next: (summary) => { this.calibrationSummary = summary; },
      error: () => { this.calibrationSummary = null; },
    });
  }

  private loadControlTower(): void {
    if (!this.lastPublicationId) return;
    this.api.getPlanControlTower(this.lastPublicationId).subscribe({
      next: (value) => { this.controlTower = value; },
      error: () => { this.controlTower = null; },
    });
  }

  get previewDemandPeriods(): string[] {
    return this.previewDemandRows[0]?.periods.slice(-Math.min(4, this.previewDemandRows[0].periods.length)) ?? [];
  }

  get maxObservedPeriods(): number {
    return Math.max(...this.demandSeries.map((row) => row.observationCount), 0);
  }

  get filteredForecastResults(): ForecastRecord[] {
    const term = this.resultFilter.trim().toUpperCase();
    return this.forecastResults.filter((record) => {
      const matchesTerm = !term
        || record.displayLabel.toUpperCase().includes(term)
        || record.material.toUpperCase().includes(term)
        || (record.location ?? '').toUpperCase().includes(term)
        || (record.description ?? '').toUpperCase().includes(term);

      const qualityKey = record.quality.toLowerCase() as 'alta' | 'media' | 'baja' | 'insuficiente';
      const matchesCriticality = this.criticalityFilter === 'all' || this.criticalityFilter === qualityKey;
      const matchesMethod = this.methodFilter === 'all' || record.bestMethod === this.methodFilter;
      return matchesTerm && matchesCriticality && matchesMethod;
    });
  }

  get bestMethodSummary(): MethodSummary | null {
    return this.methodSummaries[0] ?? null;
  }

  get topMaterialRiskLabel(): string {
    const top = this.logisticsPriorityTop[0];
    if (!top) return 'Sin riesgo crítico';
    return `${top.partNumber} · ${top.severity}`;
  }

  get readyForecastCount(): number {
    return this.forecastResults.filter((record) => record.sufficientHistory).length;
  }

  get workbookStockCount(): number {
    return this.stockPoints.length;
  }

  get selectedForecastRecord(): ForecastRecord | null {
    return this.forecastResults.find((record) => record.key === this.selectedForecastKey) ?? this.forecastResults[0] ?? null;
  }

  get selectedChartMethod(): MethodResult | null {
    const record = this.selectedForecastRecord;
    if (!record) return null;
    return record.methods[this.model] ?? record.rankedMethods[0] ?? null;
  }

  get selectedForecastChart(): ForecastChart | null {
    return ForecastEngine.buildForecastChart(this.selectedForecastRecord, this.selectedChartMethod, this.chartWidth, this.chartHeight, this.chartPadding);
  }

  get selectedOperationDecision(): OperationalDecision | null {
    return this.operationDecisions.find((decision) => decision.key === this.selectedOperationKey) ?? this.operationDecisions[0] ?? null;
  }

  get topOperationalDecisions(): OperationalDecision[] {
    return this.operationDecisions.slice(0, 3);
  }

  get forecastState(): SectionStateView {
    if (!this.demandSeries.length) return { tone: 'empty', title: 'Esperando demanda', message: 'Sube un workbook con hojas de demanda horizontal o vertical.', warnings: [] };
    if (!this.forecastResults.length) return { tone: 'partial', title: 'Datos cargados', message: 'La demanda ya se detecto, falta correr el analisis estadistico.', warnings: this.demandWarnings.slice(0, 3) };
    const ready = this.forecastResults.filter((record) => record.sufficientHistory).length;
    if (!ready) return { tone: 'insufficient', title: 'Historia insuficiente', message: 'Hay datos, pero ninguna serie alcanza el minimo para forecast serio.', warnings: this.demandWarnings.slice(0, 3) };
    return { tone: ready === this.forecastResults.length ? 'ready' : 'warning', title: `${ready} series listas`, message: this.forecastStatusMessage ?? 'Forecast maestro por material activo.', warnings: this.demandWarnings.slice(0, 3) };
  }

  get riskState(): SectionStateView {
    if (!this.selectedForecastRecord) return { tone: 'empty', title: 'Sin serie base', message: 'Primero carga y calcula forecast por material para simular riesgo.', warnings: [] };
    if (!this.selectedRiskScenario) return { tone: 'partial', title: 'Listo para simular', message: 'Ya puedes correr Monte Carlo empirico con stock workbook o manual.', warnings: this.selectedForecastRecord.stock.source === 'missing' ? ['No hay stock workbook; captura uno manual para medir quiebre.'] : [] };
    return { tone: this.selectedRiskScenario.stockSource === 'manual' ? 'warning' : 'ready', title: 'Riesgo calculado', message: this.selectedRiskScenario.message, warnings: this.selectedRiskScenario.warnings };
  }

  get operationState(): SectionStateView {
    if (!this.operationRows.length) return { tone: 'empty', title: 'Esperando operacion', message: 'Sube hojas de capacidad o WIP para activar el modulo operativo.', warnings: [] };
    if (!this.operationDecisions.length) return { tone: 'partial', title: 'Datos operativos cargados', message: 'Falta correr la priorizacion operativa.', warnings: this.operationWarnings.slice(0, 3) };
    const weak = this.operationDecisions.filter((decision) => decision.matchingQuality === 'Debil' || decision.matchingQuality === 'Sin match').length;
    return { tone: weak ? 'warning' : 'ready', title: `${this.operationDecisions.length} decisiones`, message: this.operationStatusMessage ?? 'Prioridad operativa lista.', warnings: this.operationWarnings.slice(0, 3) };
  }

  get recommendationText(): string {
    if (!this.operationDecisions.length) return 'Carga datos operativos para que el sistema recomiende que modelo conviene liberar primero.';
    const [one, two, three] = this.operationDecisions;
    const oneRisk = one.stockoutProbability == null ? `${one.riskLevel.toLowerCase()} riesgo operativo` : `${Math.round(one.stockoutProbability * 100)}% de riesgo de quiebre`;
    const second = two ? ` ${two.label} queda como segunda prioridad con ${Math.round(two.feasibility)}% de factibilidad.` : '';
    const third = three ? ` ${three.label} entra como tercera opcion por backlog y capacidad balanceada.` : '';
    return `${one.label} es la mejor opcion para produccion inmediata. Tiene ${Math.round(one.feasibility)}% de factibilidad, ${oneRisk}, matching ${one.matchingQuality.toLowerCase()} y backlog de ${one.backlog} unidades.${second}${third}`;
  }

  sectionToneClass(tone: SectionStateTone): string {
    return `tone-${tone}`;
  }

  sheetRoleLabel(role: SheetRole): string {
    switch (role) {
      case 'demand-horizontal': return 'Demanda horizontal';
      case 'demand-vertical': return 'Demanda vertical';
      case 'stock': return 'Stock SAP';
      case 'wip': return 'WIP';
      case 'capacity': return 'Capacidad';
      case 'catalog': return 'Catalogo';
      default: return 'Desconocida';
    }
  }

  forecastStatusClass(record: ForecastRecord): string {
    return this.sectionToneClass(record.statusTone);
  }

  recommendationClass(decision: OperationalDecision): string {
    return decision.score >= 75 ? 'priority-top' : decision.score >= 55 ? 'priority-mid' : 'priority-low';
  }

  percentLabel(value: number | null): string {
    return value == null ? '-' : `${Math.round(value * 100)}%`;
  }

  previewDemandValues(row: DemandSeries): number[] {
    return row.values.slice(-this.previewDemandPeriods.length);
  }

  riskGaugeBackground(decision: OperationalDecision | null): string {
    if (!decision) return 'conic-gradient(#cbd5e1 0 100%)';
    const score = Math.max(0, Math.min(100, decision.riskScore));
    const color = score >= 67 ? '#dc2626' : score >= 34 ? '#d97706' : '#16a34a';
    return `conic-gradient(${color} 0 ${score}%, rgba(226,232,240,0.88) ${score}% 100%)`;
  }

  private ingestWorkbook(file: File, purpose: 'demand' | 'operation'): void {
    if (purpose === 'demand') {
      this.parseError = null;
      this.forecastStatusMessage = null;
    } else {
      this.operationParseError = null;
      this.operationStatusMessage = null;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(new Uint8Array(event.target?.result as ArrayBuffer), { type: 'array' });
        const analysis = ForecastEngine.analyzeWorkbook(workbook, file.name);
        this.applyWorkbookAnalysis(analysis, purpose);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo leer el workbook.';
        if (purpose === 'demand') this.parseError = message;
        else this.operationParseError = message;
      }
    };
    reader.readAsArrayBuffer(file);
  }

  private applyWorkbookAnalysis(analysis: ReturnType<typeof ForecastEngine.analyzeWorkbook>, purpose: 'demand' | 'operation'): void {
    const hasDemandPayload = analysis.demandPoints.length || analysis.stockPoints.length || analysis.catalogRows.length;
    const hasOperationPayload = analysis.capacityRows.length || analysis.wipOrders.length;

    if (hasDemandPayload) {
      if (analysis.demandPoints.length) this.demandPoints = analysis.demandPoints;
      if (analysis.stockPoints.length) this.stockPoints = analysis.stockPoints;
      if (analysis.catalogRows.length) this.catalogRows = analysis.catalogRows;
      this.fileName = analysis.fileName;
      this.sheetName = analysis.primaryDemandSheet ?? analysis.primaryStockSheet ?? analysis.sheets[0]?.sheetName ?? '';
      this.demandFormatLabel = this.describeDemandSheets(analysis.sheets);
      this.demandSheetInfos = analysis.sheets;
      this.demandWarnings = analysis.warnings;
      this.demandSeries = ForecastEngine.buildDemandSeries(this.demandPoints, this.stockPoints, this.catalogRows);
      this.runForecastAnalysis(false);
    }

    if (hasOperationPayload) {
      this.capacityRows = analysis.capacityRows;
      this.wipOrders = analysis.wipOrders;
      this.operationRows = ForecastEngine.buildOperationalRows(this.capacityRows, this.wipOrders);
      this.operationFileName = analysis.fileName;
      this.operationSheetName = analysis.primaryOperationSheet ?? analysis.sheets[0]?.sheetName ?? '';
      this.operationSheetInfos = analysis.sheets;
      this.operationWarnings = analysis.warnings;
      this.runOperationalPlanning(false);
    }

    if (!hasDemandPayload && purpose === 'demand') {
      this.parseError = 'El workbook no contiene demanda, stock o catalogo util para Pronostico.';
    }
    if (!hasOperationPayload && purpose === 'operation') {
      this.operationParseError = 'El workbook no contiene hojas de capacidad o WIP utilizables.';
    }
    this.activeView = purpose === 'demand' ? 'forecast' : 'operation';
  }

  private describeDemandSheets(sheets: WorkbookSheetInfo[]): string {
    const roles = sheets.filter((sheet) => sheet.role === 'demand-horizontal' || sheet.role === 'demand-vertical').map((sheet) => this.sheetRoleLabel(sheet.role));
    if (!roles.length) return 'Sin hoja de demanda';
    return Array.from(new Set(roles)).join(' + ');
  }

  private syncRiskInputs(): void {
    if (this.selectedForecastRecord?.stock.source !== 'missing') this.riskManualStock = null;
  }

  private clamp(value: number, min: number, max: number): number {
    const parsed = Number.isFinite(value) ? value : min;
    return this.round(Math.min(max, Math.max(min, parsed)));
  }

  private clampInt(value: number, min: number, max: number): number {
    const parsed = Number.isFinite(value) ? Math.round(value) : min;
    return Math.min(max, Math.max(min, parsed));
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
