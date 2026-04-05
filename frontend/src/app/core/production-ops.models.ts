export type ProductionRuntimeStatus =
  | 'programmed'
  | 'kit_preparing'
  | 'kit_ready'
  | 'received_line'
  | 'assembling'
  | 'completed';

export interface ProductionBackendRuntime {
  backendKey: string;
  backen: number;
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
  backendKey: string;
  kitId: number;
  model: string;
  bayId: number;
  quantity: number;
  timestamp: string;
  notes?: string;
  operator?: string;
}

export interface BayMaterialState {
  backendKey: string;
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
  backend: ProductionBackendRuntime;
  bayMaterials: BayMaterialState[];
  events: ProductionBayEvent[];
}

export interface HourlyProductionPoint {
  backendKey: string;
  model: string;
  hourBucket: string;
  units: number;
  events: number;
}

export interface CompletedKitSummary {
  backendKey: string;
  model: string;
  completedQty: number;
  targetQty: number;
  startedAt?: string;
  completedAt?: string;
  totalEvents: number;
  lowStockHits: number;
}
