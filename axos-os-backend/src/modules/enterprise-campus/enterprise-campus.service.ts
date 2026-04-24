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

    // Campus Jabil Guadalajara
    // Campus Jabil Guadalajara Topology
    const buildings = await this.buildingRepo.save([
      // Valdepeñas
      this.buildingRepo.create({ id: 'val-01', code: 'B1', name: 'Valdepeñas B1', status: 'active', tags: ['valdepenas'], sortOrder: 10 }),
      this.buildingRepo.create({ id: 'val-02', code: 'B2', name: 'Valdepeñas B2', status: 'active', tags: ['valdepenas'], sortOrder: 11 }),
      
      // GTP (Guadalajara Technology Park)
      this.buildingRepo.create({ id: 'gtp-03', code: 'B3', name: 'GTP B3 (Almacén)', status: 'active', tags: ['gtp', 'warehouse'], sortOrder: 20 }),
      this.buildingRepo.create({ id: 'gtp-04', code: 'B4', name: 'GTP B4', status: 'active', tags: ['gtp'], sortOrder: 21 }),
      this.buildingRepo.create({ id: 'gtp-05', code: 'B5', name: 'GTP B5', status: 'active', tags: ['gtp'], sortOrder: 22 }),
      this.buildingRepo.create({ id: 'gtp-06', code: 'B6', name: 'GTP B6', status: 'active', tags: ['gtp'], sortOrder: 23 }),
      this.buildingRepo.create({ id: 'gtp-07', code: 'B7', name: 'GTP B7', status: 'active', tags: ['gtp'], sortOrder: 24 }),
      this.buildingRepo.create({ id: 'gtp-08', code: 'B8', name: 'GTP B8', status: 'active', tags: ['gtp'], sortOrder: 25 }),
      this.buildingRepo.create({ id: 'gtp-09', code: 'B9', name: 'GTP B9', status: 'active', tags: ['gtp'], sortOrder: 26 }),
      this.buildingRepo.create({ id: 'gtp-10', code: 'B10', name: 'GTP B10', status: 'active', tags: ['gtp'], sortOrder: 27 }),

      // Nextipac
      this.buildingRepo.create({ id: 'next-01', code: 'NEXTIPAC', name: 'Nextipac (Almacén General)', status: 'active', tags: ['central-warehouse'], sortOrder: 50 }),
    ]);
    const byId = new Map(buildings.map((building) => [building.id, building]));

    const customers = await this.customerRepo.save([
      this.customerRepo.create({ id: 'cust-tesla', code: 'TSLA', name: 'Tesla', industry: 'Automotive', status: 'active' }),
      this.customerRepo.create({ id: 'cust-cisco', code: 'CSCO', name: 'Cisco Systems', industry: 'Networking', status: 'active' }),
      this.customerRepo.create({ id: 'cust-dell', code: 'DELL', name: 'Dell Technologies', industry: 'Computing', status: 'active' }),
      this.customerRepo.create({ id: 'cust-apple', code: 'AAPL', name: 'Apple Inc.', industry: 'Consumer Electronics', status: 'active' }),
    ]);
    const customerById = new Map(customers.map((customer) => [customer.id, customer]));

    await this.warehouseRepo.save([
      this.warehouseRepo.create({ id: 'wh-nextipac', code: 'WH-NEXTI', name: 'Nextipac Main Storage', type: 'central', status: 'active', locationCount: 15000, sortOrder: 5, building: byId.get('next-01') }),
      this.warehouseRepo.create({ id: 'wh-val-01', code: 'WH-B1', name: 'Almacén B1', type: 'building', status: 'active', locationCount: 2200, sortOrder: 10, building: byId.get('val-01') }),
      this.warehouseRepo.create({ id: 'wh-gtp-03', code: 'WH-B3', name: 'Almacén B3', type: 'building', status: 'active', locationCount: 8500, sortOrder: 20, building: byId.get('gtp-03') }),
    ]);

    await this.programRepo.save([
      this.programRepo.create({ id: 'prog-optics', customer: customerById.get('cust-cisco')!, code: 'OPTICS', name: 'Cisco Optics', status: 'active', primaryModelPrefix: 'OPT', dedicatedBuilding: byId.get('val-01') }),
      this.programRepo.create({ id: 'prog-servers', customer: customerById.get('cust-dell')!, code: 'SERVERS', name: 'Dell PowerEdge', status: 'active', primaryModelPrefix: 'PE16', dedicatedBuilding: byId.get('val-02') }),
      this.programRepo.create({ id: 'prog-auto-nx', customer: customerById.get('cust-tesla')!, code: 'AUTO-NX', name: 'Tesla Autopilot', status: 'ramping', primaryModelPrefix: 'HW4', dedicatedBuilding: byId.get('gtp-04') }),
      this.programRepo.create({ id: 'prog-iphone', customer: customerById.get('cust-apple')!, code: 'IPHONE', name: 'Apple iPhone Assy', status: 'active', primaryModelPrefix: 'APL', dedicatedBuilding: byId.get('gtp-05') }),
    ]);
  }

  private async ensureTopologySeedData(): Promise<void> {
    if (await this.areaRepo.count()) return;

    const buildings = await this.listBuildings();
    const byId = new Map(buildings.map((b) => [b.id, b]));

    const areas = await this.areaRepo.save([
      this.areaRepo.create({ id: 'area-v1-asm', building: byId.get('val-01')!, code: 'V1-ASM', name: 'Valdepeñas Assy Zone', type: 'Assembly', sortOrder: 10 }),
      this.areaRepo.create({ id: 'area-v2-smt', building: byId.get('val-02')!, code: 'V2-SMT', name: 'Valdepeñas SMT Zone', type: 'SMT', sortOrder: 10 }),
      this.areaRepo.create({ id: 'area-g3-wh',  building: byId.get('gtp-03')!, code: 'G3-WH',  name: 'GTP Warehouse Zone', type: 'Storage', sortOrder: 20 }),
      this.areaRepo.create({ id: 'area-g4-fa',  building: byId.get('gtp-04')!, code: 'G4-FA',  name: 'GTP Final Assy Zone', type: 'Assembly', sortOrder: 21 }),
      this.areaRepo.create({ id: 'area-g5-fa',  building: byId.get('gtp-05')!, code: 'G5-FA',  name: 'GTP Final Assy Zone', type: 'Assembly', sortOrder: 22 }),
      this.areaRepo.create({ id: 'area-g6-fa',  building: byId.get('gtp-06')!, code: 'G6-FA',  name: 'GTP Final Assy Zone', type: 'Assembly', sortOrder: 23 }),
      this.areaRepo.create({ id: 'area-g7-fa',  building: byId.get('gtp-07')!, code: 'G7-FA',  name: 'GTP Final Assy Zone', type: 'Assembly', sortOrder: 24 }),
      this.areaRepo.create({ id: 'area-g8-fa',  building: byId.get('gtp-08')!, code: 'G8-FA',  name: 'GTP Final Assy Zone', type: 'Assembly', sortOrder: 25 }),
      this.areaRepo.create({ id: 'area-g9-fa',  building: byId.get('gtp-09')!, code: 'G9-FA',  name: 'GTP Final Assy Zone', type: 'Assembly', sortOrder: 26 }),
      this.areaRepo.create({ id: 'area-g10-fa', building: byId.get('gtp-10')!, code: 'G10-FA', name: 'GTP Final Assy Zone', type: 'Assembly', sortOrder: 27 }),
    ]);
    const areaById = new Map(areas.map((a) => [a.id, a]));

    const lines = await this.lineRepo.save([
      this.lineRepo.create({ id: 'line-v1-01', building: byId.get('val-01')!, area: areaById.get('area-v1-asm')!, code: 'L-B1-01', name: 'B1 Line 01', legacyLineNumber: 1, status: 'active', capacityPerShift: 1000, activeShift: 'A', tags: ['assembly'], sortOrder: 10 }),
      this.lineRepo.create({ id: 'line-v1-02', building: byId.get('val-01')!, area: areaById.get('area-v1-asm')!, code: 'L-B1-02', name: 'B1 Line 02', legacyLineNumber: 2, status: 'active', capacityPerShift: 1000, activeShift: 'A', tags: ['assembly'], sortOrder: 11 }),
      this.lineRepo.create({ id: 'line-v2-05', building: byId.get('val-02')!, area: areaById.get('area-v2-smt')!, code: 'L-B2-05', name: 'B2 Line 05', legacyLineNumber: 5, status: 'active', capacityPerShift: 1500, activeShift: 'B', tags: ['smt'], sortOrder: 50 }),
      this.lineRepo.create({ id: 'line-g4-08', building: byId.get('gtp-04')!, area: areaById.get('area-g4-fa')!, code: 'L-B4-08', name: 'B4 Line 08', legacyLineNumber: 8, status: 'active', capacityPerShift: 800, activeShift: 'A', tags: ['final-assembly'], sortOrder: 80 }),
      this.lineRepo.create({ id: 'line-g5-10', building: byId.get('gtp-05')!, area: areaById.get('area-g5-fa')!, code: 'L-B5-10', name: 'B5 Line 10', legacyLineNumber: 10, status: 'active', capacityPerShift: 1200, activeShift: 'A', tags: ['final-assembly'], sortOrder: 100 }),
      this.lineRepo.create({ id: 'line-g6-11', building: byId.get('gtp-06')!, area: areaById.get('area-g6-fa')!, code: 'L-B6-11', name: 'B6 Line 11', legacyLineNumber: 11, status: 'active', capacityPerShift: 900, activeShift: 'C', tags: ['final-assembly'], sortOrder: 110 }),
      this.lineRepo.create({ id: 'line-g7-12', building: byId.get('gtp-07')!, area: areaById.get('area-g7-fa')!, code: 'L-B7-12', name: 'B7 Line 12', legacyLineNumber: 12, status: 'active', capacityPerShift: 900, activeShift: 'C', tags: ['final-assembly'], sortOrder: 120 }),
      this.lineRepo.create({ id: 'line-g8-13', building: byId.get('gtp-08')!, area: areaById.get('area-g8-fa')!, code: 'L-B8-13', name: 'B8 Line 13', legacyLineNumber: 13, status: 'active', capacityPerShift: 900, activeShift: 'C', tags: ['final-assembly'], sortOrder: 130 }),
      this.lineRepo.create({ id: 'line-g9-14', building: byId.get('gtp-09')!, area: areaById.get('area-g9-fa')!, code: 'L-B9-14', name: 'B9 Line 14', legacyLineNumber: 14, status: 'active', capacityPerShift: 900, activeShift: 'C', tags: ['final-assembly'], sortOrder: 140 }),
      this.lineRepo.create({ id: 'line-g10-15', building: byId.get('gtp-10')!, area: areaById.get('area-g10-fa')!, code: 'L-B10-15', name: 'B10 Line 15', legacyLineNumber: 15, status: 'active', capacityPerShift: 900, activeShift: 'C', tags: ['final-assembly'], sortOrder: 150 }),
    ]);

    const stations = lines.flatMap((line) => [1, 2, 3, 4, 5, 6].map((position) =>
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
