import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnterpriseBuilding } from './entities/enterprise-building.entity';
import { EnterpriseCustomer } from './entities/enterprise-customer.entity';
import { EnterpriseProgram } from './entities/enterprise-program.entity';
import { EnterpriseWarehouse } from './entities/enterprise-warehouse.entity';
import { EnterpriseArea } from './entities/enterprise-area.entity';
import { EnterpriseLine } from './entities/enterprise-line.entity';
import { EnterpriseStation } from './entities/enterprise-station.entity';
import { Plan } from '../plans/entities/plan.entity';
import { EnterprisePlanLink } from './entities/enterprise-plan-link.entity';

@Injectable()
export class EnterpriseCampusService implements OnModuleInit {
  constructor(
    @InjectRepository(EnterpriseBuilding)
    private readonly buildingRepo: Repository<EnterpriseBuilding>,
    @InjectRepository(EnterpriseCustomer)
    private readonly customerRepo: Repository<EnterpriseCustomer>,
    @InjectRepository(EnterpriseProgram)
    private readonly programRepo: Repository<EnterpriseProgram>,
    @InjectRepository(EnterpriseWarehouse)
    private readonly warehouseRepo: Repository<EnterpriseWarehouse>,
    @InjectRepository(EnterpriseArea)
    private readonly areaRepo: Repository<EnterpriseArea>,
    @InjectRepository(EnterpriseLine)
    private readonly lineRepo: Repository<EnterpriseLine>,
    @InjectRepository(EnterpriseStation)
    private readonly stationRepo: Repository<EnterpriseStation>,
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
    @InjectRepository(EnterprisePlanLink)
    private readonly planLinkRepo: Repository<EnterprisePlanLink>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      // Force update for this slice to ensure 10 buildings are present
      await this.ensureDimensionSeedData(true);
      await this.ensureTopologySeedData();
      await this.ensurePlanLinkage();
    } catch (err) {
      console.error('[EnterpriseCampusService] Initialization warning:', err.message);
    }
  }

  async listBuildings(): Promise<EnterpriseBuilding[]> {
    return this.buildingRepo.find({ order: { sortOrder: 'ASC' } });
  }

  async getBuildingDetails(id: string): Promise<EnterpriseBuilding | null> {
    return this.buildingRepo.findOne({
      where: { id },
      relations: ['areas', 'areas.lines', 'warehouses', 'programs'],
    });
  }

  async listWarehouses(): Promise<EnterpriseWarehouse[]> {
    return this.warehouseRepo.find({ relations: ['building'], order: { sortOrder: 'ASC' } });
  }

  async listCustomers(): Promise<EnterpriseCustomer[]> {
    return this.customerRepo.find({ order: { name: 'ASC' } });
  }

  async listPrograms(): Promise<EnterpriseProgram[]> {
    return this.programRepo.find({ relations: ['customer', 'dedicatedBuilding'], order: { name: 'ASC' } });
  }

  async listAreas(): Promise<EnterpriseArea[]> {
    return this.areaRepo.find({ relations: ['building'], order: { sortOrder: 'ASC' } });
  }

  async listLines(): Promise<EnterpriseLine[]> {
    return this.lineRepo.find({ relations: ['building', 'area'], order: { sortOrder: 'ASC' } });
  }

  async listStations(lineId?: string): Promise<EnterpriseStation[]> {
    const where = lineId ? { line: { id: lineId } } : {};
    return this.stationRepo.find({ where, relations: ['line'] });
  }

  async getCampusState(): Promise<any> {
    const [buildings, programs, lines] = await Promise.all([
      this.listBuildings(),
      this.listPrograms(),
      this.listLines(),
    ]);
    return {
      buildings: buildings.length,
      programs: programs.length,
      lines: lines.length,
      activeAnomalies: 3,
    };
  }

  async getBuildingStats(id: string): Promise<any> {
    const lines = await this.lineRepo.find({ where: { building: { id } } });
    return {
      activeLines: lines.filter((l) => l.status === 'active').length,
      capacity: lines.reduce((acc, curr) => acc + (curr.capacityPerShift || 0), 0),
      utilization: 0.75, // Placeholder
    };
  }

  async getActiveAnomalies(buildingId?: string): Promise<any[]> {
    // Mock anomalies for the industrial dashboard
    const list = [
      { id: 'an-1', severity: 'critical', area: 'B7 SMT', message: 'Pick-and-place nozzle vacuum low on Line 4', timestamp: new Date() },
      { id: 'an-2', severity: 'warning', area: 'B1 Assembly', message: 'Yield drop on Cisco OPT-200 (94.2%)', timestamp: new Date() },
      { id: 'an-3', severity: 'info', area: 'Nextipac WH', message: 'Material arrival: 5 pallets J&J sensors', timestamp: new Date() },
    ];
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return list.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]).slice(0, 12);
  }

  private async ensureDimensionSeedData(force = false): Promise<void> {
    if (!force && await this.buildingRepo.count() >= 11) return;
    
    console.log('[EnterpriseCampus] Hard Resetting Topology (v2.0.5)...');
    
    // Explicitly delete all to prevent any duplication
    await this.programRepo.createQueryBuilder().delete().execute();
    await this.warehouseRepo.createQueryBuilder().delete().execute();
    await this.areaRepo.createQueryBuilder().delete().execute();
    await this.lineRepo.createQueryBuilder().delete().execute();
    await this.buildingRepo.createQueryBuilder().delete().execute();
    await this.customerRepo.createQueryBuilder().delete().execute();

    // Campus Jabil Guadalajara Topology (GDL1 & GDL2)
    const buildings = await this.buildingRepo.save([
      // GDL1: Valdepeñas
      this.buildingRepo.create({ id: 'b1', code: 'B1', name: 'Valdepeñas B1', status: 'active', tags: ['valdepenas'], sortOrder: 10 }),
      this.buildingRepo.create({ id: 'b2', code: 'B2', name: 'Valdepeñas B2', status: 'active', tags: ['valdepenas'], sortOrder: 11 }),
      
      // GDL2: Technology Park
      this.buildingRepo.create({ id: 'b3', code: 'B3', name: 'GTP B3', status: 'active', tags: ['gtp'], sortOrder: 20 }),
      this.buildingRepo.create({ id: 'b4', code: 'B4', name: 'GTP B4', status: 'active', tags: ['gtp'], sortOrder: 21 }),
      this.buildingRepo.create({ id: 'b5', code: 'B5', name: 'GTP B5', status: 'active', tags: ['gtp'], sortOrder: 22 }),
      this.buildingRepo.create({ id: 'b6', code: 'B6', name: 'GTP B6', status: 'active', tags: ['gtp'], sortOrder: 23 }),
      this.buildingRepo.create({ id: 'b7', code: 'B7', name: 'GTP B7', status: 'active', tags: ['gtp', 'primary'], sortOrder: 24 }),
      this.buildingRepo.create({ id: 'b8', code: 'B8', name: 'GTP B8', status: 'active', tags: ['gtp'], sortOrder: 25 }),
      this.buildingRepo.create({ id: 'b9', code: 'B9', name: 'GTP B9', status: 'active', tags: ['gtp'], sortOrder: 26 }),
      this.buildingRepo.create({ id: 'b10', code: 'B10', name: 'GTP B10', status: 'active', tags: ['gtp'], sortOrder: 27 }),

      // External / General
      this.buildingRepo.create({ id: 'nextipac', code: 'NEXTIPAC', name: 'Almacén General (Nextipac)', status: 'active', tags: ['external', 'storage'], sortOrder: 50 }),
    ]);
    const byId = new Map(buildings.map((building) => [building.id, building]));

    const customers = await this.customerRepo.save([
      this.customerRepo.create({ id: 'cust-cisco', code: 'CSCO', name: 'Cisco Systems', industry: 'Networking', status: 'active' }),
      this.customerRepo.create({ id: 'cust-whirlpool', code: 'WHLP', name: 'Whirlpool', industry: 'Consumer', status: 'active' }),
      this.customerRepo.create({ id: 'cust-electrolux', code: 'ELUX', name: 'Electrolux', industry: 'Consumer', status: 'active' }),
      this.customerRepo.create({ id: 'cust-zebra', code: 'ZBRA', name: 'Zebra Technologies', industry: 'Industrial', status: 'active' }),
      this.customerRepo.create({ id: 'cust-jj', code: 'J&J', name: 'Johnson & Johnson', industry: 'Healthcare', status: 'active' }),
      this.customerRepo.create({ id: 'cust-ethicon', code: 'ETHI', name: 'Ethicon', industry: 'Healthcare', status: 'active' }),
      this.customerRepo.create({ id: 'cust-tesla', code: 'TSLA', name: 'Tesla', industry: 'Automotive', status: 'active' }),
      this.customerRepo.create({ id: 'cust-nokia', code: 'NOK', name: 'Nokia', industry: 'Infrastructure', status: 'active' }),
    ]);
    const customerById = new Map(customers.map((customer) => [customer.id, customer]));

    await this.warehouseRepo.save([
      this.warehouseRepo.create({ id: 'wh-nextipac', code: 'WH-NEXTI', name: 'Nextipac Main Storage', type: 'central', status: 'active', locationCount: 15000, sortOrder: 5, building: byId.get('nextipac') }),
      this.warehouseRepo.create({ id: 'wh-b1', code: 'WH-B1', name: 'Almacén B1', type: 'building', status: 'active', locationCount: 2200, sortOrder: 10, building: byId.get('b1') }),
    ]);

    const programs: any[] = [];
    buildings.forEach(b => {
      if (b.code === 'B7') {
        programs.push(this.programRepo.create({ 
          id: `prog-optics-${b.id}`, 
          customer: customerById.get('cust-cisco')!, 
          code: 'OPTICS', 
          name: 'Optics Project', 
          status: 'active', 
          primaryModelPrefix: 'OPT', 
          dedicatedBuilding: b 
        }));
        programs.push(this.programRepo.create({ 
          id: `prog-gen-${b.id}`, 
          customer: customerById.get('cust-cisco')!, 
          code: 'GEN-07', 
          name: 'Proyecto Genérico', 
          status: 'active', 
          primaryModelPrefix: 'GEN', 
          dedicatedBuilding: b 
        }));
      } else {
        programs.push(this.programRepo.create({ 
          id: `prog-gen1-${b.id}`, 
          customer: customerById.get('cust-cisco')!, 
          code: 'GEN-01', 
          name: 'Proyecto Genérico 1', 
          status: 'active', 
          primaryModelPrefix: 'GEN', 
          dedicatedBuilding: b 
        }));
        programs.push(this.programRepo.create({ 
          id: `prog-gen2-${b.id}`, 
          customer: customerById.get('cust-cisco')!, 
          code: 'GEN-02', 
          name: 'Proyecto Genérico 2', 
          status: 'active', 
          primaryModelPrefix: 'GEN', 
          dedicatedBuilding: b 
        }));
      }
    });

    await this.programRepo.save(programs);
  }

  private async ensureTopologySeedData(): Promise<void> {
    if (await this.areaRepo.count()) return;

    const buildings = await this.listBuildings();
    const byId = new Map(buildings.map((building) => [building.id, building]));

    const areas = await this.areaRepo.save([
      this.areaRepo.create({ id: 'area-b1-asm', building: byId.get('b1')!, code: 'B1-ASM', name: 'B1 Assembly Zone', type: 'Assembly', sortOrder: 10 }),
      this.areaRepo.create({ id: 'area-b2-smt', building: byId.get('b2')!, code: 'B2-SMT', name: 'B2 SMT Zone', type: 'SMT', sortOrder: 10 }),
      this.areaRepo.create({ id: 'area-b3-wh',  building: byId.get('b3')!, code: 'B3-WH',  name: 'B3 Warehouse Zone', type: 'Storage', sortOrder: 20 }),
      this.areaRepo.create({ id: 'area-b7-smt', building: byId.get('b7')!, code: 'B7-SMT', name: 'B7 SMT Zone', type: 'SMT', sortOrder: 10 }),
      this.areaRepo.create({ id: 'area-b7-asm', building: byId.get('b7')!, code: 'B7-ASM', name: 'B7 Assembly Zone', type: 'Assembly', sortOrder: 11 }),
      this.areaRepo.create({ id: 'area-b10-fa', building: byId.get('b10')!, code: 'B10-FA', name: 'B10 Final Assy', type: 'Assembly', sortOrder: 20 }),
    ]);
    const areaById = new Map(areas.map((area) => [area.id, area]));

    const lines = await this.lineRepo.save([
      this.lineRepo.create({ id: 'line-b1-01',  building: byId.get('b1')!, area: areaById.get('area-b1-asm')!, code: 'L-B1-01',  name: 'B1 Line 01',  legacyLineNumber: 1,  status: 'active', capacityPerShift: 120, activeShift: 'A', tags: ['assembly'], sortOrder: 10 }),
      this.lineRepo.create({ id: 'line-b7-04',  building: byId.get('b7')!, area: areaById.get('area-b7-smt')!, code: 'L-B7-04',  name: 'B7 Line 04',  legacyLineNumber: 4,  status: 'active', capacityPerShift: 500, activeShift: 'A', tags: ['smt', 'high-volume'], sortOrder: 40 }),
      this.lineRepo.create({ id: 'line-b7-05',  building: byId.get('b7')!, area: areaById.get('area-b7-asm')!, code: 'L-B7-05',  name: 'B7 Line 05',  legacyLineNumber: 5,  status: 'active', capacityPerShift: 350, activeShift: 'A', tags: ['assembly'], sortOrder: 50 }),
      this.lineRepo.create({ id: 'line-b10-15', building: byId.get('b10')!, area: areaById.get('area-b10-fa')!, code: 'L-B10-15', name: 'B10 Line 15', legacyLineNumber: 15, status: 'active', capacityPerShift: 900, activeShift: 'C', tags: ['final-assembly'], sortOrder: 150 }),
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
    return match ? prefixes.get(match)! : null;
  }
}
