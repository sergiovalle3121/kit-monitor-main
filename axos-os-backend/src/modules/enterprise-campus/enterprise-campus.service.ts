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
  ProgramNode,
  RiskLevel,
  Shift,
  WarehouseNode,
} from './enterprise-campus.types';
import { EnterpriseBuilding } from './entities/enterprise-building.entity';
import { EnterpriseWarehouse } from './entities/enterprise-warehouse.entity';
import { EnterpriseCustomer } from './entities/enterprise-customer.entity';
import { EnterpriseProgram } from './entities/enterprise-program.entity';

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
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureDimensionSeedData();
  }

  async listBuildings() {
    await this.ensureDimensionSeedData();
    return this.buildingRepo.find({ order: { sortOrder: 'ASC', code: 'ASC' } });
  }

  async listWarehouses() {
    await this.ensureDimensionSeedData();
    return this.warehouseRepo.find({
      relations: ['building'],
      order: { sortOrder: 'ASC', code: 'ASC' },
    });
  }

  async listCustomers() {
    await this.ensureDimensionSeedData();
    return this.customerRepo.find({ order: { code: 'ASC' } });
  }

  async listPrograms() {
    await this.ensureDimensionSeedData();
    return this.programRepo.find({ relations: ['customer', 'dedicatedBuilding'], order: { code: 'ASC' } });
  }

  async getCampusState(): Promise<CampusStateResponse> {
    await this.ensureDimensionSeedData();

    const [kits, plans, cancellations, incidents, buildings, warehouses, customers, programs] = await Promise.all([
      this.kitRepo.find({ relations: ['plan'] }),
      this.planRepo.find(),
      this.cancellationRepo.find({ take: 20, order: { createdAt: 'DESC' } }),
      this.incidentRepo.find({ relations: ['kit', 'kit.plan'], take: 30, order: { createdAt: 'DESC' } }),
      this.listBuildings(),
      this.listWarehouses(),
      this.listCustomers(),
      this.listPrograms(),
    ]);

    const buildingByLine = this.buildBuildingByLineMap(buildings);
    const linesByBuilding = this.buildLinesByBuildingMap(buildingByLine);
    const programByModelPrefix = this.buildProgramPrefixMap(programs);
    const currentShift = this.currentShift();

    const buildingNodes = buildings.map((building) => {
      const lines = linesByBuilding.get(building.id) ?? [];
      const lineSet = new Set(lines);
      const buildingPlans = plans.filter((plan) => lineSet.has(plan.line));
      const buildingKits = kits.filter((kit) => lineSet.has(kit.plan?.line ?? -1));
      const activeWOs = buildingPlans.filter((plan) => ['pending', 'active'].includes(plan.status)).length;
      const completed = buildingKits.filter((kit) => kit.status === 'completed').length;
      const shortages = buildingKits.filter((kit) => ['requested', 'ready'].includes(kit.status)).length;
      const activeLines = new Set(buildingPlans.filter((plan) => plan.status === 'active').map((plan) => plan.line)).size;
      const risk: RiskLevel = shortages >= 8 ? 'critical' : shortages >= 4 ? 'at_risk' : 'ok';

      return {
        id: building.id,
        campusId: CAMPUS_ID,
        code: building.code,
        name: building.name,
        status: building.status,
        activeLines,
        totalLines: Math.max(lines.length, 1),
        activeWOs,
        shortages,
        completionPct: Math.round((completed / Math.max(1, buildingKits.length)) * 100),
        currentShift,
        risk,
      };
    });

    const programNodes = this.buildProgramNodes(programs, customers, plans, kits, buildingByLine, programByModelPrefix);
    const customerNodes = this.buildCustomerNodes(customers, programNodes);
    const warehouseNodes = this.buildWarehouseNodes(warehouses, kits);
    const exceptions = this.buildExceptions(cancellations, incidents, kits, buildingByLine, programByModelPrefix);
    const kpis = this.buildKpis(plans, kits, cancellations, exceptions, buildingNodes.length, warehouseNodes.length, programNodes.length);
    const domainHealth = this.buildDomainHealth(kits, cancellations, exceptions, plans);

    return {
      campus: { id: CAMPUS_ID, code: 'JBL-GDL', name: 'Jabil Guadalajara' },
      buildings: buildingNodes,
      warehouses: warehouseNodes,
      customers: customerNodes,
      programs: programNodes,
      kpis,
      exceptions,
      domainHealth,
      lastUpdated: new Date().toISOString(),
      currentShift,
    };
  }

  private buildProgramNodes(
    programs: EnterpriseProgram[],
    customers: EnterpriseCustomer[],
    plans: Plan[],
    kits: Kit[],
    buildingByLine: Map<number, string>,
    programByModelPrefix: Map<string, EnterpriseProgram>,
  ): ProgramNode[] {
    const customerById = new Map(customers.map((customer) => [customer.id, customer]));

    return programs.map((program) => {
      const programPlans = plans.filter((plan) => this.resolveProgramIdForModel(plan.model, programByModelPrefix) === program.id);
      const programKits = kits.filter((kit) => this.resolveProgramIdForModel(kit.plan?.model, programByModelPrefix) === program.id);
      const buildingIds = [...new Set(programPlans.map((plan) => buildingByLine.get(plan.line)).filter(Boolean))] as string[];
      const activeWOs = programPlans.filter((plan) => ['pending', 'active'].includes(plan.status)).length;
      const completedWOs = programKits.filter((kit) => kit.status === 'completed').length;
      const pendingKits = programKits.filter((kit) => ['requested', 'ready', 'kitted'].includes(kit.status)).length;
      const customer = customerById.get(program.customer?.id ?? '');

      return {
        id: program.id,
        customerId: program.customer.id,
        customerName: customer?.name ?? 'Cliente sin nombre',
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
  }

  private buildCustomerNodes(customers: EnterpriseCustomer[], programs: ProgramNode[]): CustomerNode[] {
    return customers.map((customer) => {
      const related = programs.filter((program) => program.customerId === customer.id);
      const hasCritical = related.some((item) => item.risk === 'critical');
      const hasAtRisk = related.some((item) => item.risk === 'at_risk');
      const risk: RiskLevel = hasCritical ? 'critical' : hasAtRisk ? 'at_risk' : 'ok';

      return {
        id: customer.id,
        code: customer.code,
        name: customer.name,
        industry: customer.industry ?? undefined,
        activePrograms: related.length,
        risk,
      };
    });
  }

  private buildWarehouseNodes(warehouses: EnterpriseWarehouse[], kits: Kit[]): WarehouseNode[] {
    const pendingKits = kits.filter((kit) => ['ready', 'requested'].includes(kit.status)).length;
    const inProgressKits = kits.filter((kit) => kit.status === 'in_progress').length;

    return warehouses.map((warehouse) => {
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
  }

  private buildExceptions(
    cancellations: CancellationRequest[],
    incidents: ProductionBayIncident[],
    kits: Kit[],
    buildingByLine: Map<number, string>,
    programByModelPrefix: Map<string, EnterpriseProgram>,
  ): CampusException[] {
    const list: CampusException[] = [];

    for (const cancellation of cancellations.filter((item) => item.status === 'pending').slice(0, 4)) {
      const buildingId = cancellation.publication?.line ? buildingByLine.get(cancellation.publication.line) : undefined;
      const programId = this.resolveProgramIdForModel(cancellation.publication?.model, programByModelPrefix);
      list.push({
        id: `cancel-${cancellation.id}`,
        severity: 'critical',
        domain: 'planning',
        buildingId,
        programId,
        message: `Cancelación pendiente WO ${cancellation.publication?.workOrder ?? 'N/A'}`,
        time: this.formatTime(cancellation.createdAt),
        route: '/plan',
      });
    }

    for (const incident of incidents.filter((item) => item.status === 'open').slice(0, 6)) {
      const line = incident.kit?.plan?.line;
      const buildingId = line ? buildingByLine.get(line) : undefined;
      const programId = this.resolveProgramIdForModel(incident.kit?.plan?.model, programByModelPrefix);
      list.push({
        id: `incident-${incident.id}`,
        severity: 'high',
        domain: 'production',
        buildingId,
        programId,
        message: `${incident.type} · Línea ${line ?? 'N/A'} · Bahía ${incident.bayId}`,
        time: this.formatTime(incident.createdAt),
        route: '/monitor',
      });
    }

    for (const stalled of kits.filter((kit) => kit.status === 'in_progress').slice(0, 3)) {
      const line = stalled.plan?.line;
      const buildingId = line ? buildingByLine.get(line) : undefined;
      const programId = this.resolveProgramIdForModel(stalled.plan?.model, programByModelPrefix);
      list.push({
        id: `stall-${stalled.id}`,
        severity: 'medium',
        domain: 'materials',
        buildingId,
        programId,
        message: `Kit ${stalled.id} en progreso requiere seguimiento de materiales`,
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
    buildingCount: number,
    warehouseCount: number,
    programCount: number,
  ): CampusKpi[] {
    const activeLines = new Set(plans.filter((plan) => plan.status === 'active').map((plan) => plan.line)).size;
    const totalLines = new Set(plans.map((plan) => plan.line)).size || 1;
    const openWOs = plans.filter((plan) => ['pending', 'active'].includes(plan.status)).length;
    const completedWOs = plans.filter((plan) => plan.status === 'completed').length;
    const pendingKits = kits.filter((kit) => ['ready', 'requested', 'kitted'].includes(kit.status)).length;
    const pendingCancel = cancellations.filter((item) => item.status === 'pending').length;

    return [
      { label: 'Edificios Activos', value: buildingCount, sub: `de ${buildingCount} configurados`, risk: 'ok', icon: 'fa-building' },
      { label: 'Líneas en Producción', value: activeLines, sub: `de ${totalLines} total`, risk: activeLines === 0 ? 'at_risk' : 'ok', icon: 'fa-microchip' },
      { label: 'WOs Abiertos', value: openWOs, sub: `${completedWOs} completados`, risk: 'ok', icon: 'fa-file-alt' },
      { label: 'Kits Pendientes', value: pendingKits, sub: 'listos para línea', risk: pendingKits > 15 ? 'at_risk' : 'ok', icon: 'fa-boxes-stacked' },
      { label: 'Excepciones Abiertas', value: exceptions.length, sub: 'campus Guadalajara', risk: exceptions.length > 4 ? 'critical' : exceptions.length > 0 ? 'at_risk' : 'ok', icon: 'fa-triangle-exclamation' },
      { label: 'Cancelaciones', value: pendingCancel, sub: 'requieren respuesta', risk: pendingCancel > 0 ? 'critical' : 'ok', icon: 'fa-ban' },
      { label: 'Programas Activos', value: programCount, sub: 'multi-cliente activos', risk: 'ok', icon: 'fa-calendar-check' },
      { label: 'Almacenes Red', value: warehouseCount, sub: 'central · local · sublínea', risk: 'ok', icon: 'fa-warehouse' },
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

  private async ensureDimensionSeedData(): Promise<void> {
    const buildingCount = await this.buildingRepo.count();
    if (buildingCount > 0) return;

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

  private buildBuildingByLineMap(buildings: EnterpriseBuilding[]): Map<number, string> {
    const sorted = [...buildings].sort((a, b) => a.sortOrder - b.sortOrder);
    const map = new Map<number, string>();
    let line = 1;
    for (const building of sorted) {
      const lineSpan = Math.max(1, building.tags.includes('smt') ? 2 : 3);
      for (let i = 0; i < lineSpan; i++) {
        map.set(line, building.id);
        line += 1;
      }
    }
    return map;
  }

  private buildLinesByBuildingMap(buildingByLine: Map<number, string>): Map<string, number[]> {
    const map = new Map<string, number[]>();
    for (const [line, buildingId] of buildingByLine.entries()) {
      if (!map.has(buildingId)) map.set(buildingId, []);
      map.get(buildingId)!.push(line);
    }
    return map;
  }

  private buildProgramPrefixMap(programs: EnterpriseProgram[]): Map<string, EnterpriseProgram> {
    const map = new Map<string, EnterpriseProgram>();
    for (const program of programs) {
      if (program.primaryModelPrefix) map.set(program.primaryModelPrefix.toUpperCase(), program);
    }
    return map;
  }

  private resolveProgramIdForModel(model: string | undefined | null, prefixMap: Map<string, EnterpriseProgram>): string | undefined {
    if (!model) return undefined;
    const normalized = model.trim().toUpperCase();
    const prefixes = [...prefixMap.keys()].sort((a, b) => b.length - a.length);
    const match = prefixes.find((prefix) => normalized.startsWith(prefix));
    if (!match) return undefined;
    return prefixMap.get(match)?.id;
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
