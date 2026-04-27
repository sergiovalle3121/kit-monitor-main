import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Kit } from '../kits/entities/kit.entity';
import { Plan } from '../plans/entities/plan.entity';
import { CancellationRequest } from '../cancellation-requests/entities/cancellation-request.entity';
import { ProductionBayIncident } from '../production-runtime/entities/production-bay-incident.entity';
import {
  CampusException,
  CampusKpi,
  CampusStateResponse,
  CustomerNode,
  DomainHealth,
  ProductionAreaNode,
  ProductionLineNode,
  ProductionStationNode,
  ProgramNode,
  RiskLevel,
  Shift,
  WarehouseNode,
} from './enterprise-campus.types';
import { EnterpriseBuilding } from './entities/enterprise-building.entity';
import { EnterpriseWarehouse } from './entities/enterprise-warehouse.entity';
import { EnterpriseCustomer } from './entities/enterprise-customer.entity';
import { EnterpriseProgram } from './entities/enterprise-program.entity';
import { EnterpriseArea } from './entities/enterprise-area.entity';
import { EnterpriseLine } from './entities/enterprise-line.entity';
import { EnterpriseStation } from './entities/enterprise-station.entity';
import { EnterprisePlanLink } from './entities/enterprise-plan-link.entity';

const CAMPUS_ID = 'jbl-gdl';

@Injectable()
export class EnterpriseCampusService implements OnModuleInit {
  constructor(
    @InjectRepository(Kit) private readonly kitRepo: Repository<Kit>,
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
    @InjectRepository(CancellationRequest) private readonly cancellationRepo: Repository<CancellationRequest>,
    @InjectRepository(ProductionBayIncident) private readonly incidentRepo: Repository<ProductionBayIncident>,
    @InjectRepository(EnterpriseBuilding) private readonly buildingRepo: Repository<EnterpriseBuilding>,
    @InjectRepository(EnterpriseWarehouse) private readonly warehouseRepo: Repository<EnterpriseWarehouse>,
    @InjectRepository(EnterpriseCustomer) private readonly customerRepo: Repository<EnterpriseCustomer>,
    @InjectRepository(EnterpriseProgram) private readonly programRepo: Repository<EnterpriseProgram>,
    @InjectRepository(EnterpriseArea) private readonly areaRepo: Repository<EnterpriseArea>,
    @InjectRepository(EnterpriseLine) private readonly lineRepo: Repository<EnterpriseLine>,
    @InjectRepository(EnterpriseStation) private readonly stationRepo: Repository<EnterpriseStation>,
    @InjectRepository(EnterprisePlanLink) private readonly planLinkRepo: Repository<EnterprisePlanLink>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureDimensionSeedData();
      await this.ensureTopologySeedData();
      await this.ensurePlanLinkage();
    } catch (err) {
      console.error('[EnterpriseCampusService] Initialization warning:', err.message);
    }
  }

  async listBuildings() {
    await this.ensureDimensionSeedData();
    return this.buildingRepo.find({ order: { sortOrder: 'ASC', code: 'ASC' } });
  }

  async listWarehouses() {
    await this.ensureDimensionSeedData();
    return this.warehouseRepo.find({ relations: ['building'], order: { sortOrder: 'ASC', code: 'ASC' } });
  }

  async listCustomers() {
    await this.ensureDimensionSeedData();
    return this.customerRepo.find({ order: { code: 'ASC' } });
  }

  async listPrograms() {
    await this.ensureDimensionSeedData();
    return this.programRepo.find({ relations: ['customer', 'dedicatedBuilding'], order: { code: 'ASC' } });
  }

  async listAreas() {
    await this.ensureTopologySeedData();
    return this.areaRepo.find({ relations: ['building'], order: { sortOrder: 'ASC', code: 'ASC' } });
  }

  async listLines() {
    await this.ensureTopologySeedData();
    return this.lineRepo.find({ relations: ['building', 'area'], order: { sortOrder: 'ASC', code: 'ASC' } });
  }

  async listStations(lineId?: string) {
    await this.ensureTopologySeedData();
    return this.stationRepo.find({
      where: lineId ? { line: { id: lineId } } : {},
      relations: ['line'],
      order: { position: 'ASC' },
    });
  }

  async getCampusState(): Promise<CampusStateResponse> {
    await this.ensureDimensionSeedData();
    await this.ensureTopologySeedData();
    await this.ensurePlanLinkage();

    const [kits, plans, cancellations, incidents, buildings, warehouses, customers, programs, areas, lines, stations, planLinks] = await Promise.all([
      this.kitRepo.find({ relations: ['plan'] }),
      this.planRepo.find(),
      this.cancellationRepo.find({ take: 20, order: { createdAt: 'DESC' } }),
      this.incidentRepo.find({ relations: ['kit', 'kit.plan'], take: 30, order: { createdAt: 'DESC' } }),
      this.listBuildings(),
      this.listWarehouses(),
      this.listCustomers(),
      this.listPrograms(),
      this.listAreas(),
      this.listLines(),
      this.listStations(),
      this.planLinkRepo.find({ relations: ['plan', 'program', 'building', 'line'] }),
    ]);

    const currentShift = this.currentShift();
    const planContextByPlanId = new Map(planLinks.map((link) => [link.plan.id, link]));
    const stationCountByLine = new Map<string, number>();
    for (const station of stations) {
      const lineId = station.line?.id;
      if (!lineId) continue;
      stationCountByLine.set(lineId, (stationCountByLine.get(lineId) ?? 0) + 1);
    }

    const areasNode: ProductionAreaNode[] = areas.map((area) => ({
      id: area.id,
      buildingId: area.building.id,
      code: area.code,
      name: area.name,
      type: area.type,
      status: area.status,
    }));

    const linesNode: ProductionLineNode[] = lines.map((line) => {
      const activePlanCount = plans.filter((plan) => {
        const ctx = planContextByPlanId.get(plan.id);
        return ctx?.line?.id === line.id && ['pending', 'active'].includes(plan.status);
      }).length;

      return {
        id: line.id,
        buildingId: line.building.id,
        areaId: line.area.id,
        code: line.code,
        name: line.name,
        status: line.status,
        activeShift: line.activeShift ?? undefined,
        capacityPerShift: line.capacityPerShift,
        stationCount: stationCountByLine.get(line.id) ?? 0,
        activePlanCount,
      };
    });

    const stationsNode: ProductionStationNode[] = stations.map((station) => ({
      id: station.id,
      lineId: station.line.id,
      code: station.code,
      position: station.position,
      status: station.status,
    }));

    const buildingNodes = buildings.map((building) => {
      const buildingLineIds = new Set(lines.filter((line) => line.building.id === building.id).map((line) => line.id));
      const buildingPlanIds = plans.filter((plan) => {
        const ctx = planContextByPlanId.get(plan.id);
        return ctx?.building?.id === building.id;
      }).map((p) => p.id);
      const buildingKitSet = kits.filter((kit) => buildingPlanIds.includes(kit.plan?.id ?? -1));
      const activeWOs = plans.filter((plan) => planContextByPlanId.get(plan.id)?.building?.id === building.id && ['pending', 'active'].includes(plan.status)).length;
      const completed = buildingKitSet.filter((kit) => kit.status === 'completed').length;
      const shortages = buildingKitSet.filter((kit) => ['requested', 'ready'].includes(kit.status)).length;
      const activeLines = lines.filter((line) => buildingLineIds.has(line.id) && line.status === 'active').length;
      const risk: RiskLevel = shortages >= 8 ? 'critical' : shortages >= 4 ? 'at_risk' : 'ok';

      return {
        id: building.id,
        campusId: CAMPUS_ID,
        code: building.code,
        name: building.name,
        status: building.status,
        activeLines,
        totalLines: Math.max(1, buildingLineIds.size),
        activeWOs,
        shortages,
        completionPct: Math.round((completed / Math.max(1, buildingKitSet.length)) * 100),
        currentShift,
        risk,
      };
    });

    const programNodes = programs.map((program): ProgramNode => {
      const matchingLinks = planLinks.filter((link) => link.program?.id === program.id);
      const matchingPlanIds = new Set(matchingLinks.map((link) => link.plan.id));
      const programPlans = plans.filter((plan) => matchingPlanIds.has(plan.id));
      const programKits = kits.filter((kit) => matchingPlanIds.has(kit.plan?.id ?? -1));
      const buildingIds = [...new Set(matchingLinks.map((link) => link.building?.id).filter(Boolean))] as string[];
      const activeWOs = programPlans.filter((plan) => ['pending', 'active'].includes(plan.status)).length;
      const completedWOs = programKits.filter((kit) => kit.status === 'completed').length;
      const pendingKits = programKits.filter((kit) => ['requested', 'ready', 'kitted'].includes(kit.status)).length;

      return {
        id: program.id,
        customerId: program.customer.id,
        customerName: program.customer.name,
        code: program.code,
        name: program.name,
        status: program.status,
        buildingIds: buildingIds.length ? buildingIds : (program.dedicatedBuilding?.id ? [program.dedicatedBuilding.id] : []),
        activeWOs,
        completedWOs,
        risk: pendingKits >= 10 ? 'critical' : pendingKits >= 4 ? 'at_risk' : 'ok',
        dueDate: programPlans.map((p) => p.scheduledAt).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0]?.toISOString(),
      };
    });

    const customerNodes: CustomerNode[] = customers.map((customer) => {
      const related = programNodes.filter((program) => program.customerId === customer.id);
      const hasCritical = related.some((item) => item.risk === 'critical');
      const hasAtRisk = related.some((item) => item.risk === 'at_risk');
      return {
        id: customer.id,
        code: customer.code,
        name: customer.name,
        industry: customer.industry ?? undefined,
        activePrograms: related.length,
        risk: hasCritical ? 'critical' : hasAtRisk ? 'at_risk' : 'ok',
      };
    });

    const pendingKits = kits.filter((kit) => ['ready', 'requested'].includes(kit.status)).length;
    const inProgressKits = kits.filter((kit) => kit.status === 'in_progress').length;
    const warehouseNodes: WarehouseNode[] = warehouses.map((warehouse) => {
      const multiplier = warehouse.type === 'central' ? 1 : warehouse.type === 'building' ? 0.8 : 0.6;
      const activeMovements = Math.round((pendingKits + inProgressKits) * multiplier);
      const utilizationPct = Math.min(98, 28 + activeMovements);
      return {
        id: warehouse.id,
        campusId: CAMPUS_ID,
        buildingId: warehouse.building?.id ?? undefined,
        code: warehouse.code,
        name: warehouse.name,
        type: warehouse.type,
        utilizationPct,
        locationCount: warehouse.locationCount,
        activeMovements,
        risk: utilizationPct >= 90 ? 'critical' : utilizationPct >= 75 ? 'at_risk' : 'ok',
      };
    });

    const exceptions = this.buildExceptions(cancellations, incidents, kits, planContextByPlanId);

    const kpis: CampusKpi[] = [
      { label: 'Edificios Activos', value: buildingNodes.filter((b) => b.status === 'active').length, sub: `de ${buildingNodes.length} configurados`, risk: 'ok', icon: 'fa-building' },
      { label: 'Áreas Operativas', value: areasNode.length, sub: 'topología productiva', risk: 'ok', icon: 'fa-layer-group' },
      { label: 'Líneas/Workcenters', value: linesNode.length, sub: `${linesNode.filter((l) => l.status === 'active').length} activas`, risk: linesNode.length === 0 ? 'critical' : 'ok', icon: 'fa-industry' },
      { label: 'Estaciones/Bahías', value: stationsNode.length, sub: 'estructura por línea', risk: 'ok', icon: 'fa-table-cells' },
      { label: 'WOs Abiertos', value: plans.filter((plan) => ['pending', 'active'].includes(plan.status)).length, sub: `${plans.filter((p) => p.status === 'completed').length} completados`, risk: 'ok', icon: 'fa-file-alt' },
      { label: 'Excepciones Abiertas', value: exceptions.length, sub: 'campus Guadalajara', risk: exceptions.length > 4 ? 'critical' : exceptions.length > 0 ? 'at_risk' : 'ok', icon: 'fa-triangle-exclamation' },
      { label: 'Programas Activos', value: programNodes.length, sub: 'multi-cliente activos', risk: 'ok', icon: 'fa-calendar-check' },
      { label: 'Almacenes Red', value: warehouseNodes.length, sub: 'nodos enterprise', risk: 'ok', icon: 'fa-warehouse' },
    ];

    const domainHealth: DomainHealth[] = [
      { domain: 'Live Lines', icon: 'fa-microchip', route: '/monitor', status: linesNode.filter((l) => l.status === 'active').length === 0 ? 'at_risk' : 'ok', metric: `${linesNode.filter((l) => l.status === 'active').length} líneas activas`, detail: `${exceptions.filter((e) => e.domain === 'production').length} incidencia(s) abiertas` },
      { domain: 'Topology', icon: 'fa-network-wired', route: '/monitor', status: stationsNode.length === 0 ? 'critical' : 'ok', metric: `${areasNode.length} áreas / ${linesNode.length} líneas`, detail: `${stationsNode.length} estaciones registradas` },
      { domain: 'Planeación', icon: 'fa-calendar-alt', route: '/plan', status: cancellations.filter((item) => item.status === 'pending').length > 0 ? 'critical' : 'ok', metric: `${plans.length} WOs`, detail: `${cancellations.filter((item) => item.status === 'pending').length} cancelaciones pendientes` },
      { domain: 'Kitting', icon: 'fa-boxes-stacked', route: '/kits', status: pendingKits > 15 ? 'at_risk' : 'ok', metric: `${pendingKits} kits pendientes`, detail: 'Seguimiento por building/line' },
      { domain: 'Forecast / BI', icon: 'fa-chart-line', route: '/forecast', status: 'ok', metric: 'Análisis activo', detail: 'Decision intelligence' },
    ];

    return {
      campus: { id: CAMPUS_ID, code: 'JBL-GDL', name: 'Jabil Guadalajara' },
      buildings: buildingNodes,
      warehouses: warehouseNodes,
      customers: customerNodes,
      programs: programNodes,
      areas: areasNode,
      lines: linesNode,
      stations: stationsNode,
      kpis,
      exceptions,
      domainHealth,
      lastUpdated: new Date().toISOString(),
      currentShift,
    };
  }

  private buildExceptions(
    cancellations: CancellationRequest[],
    incidents: ProductionBayIncident[],
    kits: Kit[],
    planContextByPlanId: Map<number, EnterprisePlanLink>,
  ): CampusException[] {
    const list: CampusException[] = [];

    for (const cancellation of cancellations.filter((item) => item.status === 'pending').slice(0, 4)) {
      const ctx = cancellation.publication?.id ? planContextByPlanId.get(cancellation.publication.id) : undefined;
      list.push({
        id: `cancel-${cancellation.id}`,
        severity: 'critical',
        domain: 'planning',
        buildingId: ctx?.building?.id,
        programId: ctx?.program?.id,
        message: `Cancelación pendiente WO ${cancellation.publication?.workOrder ?? 'N/A'}`,
        time: this.formatTime(cancellation.createdAt),
        route: '/plan',
      });
    }

    for (const incident of incidents.filter((item) => item.status === 'open').slice(0, 6)) {
      const ctx = incident.kit?.plan?.id ? planContextByPlanId.get(incident.kit.plan.id) : undefined;
      list.push({
        id: `incident-${incident.id}`,
        severity: 'high',
        domain: 'production',
        buildingId: ctx?.building?.id,
        programId: ctx?.program?.id,
        message: `${incident.type} · Línea ${ctx?.line?.code ?? incident.kit?.plan?.line ?? 'N/A'} · Bahía ${incident.bayId}`,
        time: this.formatTime(incident.createdAt),
        route: '/monitor',
      });
    }

    for (const stalled of kits.filter((kit) => kit.status === 'in_progress').slice(0, 3)) {
      const ctx = stalled.plan?.id ? planContextByPlanId.get(stalled.plan.id) : undefined;
      list.push({
        id: `stall-${stalled.id}`,
        severity: 'medium',
        domain: 'materials',
        buildingId: ctx?.building?.id,
        programId: ctx?.program?.id,
        message: `Kit ${stalled.id} en progreso requiere seguimiento de materiales`,
        time: this.formatTime(stalled.createdAt),
        route: '/kits',
      });
    }

    const severityOrder: Record<CampusException['severity'], number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return list.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]).slice(0, 12);
  }

  private async ensureDimensionSeedData(): Promise<void> {
    if (await this.buildingRepo.count()) return;

    const buildings = await this.buildingRepo.save([
      this.buildingRepo.create({ id: 'bldg-01', code: 'BLDG-01', name: 'Edificio Principal', status: 'active', tags: ['assembly'], activeShifts: ['A', 'B', 'C'], sortOrder: 10 }),
      this.buildingRepo.create({ id: 'bldg-02', code: 'BLDG-02', name: 'Edificio SMT', status: 'active', tags: ['smt', 'npi'], activeShifts: ['A', 'B'], sortOrder: 20 }),
      this.buildingRepo.create({ id: 'bldg-03', code: 'BLDG-03', name: 'Edificio Ensamble', status: 'active', tags: ['final-assembly'], activeShifts: ['A', 'B', 'C'], sortOrder: 30 }),
    ]);
    const byId = new Map(buildings.map((building) => [building.id, building]));

    const customers = await this.customerRepo.save([
      this.customerRepo.create({ id: 'cust-hpc', code: 'HPC', name: 'Cliente HPC', industry: 'Computing', status: 'active' }),
      this.customerRepo.create({ id: 'cust-auto', code: 'AUTO', name: 'Cliente Automotriz', industry: 'Automotive', status: 'active' }),
      this.customerRepo.create({ id: 'cust-med', code: 'MED', name: 'Cliente Médico', industry: 'Medical Devices', status: 'active' }),
    ]);
    const customerById = new Map(customers.map((customer) => [customer.id, customer]));

    await this.warehouseRepo.save([
      this.warehouseRepo.create({ id: 'wh-central', code: 'WH-CENTRAL', name: 'Almacén Central', type: 'central', status: 'active', locationCount: 1800, sortOrder: 10 }),
      this.warehouseRepo.create({ id: 'wh-local-01', code: 'WH-LOCAL-01', name: 'Almacén BLDG-01', type: 'building', status: 'active', locationCount: 640, sortOrder: 20, building: byId.get('bldg-01') }),
      this.warehouseRepo.create({ id: 'wh-local-02', code: 'WH-LOCAL-02', name: 'Almacén BLDG-02', type: 'building', status: 'active', locationCount: 520, sortOrder: 30, building: byId.get('bldg-02') }),
      this.warehouseRepo.create({ id: 'wh-sub-01', code: 'WH-SUB-01', name: 'Subalmacén Línea 1-4', type: 'subwarehouse', status: 'active', locationCount: 220, sortOrder: 40, building: byId.get('bldg-01') }),
      this.warehouseRepo.create({ id: 'wh-quarantine', code: 'WH-QA', name: 'Almacén de Cuarentena', type: 'quarantine', status: 'active', locationCount: 90, sortOrder: 50 }),
    ]);

    await this.programRepo.save([
      this.programRepo.create({ id: 'prog-hpc-01', customer: customerById.get('cust-hpc')!, code: 'HPC-01', name: 'High Compute Mainboard', status: 'active', primaryModelPrefix: 'OP-520', dedicatedBuilding: byId.get('bldg-01') }),
      this.programRepo.create({ id: 'prog-auto-01', customer: customerById.get('cust-auto')!, code: 'AUTO-01', name: 'Automotive Control Unit', status: 'ramping', primaryModelPrefix: 'OP-580', dedicatedBuilding: byId.get('bldg-02') }),
      this.programRepo.create({ id: 'prog-med-01', customer: customerById.get('cust-med')!, code: 'MED-01', name: 'Medical Controller', status: 'npi', primaryModelPrefix: 'OP-600', dedicatedBuilding: byId.get('bldg-03') }),
    ]);
  }

  private async ensureTopologySeedData(): Promise<void> {
    if (await this.areaRepo.count()) return;

    const buildings = await this.listBuildings();
    const byId = new Map(buildings.map((b) => [b.id, b]));

    const areas = await this.areaRepo.save([
      this.areaRepo.create({ id: 'area-b1-asm', building: byId.get('bldg-01')!, code: 'B1-ASM', name: 'Assembly Zone B1', type: 'Assembly', sortOrder: 10 }),
      this.areaRepo.create({ id: 'area-b1-test', building: byId.get('bldg-01')!, code: 'B1-TST', name: 'Functional Test B1', type: 'Test', sortOrder: 20 }),
      this.areaRepo.create({ id: 'area-b2-smt', building: byId.get('bldg-02')!, code: 'B2-SMT', name: 'SMT Zone B2', type: 'SMT', sortOrder: 10 }),
      this.areaRepo.create({ id: 'area-b3-pcba', building: byId.get('bldg-03')!, code: 'B3-PCBA', name: 'PCBA/Final Assy B3', type: 'PCBA', sortOrder: 10 }),
    ]);
    const areaById = new Map(areas.map((a) => [a.id, a]));

    const lines = await this.lineRepo.save([
      this.lineRepo.create({ id: 'line-01', building: byId.get('bldg-01')!, area: areaById.get('area-b1-asm')!, code: 'LINE-01', name: 'Assembly Line 01', legacyLineNumber: 1, status: 'active', capacityPerShift: 800, activeShift: 'A', tags: ['assembly'], sortOrder: 10 }),
      this.lineRepo.create({ id: 'line-02', building: byId.get('bldg-01')!, area: areaById.get('area-b1-test')!, code: 'LINE-02', name: 'Test Line 02', legacyLineNumber: 2, status: 'active', capacityPerShift: 620, activeShift: 'A', tags: ['test'], sortOrder: 20 }),
      this.lineRepo.create({ id: 'line-05', building: byId.get('bldg-02')!, area: areaById.get('area-b2-smt')!, code: 'LINE-05', name: 'SMT Line 05', legacyLineNumber: 5, status: 'active', capacityPerShift: 1200, activeShift: 'B', tags: ['smt'], sortOrder: 50 }),
      this.lineRepo.create({ id: 'line-07', building: byId.get('bldg-03')!, area: areaById.get('area-b3-pcba')!, code: 'LINE-07', name: 'PCBA Line 07', legacyLineNumber: 7, status: 'idle', capacityPerShift: 700, activeShift: 'B', tags: ['pcba'], sortOrder: 70 }),
    ]);

    const stations = lines.flatMap((line) => [1, 2, 3, 4].map((position) =>
      this.stationRepo.create({
        id: `st-${line.id}-${position}`,
        line,
        code: `${line.code}-B${position}`,
        position,
        status: 'active',
      }),
    ));
    await this.stationRepo.save(stations);
  }

  private async ensurePlanLinkage(): Promise<void> {
    const [plans, programs, lines, existingLinks] = await Promise.all([
      this.planRepo.find(),
      this.programRepo.find({ relations: ['dedicatedBuilding'] }),
      this.lineRepo.find({ relations: ['building', 'area'] }),
      this.planLinkRepo.find({ relations: ['plan'] }),
    ]);

    const linkedPlanIds = new Set(existingLinks.map((link) => link.plan.id));
    const lineByLegacy = new Map(lines.filter((line) => line.legacyLineNumber != null).map((line) => [line.legacyLineNumber!, line]));
    const programsByPrefix = new Map(programs.filter((p) => p.primaryModelPrefix).map((program) => [program.primaryModelPrefix!.toUpperCase(), program]));

    for (const plan of plans) {
      if (linkedPlanIds.has(plan.id)) continue;

      const linkedLine = lineByLegacy.get(plan.line) ?? null;
      const linkedProgram = this.matchProgramFromModel(plan.model, programsByPrefix);
      const method = linkedProgram ? 'model_prefix_fallback' : linkedLine ? 'line_map' : 'explicit';
      const confidence = linkedProgram && linkedLine ? 0.95 : linkedLine ? 0.8 : linkedProgram ? 0.65 : 0.3;

      await this.planLinkRepo.save(this.planLinkRepo.create({
        plan,
        line: linkedLine,
        building: linkedLine?.building ?? linkedProgram?.dedicatedBuilding ?? null,
        program: linkedProgram,
        mappingMethod: method,
        confidenceScore: confidence,
      }));
    }
  }

  private matchProgramFromModel(model: string, prefixes: Map<string, EnterpriseProgram>): EnterpriseProgram | null {
    const normalized = (model ?? '').trim().toUpperCase();
    if (!normalized) return null;
    const ordered = [...prefixes.keys()].sort((a, b) => b.length - a.length);
    const match = ordered.find((prefix) => normalized.startsWith(prefix));
    return match ? (prefixes.get(match) ?? null) : null;
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
}
