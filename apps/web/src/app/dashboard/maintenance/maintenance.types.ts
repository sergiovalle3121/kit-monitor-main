// ─────────────────────────────────────────────────────────────────────────────
// Maintenance / TPM (CMMS) types — mirror the real backend entities & DTOs (zero
// mock). Source of truth: apps/api/src/modules/maintenance. Kept in sync by hand
// because `packages/contracts` is not established yet (see AGENTS.md §3).
// ─────────────────────────────────────────────────────────────────────────────

// Asset — apps/api/src/modules/maintenance/entities/asset.entity.ts
export type AssetCriticality = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AssetStatus = "RUNNING" | "DOWN" | "IDLE" | "RETIRED";

export interface Asset {
  id: string;
  code: string | null;
  name: string;
  category: string | null;
  location: string | null;
  criticality: AssetCriticality;
  status: AssetStatus;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  created_at?: string;
  created_by?: string | null;
}

// Maintenance order — apps/api/src/modules/maintenance/entities/maintenance-order.entity.ts
export type MaintenanceType = "PREVENTIVE" | "CORRECTIVE" | "PREDICTIVE";
export type MaintenancePriority = "LOW" | "MEDIUM" | "HIGH";

// State machine — apps/api/src/modules/maintenance/order-state.ts
export type MaintenanceOrderStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface MaintenanceOrder {
  id: string;
  folio: string | null;
  title: string;
  description: string | null;
  type: MaintenanceType;
  priority: MaintenancePriority;
  status: MaintenanceOrderStatus;
  assetId: string | null;
  assetName: string | null;
  assignedTo: string | null;
  downtimeMinutes: number;
  dueDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  created_at?: string;
  created_by?: string | null;
}

// KPIs — MaintenanceKpis in apps/api/src/modules/maintenance/maintenance.service.ts
export interface MaintenanceKpis {
  ordersOpen: number;
  ordersInProgress: number;
  ordersOverdue: number;
  ordersCompleted: number;
  /** % de órdenes preventivas completadas, o null si no hay preventivas. */
  pmCompliance: number | null;
  /** Mean Time To Repair en horas, o null si no hay órdenes completadas. */
  mttrHours: number | null;
  totalDowntimeMinutes: number;
  assetsTotal: number;
  assetsDown: number;
  /** Planes de PM activos. */
  pmPlansActive: number;
  /** Planes de PM vencidos (next_due_date pasada). */
  pmOverdue: number;
  /** Planes de PM por vencer dentro de la ventana. */
  pmDueSoon: number;
}

// Preventive-maintenance plan — apps/api/.../entities/pm-plan.entity.ts
export type PmFrequencyType = "DAYS" | "WEEKS" | "MONTHS";

export interface PmPlan {
  id: string;
  assetId: string | null;
  assetName: string | null;
  title: string;
  description: string | null;
  frequencyType: PmFrequencyType;
  frequencyValue: number;
  lastDoneDate: string | null;
  nextDueDate: string | null;
  active: boolean;
  assignedTo: string | null;
  created_at?: string;
  created_by?: string | null;
}

// CreatePmPlanDto
export interface CreatePmPlanInput {
  title: string;
  description?: string;
  assetId?: string;
  frequencyType: PmFrequencyType;
  frequencyValue: number;
  lastDoneDate?: string;
  nextDueDate?: string;
  assignedTo?: string;
}

// UpdatePmPlanDto
export interface UpdatePmPlanInput {
  title?: string;
  description?: string;
  frequencyType?: PmFrequencyType;
  frequencyValue?: number;
  lastDoneDate?: string;
  nextDueDate?: string;
  assignedTo?: string;
  active?: boolean;
}

// AssetReliability + AssetDetail — apps/api/.../reliability.ts + maintenance.service.ts
export interface AssetReliability {
  failures: number;
  mttrHours: number | null;
  mtbfHours: number | null;
  totalDowntimeMinutes: number;
  lastFailureAt: string | null;
  openOrders: number;
}

export interface AssetDetail {
  asset: Asset;
  orders: MaintenanceOrder[];
  reliability: AssetReliability;
}

// ── Payloads (DTOs) ──────────────────────────────────────────────────────────
// CreateAssetDto
export interface CreateAssetInput {
  name: string;
  code?: string;
  category?: string;
  location?: string;
  criticality?: AssetCriticality;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
}

// UpdateAssetDto — OJO: el PATCH del backend SÓLO acepta estos campos
// (code/manufacturer/model/serialNumber se fijan al dar de alta).
export interface UpdateAssetInput {
  name?: string;
  category?: string;
  location?: string;
  criticality?: AssetCriticality;
  status?: AssetStatus;
}

// CreateMaintenanceOrderDto
export interface CreateOrderInput {
  title: string;
  description?: string;
  type?: MaintenanceType;
  priority?: MaintenancePriority;
  assetId?: string;
  assignedTo?: string;
  dueDate?: string;
}

// UpdateMaintenanceOrderDto
export interface UpdateOrderInput {
  title?: string;
  description?: string;
  type?: MaintenanceType;
  priority?: MaintenancePriority;
  assignedTo?: string;
  dueDate?: string;
}

// TransitionMaintenanceOrderDto
export interface TransitionInput {
  status: MaintenanceOrderStatus;
  downtimeMinutes?: number;
}
