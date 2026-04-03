export type AppView = 'forecast' | 'risk' | 'operation';
export type SectionStateTone = 'empty' | 'partial' | 'ready' | 'warning' | 'insufficient';
export type SheetRole =
  | 'demand-horizontal'
  | 'demand-vertical'
  | 'stock'
  | 'wip'
  | 'capacity'
  | 'catalog'
  | 'unknown';
export type ModelType = 'naive' | 'ma3' | 'ma6' | 'ses' | 'regression';
export type TrendLabel = 'Creciente' | 'Estable' | 'Decreciente';
export type RiskLevel = 'Bajo' | 'Medio' | 'Alto';
export type StockSource = 'workbook' | 'manual' | 'estimated' | 'missing';
export type MatchingSource = 'heuristic' | 'manual' | 'catalog';
export type ForecastQuality = 'Alta' | 'Media' | 'Baja' | 'Insuficiente';

export interface WorkbookSheetInfo {
  sheetName: string;
  role: SheetRole;
  confidence: number;
  headerRowIndex: number | null;
  rowCount: number;
  headers: string[];
  notes: string[];
}

export interface DemandPoint {
  material: string;
  location: string | null;
  period: string;
  demand: number;
  sourceSheet: string;
}

export interface StockPoint {
  material: string;
  location: string | null;
  unrestricted: number;
  inTransfer: number;
  blocked: number;
  qualityHold: number;
  sourceSheet: string;
}

export interface CatalogRow {
  material: string;
  description: string | null;
  location: string | null;
  type: string | null;
  sourceSheet: string;
}

export interface WipOrder {
  model: string;
  workOrder: string | null;
  planned: number | null;
  wip: number | null;
  leadTime: number | null;
  quantity: number | null;
  process: string | null;
  status: string | null;
  startTime: string | null;
  sourceSheet: string;
}

export interface OperationCapacityRow {
  model: string;
  location: string | null;
  currentStock: number | null;
  backlog: number | null;
  leadTime: number | null;
  criticality: number | null;
  kitTimeMinutes: number | null;
  bomAvailable: number | null;
  clientPriority: number | null;
  marginImpact: number | null;
  sourceSheet: string;
}

export interface WorkbookParseResult {
  fileName: string;
  sheets: WorkbookSheetInfo[];
  demandPoints: DemandPoint[];
  stockPoints: StockPoint[];
  catalogRows: CatalogRow[];
  wipOrders: WipOrder[];
  capacityRows: OperationCapacityRow[];
  warnings: string[];
  primaryDemandSheet: string | null;
  primaryStockSheet: string | null;
  primaryOperationSheet: string | null;
}

export interface StockSnapshot {
  value: number | null;
  location: string | null;
  source: StockSource;
  note: string | null;
}

export interface DemandSeries {
  key: string;
  material: string;
  displayLabel: string;
  location: string | null;
  periods: string[];
  values: number[];
  points: DemandPoint[];
  observationCount: number;
  missingPeriods: number;
  sourceFormat: 'vertical' | 'horizontal' | 'mixed';
  sourceSheets: string[];
  stock: StockSnapshot;
  description: string | null;
  type: string | null;
  periodDays: number;
}

export interface MethodResult {
  model: ModelType;
  label: string;
  fitted: number[];
  future: number[];
  forecastNext: number;
  mape: number | null;
  mad: number | null;
  bias: number | null;
  validationCount: number;
  lowerBound: number;
  upperBound: number;
}

export interface MethodSummary {
  model: ModelType;
  label: string;
  avgMape: number;
  avgMad: number;
  avgBias: number;
  samples: number;
  reliability: number;
}

export interface SeriesStatistics {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  cv: number;
  outlierCount: number;
  trend: TrendLabel;
  slope: number;
}

export interface ForecastRecord {
  key: string;
  material: string;
  displayLabel: string;
  location: string | null;
  description: string | null;
  type: string | null;
  periods: string[];
  actuals: number[];
  observationCount: number;
  sufficientHistory: boolean;
  statusTone: SectionStateTone;
  statusMessage: string;
  quality: ForecastQuality;
  statistics: SeriesStatistics;
  diagnostics: string[];
  stock: StockSnapshot;
  methods: Partial<Record<ModelType, MethodResult>>;
  rankedMethods: MethodResult[];
  bestMethod: ModelType | null;
  bestMethodLabel: string;
  recommendedMethod: string;
  forecastNext: number | null;
  trend: TrendLabel;
  error: number | null;
  mad: number | null;
  bias: number | null;
  confidenceBand: { lower: number; upper: number } | null;
  periodDays: number;
  sourceSheets: string[];
}

export interface ForecastChart {
  actualPoints: string;
  fittedPoints: string;
  futurePoints: string;
  dividerX: number;
  labels: Array<{ x: number; text: string }>;
}

export interface HistogramBucket {
  label: string;
  count: number;
  ratio: number;
}

export interface RiskHorizon {
  days: number;
  coverageDays: number | null;
  demandP50: number;
  demandP80: number;
  demandP95: number;
  stockoutProbability: number | null;
  projectedRemaining: number | null;
}

export interface RiskScenario {
  recordKey: string;
  displayLabel: string;
  iterations: number;
  stock: number | null;
  stockSource: StockSource;
  stockNote: string | null;
  leadTimeDays: number;
  dailyDemandMean: number;
  dailyDemandStd: number;
  periodDays: number;
  histogram: HistogramBucket[];
  p50: number;
  p80: number;
  p95: number;
  safetyStockSuggested: number;
  realisticMin: number;
  realisticMax: number;
  stockoutProbability: number | null;
  estimatedStockoutDate: string | null;
  horizons: RiskHorizon[];
  warnings: string[];
  message: string;
}

export interface BomLink {
  model: string;
  material: string;
  location: string | null;
  score: number;
  source: MatchingSource;
  reason: string;
  forecastNext: number | null;
  riskProbability: number | null;
}

export interface OperationalRow {
  key: string;
  label: string;
  category: 'model';
  location: string | null;
  currentStock: number;
  backlog: number;
  leadTime: number;
  criticality: number;
  kitTimeMinutes: number;
  bomAvailable: number;
  clientPriority: number;
  marginImpact: number;
  workOrderCount: number;
  activeWip: number;
  estimatedFields: string[];
  sourceSheets: string[];
}

export interface OperationalDecision {
  key: string;
  label: string;
  location: string | null;
  currentStock: number;
  backlog: number;
  leadTime: number;
  criticality: number;
  kitTimeMinutes: number;
  bomAvailable: number;
  clientPriority: number;
  marginImpact: number;
  expectedDemand: number;
  coverage: number | null;
  riskLevel: RiskLevel;
  riskScore: number;
  stockoutProbability: number | null;
  feasibility: number;
  dailyCapacityHours: number;
  dailyAvailableMinutes: number;
  kitsPossible: number;
  score: number;
  reasons: string[];
  warnings: string[];
  recommendedAction: string;
  matchingQuality: 'Fuerte' | 'Media' | 'Debil' | 'Sin match';
  matchedMaterials: BomLink[];
  forecastReference: string | null;
}
