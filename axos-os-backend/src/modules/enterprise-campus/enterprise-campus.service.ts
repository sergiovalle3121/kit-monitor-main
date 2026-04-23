import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Kit } from '../kits/entities/kit.entity';
import { Plan } from '../plans/entities/plan.entity';
import { CancellationRequest } from '../cancellation-requests/entities/cancellation-request.entity';
import { ProductionBayIncident } from '../production-runtime/entities/production-bay-incident.entity';
import {
  BuildingNode,
  CampusException,
  CampusKpi,
  CampusStateResponse,
  CustomerNode,
  DomainHealth,
  ProgramNode,
  RiskLevel,
  Shift,
  WarehouseNode,
} from './enterprise-campus.types';

interface BuildingCatalog {
  id: string;
  code: string;
  name: string;
  lines: number[];
}

const CAMPUS_ID = 'jbl-gdl';
const BUILDINGS: BuildingCatalog[] = [
  { id: 'bldg-01', code: 'BLDG-01', name: 'Edificio Principal', lines: [1, 2, 3, 4] },
  { id: 'bldg-02', code: 'BLDG-02', name: 'Edificio SMT', lines: [5, 6] },
  { id: 'bldg-03', code: 'BLDG-03', name: 'Edificio Ensamble', lines: [7, 8] },
];

@Injectable()
export class EnterpriseCampusService {
  constructor(
    @InjectRepository(Kit) private readonly kitRepo: Repository<Kit>,
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
    @InjectRepository(CancellationRequest) private readonly cancellationRepo: Repository<CancellationRequest>,
    @InjectRepository(ProductionBayIncident) private readonly incidentRepo: Repository<ProductionBayIncident>,
  ) {}

  async getCampusState(): Promise<CampusStateResponse> {
    const [kits, plans, cancellations, incidents] = await Promise.all([
      this.kitRepo.find({ relations: ['plan'] }),
      this.planRepo.find(),
      this.cancellationRepo.find({ take: 20, order: { createdAt: 'DESC' } }),
      this.incidentRepo.find({ relations: ['kit', 'kit.plan'], take: 30, order: { createdAt: 'DESC' } }),
    ]);

    const currentShift = this.currentShift();
    const buildingByLine = this.buildBuildingByLineMap();
    const buildingNodes = this.buildBuildingNodes(plans, kits, currentShift, buildingByLine);
    const programNodes = this.buildProgramNodes(plans, kits, buildingByLine);
    const customerNodes = this.buildCustomerNodes(programNodes);
    const exceptionNodes = this.buildExceptions(cancellations, incidents, kits, buildingByLine);
    const warehouseNodes = this.buildWarehouseNodes(kits);
    const kpis = this.buildKpis(plans, kits, cancellations, exceptionNodes, buildingNodes, warehouseNodes, programNodes);
    const domainHealth = this.buildDomainHealth(kits, cancellations, exceptionNodes, plans);

    return {
      campus: { id: CAMPUS_ID, code: 'JBL-GDL', name: 'Jabil Guadalajara' },
      buildings: buildingNodes,
      warehouses: warehouseNodes,
      customers: customerNodes,
      programs: programNodes,
      kpis,
      exceptions: exceptionNodes,
      domainHealth,
      lastUpdated: new Date().toISOString(),
      currentShift,
    };
  }

  private buildBuildingByLineMap(): Map<number, BuildingCatalog> {
    const map = new Map<number, BuildingCatalog>();
    for (const building of BUILDINGS) {
      for (const line of building.lines) map.set(line, building);
    }
    return map;
  }

  private buildBuildingNodes(
    plans: Plan[],
    kits: Kit[],
    currentShift: Shift,
    buildingByLine: Map<number, BuildingCatalog>,
  ): BuildingNode[] {
    return BUILDINGS.map((building) => {
      const lineSet = new Set(building.lines);
      const buildingPlans = plans.filter((plan) => lineSet.has(plan.line));
      const buildingKits = kits.filter((kit) => lineSet.has(kit.plan?.line ?? -1));
      const activeWOs = buildingPlans.filter((plan) => ['pending', 'active'].includes(plan.status)).length;
      const completed = buildingKits.filter((kit) => kit.status === 'completed').length;
      const total = Math.max(buildingKits.length, 1);
      const shortages = buildingKits.filter((kit) => ['requested', 'ready'].includes(kit.status)).length;
      const activeLines = new Set(
        buildingPlans
          .filter((plan) => plan.status === 'active')
          .map((plan) => plan.line),
      ).size;

      const risk: RiskLevel = shortages >= 8 ? 'critical' : shortages >= 4 ? 'at_risk' : 'ok';

      return {
        id: building.id,
        campusId: CAMPUS_ID,
        code: building.code,
        name: building.name,
        status: activeLines > 0 ? 'active' : 'idle',
        activeLines,
        totalLines: building.lines.length,
        activeWOs,
        shortages,
        completionPct: Math.round((completed / total) * 100),
        currentShift,
        risk,
      };
    });
  }

  private buildProgramNodes(plans: Plan[], kits: Kit[], buildingByLine: Map<number, BuildingCatalog>): ProgramNode[] {
    const grouped = new Map<string, { plans: Plan[]; kits: Kit[] }>();
    const defaultGroup = 'GEN-DEFAULT';

    for (const plan of plans) {
      const key = this.inferProgramCode(plan.model) ?? defaultGroup;
      if (!grouped.has(key)) grouped.set(key, { plans: [], kits: [] });
      grouped.get(key)!.plans.push(plan);
    }

    for (const kit of kits) {
      const key = this.inferProgramCode(kit.plan?.model) ?? defaultGroup;
      if (!grouped.has(key)) grouped.set(key, { plans: [], kits: [] });
      grouped.get(key)!.kits.push(kit);
    }

    return [...grouped.entries()].slice(0, 20).map(([code, bucket], idx) => {
      const buildingIds = [...new Set(bucket.plans
        .map((plan) => buildingByLine.get(plan.line)?.id)
        .filter(Boolean))] as string[];
      const completedWOs = bucket.kits.filter((kit) => kit.status === 'completed').length;
      const activeWOs = bucket.plans.filter((plan) => ['pending', 'active'].includes(plan.status)).length;
      const pendingKits = bucket.kits.filter((kit) => ['requested', 'ready', 'kitted'].includes(kit.status)).length;

      return {
        id: `prog-${code.toLowerCase()}`,
        customerId: `cust-${this.inferCustomerCode(code)}`,
        customerName: this.customerNameFromProgram(code),
        code,
        name: `Programa ${code}`,
        status: activeWOs > 0 ? 'active' : 'on_hold',
        buildingIds: buildingIds.length > 0 ? buildingIds : ['bldg-01'],
        activeWOs,
        completedWOs,
        risk: pendingKits >= 10 ? 'critical' : pendingKits >= 4 ? 'at_risk' : 'ok',
        dueDate: bucket.plans
          .map((plan) => plan.scheduledAt)
          .filter((d): d is Date => !!d)
          .sort((a, b) => a.getTime() - b.getTime())[0]
          ?.toISOString(),
      } as ProgramNode;
    });
  }

  private buildCustomerNodes(programs: ProgramNode[]): CustomerNode[] {
    const byCustomer = new Map<string, ProgramNode[]>();
    for (const program of programs) {
      if (!byCustomer.has(program.customerId)) byCustomer.set(program.customerId, []);
      byCustomer.get(program.customerId)!.push(program);
    }

    return [...byCustomer.entries()].map(([customerId, customerPrograms]) => {
      const critical = customerPrograms.filter((p) => p.risk === 'critical').length;
      const atRisk = customerPrograms.filter((p) => p.risk === 'at_risk').length;
      const risk: RiskLevel = critical > 0 ? 'critical' : atRisk > 0 ? 'at_risk' : 'ok';
      const code = customerId.replace('cust-', '').toUpperCase();

      return {
        id: customerId,
        code,
        name: customerPrograms[0]?.customerName ?? `Cliente ${code}`,
        industry: 'Electronics Manufacturing Services',
        activePrograms: customerPrograms.length,
        risk,
      };
    });
  }

  private buildWarehouseNodes(kits: Kit[]): WarehouseNode[] {
    const pending = kits.filter((kit) => ['ready', 'requested'].includes(kit.status)).length;
    const inProgress = kits.filter((kit) => kit.status === 'in_progress').length;

    return [
      {
        id: 'wh-central',
        campusId: CAMPUS_ID,
        code: 'WH-CENTRAL',
        name: 'Almacén Central',
        type: 'central',
        utilizationPct: Math.min(95, 40 + pending),
        locationCount: 1800,
        activeMovements: pending,
        risk: pending > 24 ? 'critical' : pending > 12 ? 'at_risk' : 'ok',
        accuracy: 98.2,
      },
      {
        id: 'wh-local-01',
        campusId: CAMPUS_ID,
        buildingId: 'bldg-01',
        code: 'WH-LOCAL-01',
        name: 'Almacén Edificio 01',
        type: 'building',
        utilizationPct: Math.min(92, 35 + Math.round(inProgress * 1.3)),
        locationCount: 640,
        activeMovements: inProgress,
        risk: inProgress > 14 ? 'at_risk' : 'ok',
        accuracy: 97.4,
      },
      {
        id: 'wh-local-02',
        campusId: CAMPUS_ID,
        buildingId: 'bldg-02',
        code: 'WH-LOCAL-02',
        name: 'Almacén Edificio 02',
        type: 'building',
        utilizationPct: Math.min(92, 30 + Math.round(inProgress * 1.1)),
        locationCount: 520,
        activeMovements: Math.round(inProgress * 0.7),
        risk: 'ok',
        accuracy: 97,
      },
      {
        id: 'wh-sub-01',
        campusId: CAMPUS_ID,
        buildingId: 'bldg-01',
        code: 'WH-SUB-01',
        name: 'Subalmacén de Línea',
        type: 'subwarehouse',
        utilizationPct: Math.min(96, 45 + Math.round(inProgress * 1.8)),
        locationCount: 220,
        activeMovements: Math.round(inProgress * 1.4),
        risk: inProgress > 18 ? 'at_risk' : 'ok',
      },
    ];
  }

  private buildExceptions(
    cancellations: CancellationRequest[],
    incidents: ProductionBayIncident[],
    kits: Kit[],
    buildingByLine: Map<number, BuildingCatalog>,
  ): CampusException[] {
    const list: CampusException[] = [];

    for (const cancellation of cancellations.filter((item) => item.status === 'pending').slice(0, 4)) {
      const line = cancellation.publication?.line;
      const buildingId = line ? buildingByLine.get(line)?.id : undefined;
      list.push({
        id: `cancel-${cancellation.id}`,
        severity: 'critical',
        domain: 'planning',
        buildingId,
        message: `Cancelación pendiente WO ${cancellation.publication?.workOrder ?? 'N/A'}`,
        time: this.formatTime(cancellation.createdAt),
        route: '/plan',
      });
    }

    for (const incident of incidents.filter((item) => item.status === 'open').slice(0, 6)) {
      const line = incident.kit?.plan?.line;
      const buildingId = line ? buildingByLine.get(line)?.id : undefined;
      list.push({
        id: `incident-${incident.id}`,
        severity: 'high',
        domain: 'production',
        buildingId,
        message: `${incident.type} · Línea ${line ?? 'N/A'} · Bahía ${incident.bayId}`,
        time: this.formatTime(incident.createdAt),
        route: '/monitor',
      });
    }

    for (const stalled of kits.filter((kit) => kit.status === 'in_progress' && !kit.advances?.length).slice(0, 3)) {
      const line = stalled.plan?.line;
      const buildingId = line ? buildingByLine.get(line)?.id : undefined;
      list.push({
        id: `stall-${stalled.id}`,
        severity: 'medium',
        domain: 'materials',
        buildingId,
        message: `Kit ${stalled.id} en progreso sin avance registrado`,
        time: this.formatTime(stalled.createdAt),
        route: '/kits',
      });
    }

    const severityOrder: Record<CampusException['severity'], number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return list.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]).slice(0, 12);
  }

  private buildKpis(
    plans: Plan[],
    kits: Kit[],
    cancellations: CancellationRequest[],
    exceptions: CampusException[],
    buildings: BuildingNode[],
    warehouses: WarehouseNode[],
    programs: ProgramNode[],
  ): CampusKpi[] {
    const activeLines = new Set(plans.filter((plan) => plan.status === 'active').map((plan) => plan.line)).size;
    const totalLines = new Set(plans.map((plan) => plan.line)).size || 8;
    const openWOs = plans.filter((plan) => ['pending', 'active'].includes(plan.status)).length;
    const completedWOs = plans.filter((plan) => plan.status === 'completed').length;
    const pendingKits = kits.filter((kit) => ['ready', 'requested', 'kitted'].includes(kit.status)).length;
    const pendingCancel = cancellations.filter((item) => item.status === 'pending').length;

    return [
      { label: 'Edificios Activos', value: buildings.filter((b) => b.status === 'active').length, sub: `de ${buildings.length} configurados`, risk: 'ok', icon: 'fa-building' },
      { label: 'Líneas en Producción', value: activeLines, sub: `de ${totalLines} total`, risk: activeLines === 0 ? 'at_risk' : 'ok', icon: 'fa-microchip' },
      { label: 'WOs Abiertos', value: openWOs, sub: `${completedWOs} completados`, risk: 'ok', icon: 'fa-file-alt' },
      { label: 'Kits Pendientes', value: pendingKits, sub: 'listos para línea', risk: pendingKits > 15 ? 'at_risk' : 'ok', icon: 'fa-boxes-stacked' },
      { label: 'Excepciones Abiertas', value: exceptions.length, sub: 'campus Guadalajara', risk: exceptions.length > 4 ? 'critical' : exceptions.length > 0 ? 'at_risk' : 'ok', icon: 'fa-triangle-exclamation' },
      { label: 'Cancelaciones', value: pendingCancel, sub: 'requieren respuesta', risk: pendingCancel > 0 ? 'critical' : 'ok', icon: 'fa-ban' },
      { label: 'Programas Activos', value: programs.length, sub: 'multi-cliente activos', risk: 'ok', icon: 'fa-calendar-check' },
      { label: 'Almacenes Red', value: warehouses.length, sub: 'central · local · sublínea', risk: 'ok', icon: 'fa-warehouse' },
    ];
  }

  private buildDomainHealth(
    kits: Kit[],
    cancellations: CancellationRequest[],
    exceptions: CampusException[],
    plans: Plan[],
  ): DomainHealth[] {
    const pendingKits = kits.filter((kit) => ['ready', 'requested'].includes(kit.status)).length;
    const activeLines = new Set(plans.filter((plan) => plan.status === 'active').map((plan) => plan.line)).size;
    const pendingCancel = cancellations.filter((item) => item.status === 'pending').length;
    const productionExceptions = exceptions.filter((item) => item.domain === 'production').length;

    return [
      { domain: 'Live Lines', icon: 'fa-microchip', route: '/monitor', status: productionExceptions > 3 ? 'critical' : productionExceptions > 0 ? 'at_risk' : 'ok', metric: `${activeLines} líneas activas`, detail: `${productionExceptions} incidencia(s) abiertas` },
      { domain: 'Kitting', icon: 'fa-boxes-stacked', route: '/kits', status: pendingKits > 15 ? 'at_risk' : 'ok', metric: `${pendingKits} kits pendientes`, detail: 'Seguimiento por edificio' },
      { domain: 'Resupply', icon: 'fa-truck', route: '/materials/resupply', status: 'ok', metric: 'Flujo activo', detail: 'Cobertura multi-warehouse' },
      { domain: 'Planeación', icon: 'fa-calendar-alt', route: '/plan', status: pendingCancel > 0 ? 'critical' : 'ok', metric: `${plans.length} WOs`, detail: `${pendingCancel} cancelaciones pendientes` },
      { domain: 'Inventario / IC', icon: 'fa-barcode', route: '/materials/cycle-counts', status: 'ok', metric: 'Conteos activos', detail: 'Precisión de inventario' },
      { domain: 'Producción / MES', icon: 'fa-industry', route: '/production', status: 'ok', metric: 'Ejecución activa', detail: 'Shopfloor por edificio' },
      { domain: 'BOM / Modelos', icon: 'fa-sitemap', route: '/bom', status: 'ok', metric: 'Estructura de producto', detail: 'Productos multi-programa' },
      { domain: 'Forecast / BI', icon: 'fa-chart-line', route: '/forecast', status: 'ok', metric: 'Análisis activo', detail: 'Decision intelligence' },
    ];
  }

  private currentShift(): Shift {
    const h = new Date().getHours();
    if (h >= 6 && h < 14) return 'A';
    if (h >= 14 && h < 22) return 'B';
    return 'C';
  }

  private formatTime(date?: Date | null): string {
    if (!date) return '—';
    return new Intl.DateTimeFormat('es-MX', { timeStyle: 'short', hour12: false }).format(date);
  }

  private inferProgramCode(model?: string | null): string | null {
    if (!model) return null;
    const clean = model.trim().toUpperCase();
    const parts = clean.split(/[-_\s]+/).filter(Boolean);
    if (!parts.length) return null;
    return parts.slice(0, 2).join('-');
  }

  private inferCustomerCode(programCode: string): string {
    const prefix = programCode.split('-')[0] ?? 'GEN';
    return prefix.toLowerCase();
  }

  private customerNameFromProgram(programCode: string): string {
    const prefix = this.inferCustomerCode(programCode).toUpperCase();
    return `Cliente ${prefix}`;
  }
}
