import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { Carrier } from './entities/carrier.entity';
import { Vehicle } from './entities/vehicle.entity';
import { Driver } from './entities/driver.entity';
import { LoadingDock } from './entities/loading-dock.entity';
import {
  CreateCarrierDto,
  CreateDockDto,
  CreateDriverDto,
  CreateVehicleDto,
  UpdateCarrierDto,
  UpdateDockDto,
  UpdateDriverDto,
  UpdateVehicleDto,
} from './dto/traffic.dto';
import type {
  DockStatus,
  DriverStatus,
  VehicleStatus,
} from './traffic.rules';

/**
 * Traffic (Tráfico) master-data service: carriers, vehicles, drivers and loading
 * docks. Tenant-scoped exactly like the outbound spine (manual applyScope), codes
 * unique within scope. Exposes finders + status setters the OutboundService uses
 * to assign transport to a shipment (the assignment poka-yoke).
 */
@Injectable()
export class TrafficService {
  constructor(
    @InjectRepository(Carrier) private readonly carriers: Repository<Carrier>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(LoadingDock) private readonly docks: Repository<LoadingDock>,
    private readonly tenantCtx: TenantContextService,
  ) {}

  // ── Tenant scope (mirror of OutboundService.applyScope) ────────────────────
  private applyScope<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
  ): SelectQueryBuilder<T> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  private stamp(): { tenant_id: string | null; plant_id: string | null; created_by: string } {
    return {
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    };
  }

  private async assertUnique<T extends ObjectLiteral>(
    repo: Repository<T>,
    field: string,
    value: string,
    label: string,
    excludeId?: string,
  ): Promise<void> {
    const qb = repo.createQueryBuilder('e').where(`e.${field} = :value`, { value });
    this.applyScope(qb, 'e');
    if (excludeId) qb.andWhere('e.id != :id', { id: excludeId });
    if (await qb.getExists()) {
      throw new BadRequestException(`Ya existe ${label} con ese valor (${value}).`);
    }
  }

  // ── Carriers ───────────────────────────────────────────────────────────────
  listCarriers(filters: { q?: string; status?: string } = {}): Promise<Carrier[]> {
    const qb = this.carriers.createQueryBuilder('c').orderBy('c.code', 'ASC');
    this.applyScope(qb, 'c');
    if (filters.status) qb.andWhere('c.status = :s', { s: filters.status });
    if (filters.q)
      qb.andWhere('(LOWER(c.code) LIKE :q OR LOWER(c.name) LIKE :q)', {
        q: `%${filters.q.toLowerCase()}%`,
      });
    return qb.getMany();
  }

  async getCarrier(id: string): Promise<Carrier> {
    const qb = this.carriers.createQueryBuilder('c').where('c.id = :id', { id });
    this.applyScope(qb, 'c');
    const found = await qb.getOne();
    if (!found) throw new NotFoundException('Transportista no encontrado.');
    return found;
  }

  async createCarrier(dto: CreateCarrierDto): Promise<Carrier> {
    await this.assertUnique(this.carriers, 'code', dto.code, 'un transportista');
    const entity = this.carriers.create({
      code: dto.code,
      name: dto.name,
      mode: dto.mode ?? 'GROUND',
      scac: dto.scac ?? null,
      taxId: dto.taxId ?? null,
      contactName: dto.contactName ?? null,
      contactPhone: dto.contactPhone ?? null,
      contactEmail: dto.contactEmail ?? null,
      status: 'active',
      notes: dto.notes ?? null,
      ...this.stamp(),
    });
    return this.carriers.save(entity);
  }

  async updateCarrier(id: string, dto: UpdateCarrierDto): Promise<Carrier> {
    const c = await this.getCarrier(id);
    Object.assign(c, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.mode !== undefined && { mode: dto.mode }),
      ...(dto.scac !== undefined && { scac: dto.scac || null }),
      ...(dto.taxId !== undefined && { taxId: dto.taxId || null }),
      ...(dto.contactName !== undefined && { contactName: dto.contactName || null }),
      ...(dto.contactPhone !== undefined && { contactPhone: dto.contactPhone || null }),
      ...(dto.contactEmail !== undefined && { contactEmail: dto.contactEmail || null }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.notes !== undefined && { notes: dto.notes || null }),
    });
    return this.carriers.save(c);
  }

  async removeCarrier(id: string): Promise<{ ok: true }> {
    const c = await this.getCarrier(id);
    await this.carriers.softRemove(c);
    return { ok: true };
  }

  // ── Vehicles ───────────────────────────────────────────────────────────────
  listVehicles(
    filters: { q?: string; status?: string; type?: string; carrierId?: string } = {},
  ): Promise<Vehicle[]> {
    const qb = this.vehicles.createQueryBuilder('v').orderBy('v.plate', 'ASC');
    this.applyScope(qb, 'v');
    if (filters.status) qb.andWhere('v.status = :s', { s: filters.status });
    if (filters.type) qb.andWhere('v.type = :t', { t: filters.type });
    if (filters.carrierId) qb.andWhere('v.carrier_id = :cid', { cid: filters.carrierId });
    if (filters.q)
      qb.andWhere('(LOWER(v.plate) LIKE :q OR LOWER(v.economic_number) LIKE :q)', {
        q: `%${filters.q.toLowerCase()}%`,
      });
    return qb.getMany();
  }

  async getVehicle(id: string): Promise<Vehicle> {
    const qb = this.vehicles.createQueryBuilder('v').where('v.id = :id', { id });
    this.applyScope(qb, 'v');
    const found = await qb.getOne();
    if (!found) throw new NotFoundException('Unidad no encontrada.');
    return found;
  }

  async createVehicle(dto: CreateVehicleDto): Promise<Vehicle> {
    await this.assertUnique(this.vehicles, 'plate', dto.plate, 'una unidad');
    const carrierName = dto.carrierId ? (await this.getCarrier(dto.carrierId)).name : null;
    const entity = this.vehicles.create({
      plate: dto.plate,
      type: dto.type ?? 'DRY_VAN',
      economicNumber: dto.economicNumber ?? null,
      carrierId: dto.carrierId ?? null,
      carrierName,
      maxWeightKg: dto.maxWeightKg ?? null,
      maxVolumeM3: dto.maxVolumeM3 ?? null,
      vin: dto.vin ?? null,
      status: 'available',
      notes: dto.notes ?? null,
      ...this.stamp(),
    });
    return this.vehicles.save(entity);
  }

  async updateVehicle(id: string, dto: UpdateVehicleDto): Promise<Vehicle> {
    const v = await this.getVehicle(id);
    if (dto.plate !== undefined && dto.plate !== v.plate) {
      await this.assertUnique(this.vehicles, 'plate', dto.plate, 'una unidad', id);
    }
    let carrierName = v.carrierName;
    if (dto.carrierId !== undefined) {
      carrierName = dto.carrierId ? (await this.getCarrier(dto.carrierId)).name : null;
    }
    Object.assign(v, {
      ...(dto.plate !== undefined && { plate: dto.plate }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.economicNumber !== undefined && { economicNumber: dto.economicNumber || null }),
      ...(dto.carrierId !== undefined && { carrierId: dto.carrierId || null, carrierName }),
      ...(dto.maxWeightKg !== undefined && { maxWeightKg: dto.maxWeightKg }),
      ...(dto.maxVolumeM3 !== undefined && { maxVolumeM3: dto.maxVolumeM3 }),
      ...(dto.vin !== undefined && { vin: dto.vin || null }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.notes !== undefined && { notes: dto.notes || null }),
    });
    return this.vehicles.save(v);
  }

  async removeVehicle(id: string): Promise<{ ok: true }> {
    const v = await this.getVehicle(id);
    await this.vehicles.softRemove(v);
    return { ok: true };
  }

  async setVehicleStatus(id: string, status: VehicleStatus): Promise<Vehicle> {
    const v = await this.getVehicle(id);
    v.status = status;
    return this.vehicles.save(v);
  }

  // ── Drivers ────────────────────────────────────────────────────────────────
  listDrivers(
    filters: { q?: string; status?: string; carrierId?: string } = {},
  ): Promise<Driver[]> {
    const qb = this.drivers.createQueryBuilder('d').orderBy('d.name', 'ASC');
    this.applyScope(qb, 'd');
    if (filters.status) qb.andWhere('d.status = :s', { s: filters.status });
    if (filters.carrierId) qb.andWhere('d.carrier_id = :cid', { cid: filters.carrierId });
    if (filters.q)
      qb.andWhere('(LOWER(d.name) LIKE :q OR LOWER(d.license_number) LIKE :q)', {
        q: `%${filters.q.toLowerCase()}%`,
      });
    return qb.getMany();
  }

  async getDriver(id: string): Promise<Driver> {
    const qb = this.drivers.createQueryBuilder('d').where('d.id = :id', { id });
    this.applyScope(qb, 'd');
    const found = await qb.getOne();
    if (!found) throw new NotFoundException('Chofer no encontrado.');
    return found;
  }

  async createDriver(dto: CreateDriverDto): Promise<Driver> {
    const carrierName = dto.carrierId ? (await this.getCarrier(dto.carrierId)).name : null;
    const entity = this.drivers.create({
      name: dto.name,
      licenseNumber: dto.licenseNumber ?? null,
      licenseType: dto.licenseType ?? null,
      phone: dto.phone ?? null,
      idDocument: dto.idDocument ?? null,
      carrierId: dto.carrierId ?? null,
      carrierName,
      status: 'available',
      notes: dto.notes ?? null,
      ...this.stamp(),
    });
    return this.drivers.save(entity);
  }

  async updateDriver(id: string, dto: UpdateDriverDto): Promise<Driver> {
    const d = await this.getDriver(id);
    let carrierName = d.carrierName;
    if (dto.carrierId !== undefined) {
      carrierName = dto.carrierId ? (await this.getCarrier(dto.carrierId)).name : null;
    }
    Object.assign(d, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.licenseNumber !== undefined && { licenseNumber: dto.licenseNumber || null }),
      ...(dto.licenseType !== undefined && { licenseType: dto.licenseType || null }),
      ...(dto.phone !== undefined && { phone: dto.phone || null }),
      ...(dto.idDocument !== undefined && { idDocument: dto.idDocument || null }),
      ...(dto.carrierId !== undefined && { carrierId: dto.carrierId || null, carrierName }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.notes !== undefined && { notes: dto.notes || null }),
    });
    return this.drivers.save(d);
  }

  async removeDriver(id: string): Promise<{ ok: true }> {
    const d = await this.getDriver(id);
    await this.drivers.softRemove(d);
    return { ok: true };
  }

  async setDriverStatus(id: string, status: DriverStatus): Promise<Driver> {
    const d = await this.getDriver(id);
    d.status = status;
    return this.drivers.save(d);
  }

  // ── Loading docks ──────────────────────────────────────────────────────────
  listDocks(
    filters: { q?: string; status?: string; type?: string } = {},
  ): Promise<LoadingDock[]> {
    const qb = this.docks.createQueryBuilder('k').orderBy('k.code', 'ASC');
    this.applyScope(qb, 'k');
    if (filters.status) qb.andWhere('k.status = :s', { s: filters.status });
    if (filters.type) qb.andWhere('k.type = :t', { t: filters.type });
    if (filters.q)
      qb.andWhere('(LOWER(k.code) LIKE :q OR LOWER(k.name) LIKE :q)', {
        q: `%${filters.q.toLowerCase()}%`,
      });
    return qb.getMany();
  }

  async getDock(id: string): Promise<LoadingDock> {
    const qb = this.docks.createQueryBuilder('k').where('k.id = :id', { id });
    this.applyScope(qb, 'k');
    const found = await qb.getOne();
    if (!found) throw new NotFoundException('Andén no encontrado.');
    return found;
  }

  async createDock(dto: CreateDockDto): Promise<LoadingDock> {
    await this.assertUnique(this.docks, 'code', dto.code, 'un andén');
    const entity = this.docks.create({
      code: dto.code,
      name: dto.name ?? null,
      type: dto.type ?? 'shipping',
      buildingId: dto.buildingId ?? null,
      buildingName: dto.buildingName ?? null,
      status: 'available',
      notes: dto.notes ?? null,
      ...this.stamp(),
    });
    return this.docks.save(entity);
  }

  async updateDock(id: string, dto: UpdateDockDto): Promise<LoadingDock> {
    const k = await this.getDock(id);
    Object.assign(k, {
      ...(dto.name !== undefined && { name: dto.name || null }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.buildingId !== undefined && { buildingId: dto.buildingId || null }),
      ...(dto.buildingName !== undefined && { buildingName: dto.buildingName || null }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.notes !== undefined && { notes: dto.notes || null }),
    });
    return this.docks.save(k);
  }

  async removeDock(id: string): Promise<{ ok: true }> {
    const k = await this.getDock(id);
    await this.docks.softRemove(k);
    return { ok: true };
  }

  async setDockStatus(id: string, status: DockStatus): Promise<LoadingDock> {
    const k = await this.getDock(id);
    k.status = status;
    return this.docks.save(k);
  }
}
