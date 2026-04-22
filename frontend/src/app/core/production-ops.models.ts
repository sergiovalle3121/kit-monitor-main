export type ProductionRuntimeStatus =
  | 'programmed'
  | 'kit_preparing'
  | 'kit_ready'
  | 'received_line'
  | 'assembling'
  | 'completed';

export interface ProductionLineRuntime {
  lineKey: string;
  line: number;
  kitId: number;
  model: string;
  workOrder?: string;
  shift?: string;
  targetQty: number;
  completedQty: number;
  status: ProductionRuntimeStatus;
  hasIncident: boolean;
  visualAidId?: string;
  startedAt?: string;
  receivedAt?: string;
  completedAt?: string;
}

export interface ProductionBayEvent {
  id: string;
  lineKey: string;
  kitId: number;
  model: string;
  bayId: number;
  quantity: number;
  timestamp: string;
  notes?: string;
  operator?: string;
}

export interface BayMaterialState {
  lineKey: string;
  model: string;
  bayId: number;
  partNumber: string;
  description?: string;
  usagePerAssembly: number;
  assignedQty: number;
  availableQty: number;
  consumedQty: number;
  lowStockThreshold: number;
}

export interface ProductionRuntimeSnapshot {
  backend: ProductionLineRuntime;
  bayMaterials: BayMaterialState[];
  events: ProductionBayEvent[];
}

export interface HourlyProductionPoint {
  lineKey: string;
  model: string;
  hourBucket: string;
  units: number;
  events: number;
}

export interface CompletedKitSummary {
  lineKey: string;
  model: string;
  completedQty: number;
  targetQty: number;
  startedAt?: string;
  completedAt?: string;
  totalEvents: number;
  lowStockHits: number;
}
