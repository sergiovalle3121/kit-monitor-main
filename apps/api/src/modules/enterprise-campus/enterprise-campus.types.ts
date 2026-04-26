export type RiskLevel = 'ok' | 'at_risk' | 'critical' | 'blocked';
export type BuildingStatus = 'active' | 'maintenance' | 'idle' | 'offline';
export type WarehouseType =
  | 'central'
  | 'building'
  | 'subwarehouse'
  | 'pou'
  | 'quarantine'
  | 'transit';
export type ProgramStatus =
  | 'active'
  | 'npi'
  | 'ramping'
  | 'end_of_life'
  | 'on_hold';
export type Shift = 'A' | 'B' | 'C' | 'weekend';

export interface ProductionAreaNode {
  id: string;
  buildingId: string;
  code: string;
  name: string;
  type: string;
  status: string;
}

export interface ProductionLineNode {
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

export interface ProductionStationNode {
  id: string;
  lineId: string;
  code: string;
  position: number;
  status: string;
}

export interface CampusStateResponse {
  campus: { id: string; code: string; name: string };
  buildings: BuildingNode[];
  warehouses: WarehouseNode[];
  customers: CustomerNode[];
  programs: ProgramNode[];
  areas: ProductionAreaNode[];
  lines: ProductionLineNode[];
  stations: ProductionStationNode[];
  kpis: CampusKpi[];
  exceptions: CampusException[];
  domainHealth: DomainHealth[];
  lastUpdated: string;
  currentShift: Shift;
}

export interface BuildingNode {
  id: string;
  campusId: string;
  code: string;
  name: string;
  status: BuildingStatus;
  activeLines: number;
  totalLines: number;
  activeWOs: number;
  shortages: number;
  completionPct: number;
  currentShift: Shift;
  risk: RiskLevel;
}

export interface WarehouseNode {
  id: string;
  campusId: string;
  buildingId?: string;
  code: string;
  name: string;
  type: WarehouseType;
  utilizationPct: number;
  locationCount: number;
  activeMovements: number;
  risk: RiskLevel;
  accuracy?: number;
}

export interface CustomerNode {
  id: string;
  code: string;
  name: string;
  industry?: string;
  activePrograms: number;
  risk: RiskLevel;
}

export interface ProgramNode {
  id: string;
  customerId: string;
  customerName: string;
  code: string;
  name: string;
  status: ProgramStatus;
  buildingIds: string[];
  activeWOs: number;
  completedWOs: number;
  risk: RiskLevel;
  dueDate?: string;
}

export interface CampusKpi {
  label: string;
  value: number | string;
  sub?: string;
  risk: RiskLevel;
  icon: string;
  unit?: string;
}

export interface CampusException {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  domain:
    | 'production'
    | 'materials'
    | 'quality'
    | 'planning'
    | 'shipping'
    | 'maintenance';
  buildingId?: string;
  programId?: string;
  message: string;
  time: string;
  route: string;
}

export interface DomainHealth {
  domain: string;
  icon: string;
  route: string;
  status: RiskLevel;
  metric: string;
  detail: string;
  trend?: 'up' | 'down' | 'stable';
}
