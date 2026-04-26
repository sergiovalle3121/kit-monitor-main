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
    const list = [
      { id: 'an-1', severity: 'critical', area: 'B7 SMT', message: 'Pick-and-place nozzle vacuum low on Line 4', timestamp: new Date() },
      { id: 'an-2', severity: 'warning', area: 'B1 Assembly', message: 'Yield drop on Product OPT-200 (94.2%)', timestamp: new Date() },
      { id: 'an-3', severity: 'info', area: 'External WH', message: 'Material arrival: 5 pallets sensor assemblies', timestamp: new Date() },
    ];
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return list.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]).slice(0, 12);
  }

  private async ensureDimensionSeedData(force = false): Promise<void> {
    if (!force && await this.buildingRepo.count() >= 11) return;
    
    console.log('[EnterpriseCampus] SURGICAL HARD RESET (v2.0.5)...');
    
    // Explicitly delete in order to satisfy foreign keys
    await this.planLinkRepo.createQueryBuilder().delete().execute();
    await this.stationRepo.createQueryBuilder().delete().execute();
    await this.lineRepo.createQueryBuilder().delete().execute();
    await this.areaRepo.createQueryBuilder().delete().execute();
    await this.programRepo.createQueryBuilder().delete().execute();
    await this.warehouseRepo.createQueryBuilder().delete().execute();
    await this.buildingRepo.createQueryBuilder().delete().execute();
    await this.customerRepo.createQueryBuilder().delete().execute();

    // Default white-label campus topology
    const buildings = await this.buildingRepo.save([
      // GDL1: Valdepeñas
      this.buildingRepo.create({ id: 'b1', code: 'B1', name: 'Valdepeñas B1', status: 'active', tags: ['valdepenas'], sortOrder: 10 }),
      this.buildingRepo.create({ id: 'b2', code: 'B2', name: 'Valdepeñas B2', status: 'active', tags: ['valdepenas'], sortOrder: 11 }),
      
      // Site B
      this.buildingRepo.create({ id: 'b3', code: 'B3', name: 'Advanced Manufacturing B3', status: 'active', tags: ['site-b'], sortOrder: 20 }),
      this.buildingRepo.create({ id: 'b4', code: 'B4', name: 'Advanced Manufacturing B4', status: 'active', tags: ['site-b'], sortOrder: 21 }),
      this.buildingRepo.create({ id: 'b5', code: 'B5', name: 'Advanced Manufacturing B5', status: 'active', tags: ['site-b'], sortOrder: 22 }),
      this.buildingRepo.create({ id: 'b6', code: 'B6', name: 'Advanced Manufacturing B6', status: 'active', tags: ['site-b'], sortOrder: 23 }),
      this.buildingRepo.create({ id: 'b7', code: 'B7', name: 'Advanced Manufacturing B7', status: 'active', tags: ['site-b', 'primary'], sortOrder: 24 }),
      this.buildingRepo.create({ id: 'b8', code: 'B8', name: 'Advanced Manufacturing B8', status: 'active', tags: ['site-b'], sortOrder: 25 }),
      this.buildingRepo.create({ id: 'b9', code: 'B9', name: 'Advanced Manufacturing B9', status: 'active', tags: ['site-b'], sortOrder: 26 }),
      this.buildingRepo.create({ id: 'b10', code: 'B10', name: 'Advanced Manufacturing B10', status: 'active', tags: ['site-b'], sortOrder: 27 }),

      // External / General
      this.buildingRepo.create({ id: 'nextipac', code: 'NEXTIPAC', name: 'Almacén General (Nextipac)', status: 'active', tags: ['external', 'storage'], sortOrder: 50 }),
    ]);
    const customerById = new Map((await this.customerRepo.save([
      this.customerRepo.create({ id: 'cust-cisco', code: 'CSCO', name: 'Cisco Systems', industry: 'Networking', status: 'active' }),
      this.customerRepo.create({ id: 'cust-zebra', code: 'ZBRA', name: 'Zebra Technologies', industry: 'Industrial', status: 'active' }),
    ])).map(c => [c.id, c]));

    const programs: any[] = [];
    buildings.forEach(b => {
      if (b.code === 'B7') {
        programs.push(this.programRepo.create({ 
          id: `prog-optics-${b.id}`, 
          customer: customerById.get('cust-cisco')!, 
          code: `OPT-${b.id}`, 
          name: 'Optics Project', 
          status: 'active', 
          primaryModelPrefix: 'OPT', 
          dedicatedBuilding: b 
        }));
        programs.push(this.programRepo.create({ 
          id: `prog-gen-${b.id}`, 
          customer: customerById.get('cust-cisco')!, 
          code: `GEN-${b.id}`, 
          name: 'Proyecto Genérico', 
          status: 'active', 
          primaryModelPrefix: 'GEN', 
          dedicatedBuilding: b 
        }));
      } else {
        programs.push(this.programRepo.create({ 
          id: `prog-gen1-${b.id}`, 
          customer: customerById.get('cust-cisco')!, 
          code: `G1-${b.id}`, 
          name: 'Proyecto Genérico 1', 
          status: 'active', 
          primaryModelPrefix: 'GEN', 
          dedicatedBuilding: b 
        }));
        programs.push(this.programRepo.create({ 
          id: `prog-gen2-${b.id}`, 
          customer: customerById.get('cust-cisco')!, 
          code: `G2-${b.id}`, 
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
      this.areaRepo.create({ id: 'area-b7-smt', building: byId.get('b7')!, code: 'B7-SMT', name: 'B7 SMT Zone', type: 'SMT', sortOrder: 10 }),
      this.areaRepo.create({ id: 'area-b7-asm', building: byId.get('b7')!, code: 'B7-ASM', name: 'B7 Assembly Zone', type: 'Assembly', sortOrder: 11 }),
    ]);
    const areaById = new Map(areas.map((area) => [area.id, area]));
    const lines = await this.lineRepo.save([
      this.lineRepo.create({ id: 'line-b7-04', building: byId.get('b7')!, area: areaById.get('area-b7-smt')!, code: 'L-B7-04', name: 'B7 Line 04', legacyLineNumber: 4, status: 'active', capacityPerShift: 500, activeShift: 'A', tags: ['smt'], sortOrder: 40 }),
    ]);
    await this.stationRepo.save(lines.flatMap(l => [1,2].map(p => this.stationRepo.create({ id: `st-${l.id}-${p}`, line: l, code: `${l.code}-B${p}`, position: p, status: 'active' }))));
  }

  private async ensurePlanLinkage(): Promise<void> {
    // Basic plan linkage skip logic for seed stability
  }
}
