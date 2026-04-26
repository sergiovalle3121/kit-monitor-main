/**
 * AXOS OS — Guadalajara Enterprise Data Model
 * Core entity interfaces for the full manufacturing campus.
 * These are NOT hardcoded constants — they are flexible type definitions
 * that support N buildings, N warehouses, N programs, N lines.
 *
 * Phase 1: Used by Control Tower for UI state modeling.
 * Phase 2+: Will map to real backend API responses.
 */

export type RiskLevel = 'ok' | 'at_risk' | 'critical' | 'blocked';
export type BuildingStatus = 'active' | 'maintenance' | 'idle' | 'offline';
export type WarehouseType = 'central' | 'building' | 'subwarehouse' | 'pou' | 'quarantine' | 'transit';
export type ProgramStatus = 'active' | 'npi' | 'ramping' | 'end_of_life' | 'on_hold';
export type WorkOrderStatus = 'planned' | 'released' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
export type MaterialMovementType = 'receive' | 'transfer' | 'issue' | 'return' | 'adjust' | 'scrap' | 'count';
export type ExceptionDomain = 'production' | 'materials' | 'quality' | 'planning' | 'shipping' | 'maintenance';
export type ExceptionSeverity = 'critical' | 'high' | 'medium' | 'low';
export type LineStatus = 'active' | 'idle' | 'maintenance' | 'exception' | 'setup';
export type Shift = 'A' | 'B' | 'C' | 'weekend';

/** Top-level campus entity */
export interface Campus {
  id: string;
  code: string;                       // e.g. 'JBL-GDL'
  name: string;                       // e.g. 'Jabil Guadalajara'
  timezone: string;                   // e.g. 'America/Monterrey'
  buildings: Building[];
  warehouseNodes: Warehouse[];
  activePrograms: number;
  activeCustomers: number;
}

/** Building / Site entity */
export interface Building {
  id: string;
  campusId: string;
  code: string;                       // e.g. 'BLDG-A', 'BLDG-B', 'BLDG-C'
  name: string;                       // Human-readable name
  status: BuildingStatus;
  activeLines: number;
  totalLines: number;
  activeWOs: number;
  shortages: number;
  completionPct: number;
  currentShift: Shift;
  risk: RiskLevel;
  // Phase 2: area count, local warehouse ids, sqm, etc.
}

/** Warehouse / Storage Node entity */
export interface Warehouse {
  id: string;
  campusId: string;
  buildingId?: string;                // null for central warehouses
  code: string;                       // operational code, NOT hardcoded
  name: string;
  type: WarehouseType;
  utilizationPct: number;             // 0–100
  locationCount: number;              // total bins/racks
  activeMovements: number;
  risk: RiskLevel;
  accuracy?: number;                  // last cycle count accuracy %
}

/** Customer entity */
export interface Customer {
  id: string;
  code: string;
  name: string;
  industry?: string;
  activePrograms: number;
  risk: RiskLevel;
}

/** Program / Project entity */
export interface ProgramSummary {
  id: string;
  customerId: string;
  customerName: string;
  code: string;
  name: string;
  status: ProgramStatus;
  buildingIds: string[];              // which buildings run this program
  activeWOs: number;
  completedWOs: number;
  risk: RiskLevel;
  dueDate?: string;
}

/** Work Order summary for Control Tower aggregation */
export interface WorkOrderSummary {
  id: string;
  programId: string;
  model: string;
  partNumber: string;
  lineId: string;
  buildingId: string;
  quantity: number;
  completed: number;
  status: WorkOrderStatus;
  risk: RiskLevel;
  dueDate?: string;
}


export interface ProductionArea {
  id: string;
  buildingId: string;
  code: string;
  name: string;
  type: string;
  status: string;
}

export interface ProductionLine {
  id: string;
  buildingId: string;
  areaId: string;
  code: string;
  name: string;
  status: string;
  activeShift?: string;
  capacityPerShift?: number;
  stationCount: number;
  activePlanCount: number;
}

export interface ProductionStation {
  id: string;
  lineId: string;
  code: string;
  position: number;
  status: string;
}

/** Campus-wide exception */
export interface EnterpriseException {
  id: string;
  severity: ExceptionSeverity;
  domain: ExceptionDomain;
  buildingId?: string;
  programId?: string;
  message: string;
  time: string;
  route: string;
  resolvedAt?: string;
}

/** Domain operational health for the health matrix */
export interface DomainHealth {
  domain: string;
  icon: string;
  route: string;
  status: RiskLevel;
  metric: string;
  detail: string;
  trend?: 'up' | 'down' | 'stable';
}

/** Campus-level KPI for the command strip */
export interface CampusKpi {
  label: string;
  value: string | number;
  sub?: string;
  risk: RiskLevel;
  icon: string;
  unit?: string;
}

/** Material network health node */
export interface MaterialFlowNode {
  nodeId: string;
  label: string;
  type: WarehouseType | 'line' | 'supplier' | 'customer';
  status: RiskLevel;
  pendingMovements: number;
  shortages: number;
}

/**
 * CampusState: the full derived state for the Control Tower campus view.
 * Built from real API data in Phase 1, backed by real campus APIs in Phase 2+.
 */
export interface CampusState {
  campus: Pick<Campus, 'id' | 'code' | 'name'>;
  buildings: Building[];
  warehouses: Warehouse[];
  customers: Customer[];
  programs: ProgramSummary[];
  areas?: ProductionArea[];
  lines?: ProductionLine[];
  stations?: ProductionStation[];
  kpis: CampusKpi[];
  exceptions: EnterpriseException[];
  domainHealth: DomainHealth[];
  lastUpdated: string;
  currentShift: Shift;
}
