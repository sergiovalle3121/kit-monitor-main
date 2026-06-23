import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { DockAppointment } from './entities/dock-appointment.entity';
import { TrafficService } from './traffic.service';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
} from './dto/appointment.dto';
import {
  canTransitionAppointment,
  type AppointmentStatus,
} from './traffic-appointment.rules';

/**
 * Dock appointments (Citas de andén) service: the scheduling + gate log layer.
 * Tenant-scoped like the rest of traffic (manual applyScope). Reuses
 * TrafficService finders to validate + denormalize the carrier/unit/driver/dock,
 * and references the outbound shipment by id/folio only (no coupling). The
 * status machine (traffic-appointment.rules) gates the gate-in/out transitions.
 */
@Injectable()
export class TrafficAppointmentsService {
  constructor(
    @InjectRepository(DockAppointment)
    private readonly repo: Repository<DockAppointment>,
    private readonly traffic: TrafficService,
    private readonly tenantCtx: TenantContextService,
  ) {}

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

  list(
    filters: {
      status?: string;
      direction?: string;
      dockId?: string;
      from?: string;
      to?: string;
      q?: string;
    } = {},
  ): Promise<DockAppointment[]> {
    const qb = this.repo
      .createQueryBuilder('a')
      .orderBy('a.scheduled_at', 'ASC');
    this.applyScope(qb, 'a');
    if (filters.status) qb.andWhere('a.status = :s', { s: filters.status });
    if (filters.direction)
      qb.andWhere('a.direction = :d', { d: filters.direction });
    if (filters.dockId) qb.andWhere('a.dock_id = :k', { k: filters.dockId });
    if (filters.from)
      qb.andWhere('a.scheduled_at >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('a.scheduled_at <= :to', { to: filters.to });
    if (filters.q)
      qb.andWhere(
        '(LOWER(a.carrier_name) LIKE :q OR LOWER(a.vehicle_plate) LIKE :q OR LOWER(a.driver_name) LIKE :q OR LOWER(a.shipment_ref) LIKE :q)',
        { q: `%${filters.q.toLowerCase()}%` },
      );
    return qb.getMany();
  }

  async get(id: string): Promise<DockAppointment> {
    const qb = this.repo.createQueryBuilder('a').where('a.id = :id', { id });
    this.applyScope(qb, 'a');
    const found = await qb.getOne();
    if (!found) throw new NotFoundException('Cita no encontrada.');
    return found;
  }

  private stamp(): {
    tenant_id: string | null;
    plant_id: string | null;
    created_by: string;
  } {
    return {
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    };
  }

  /** Resolve + denormalize the assigned pieces onto the appointment (validates existence). */
  private async resolveRefs(
    target: DockAppointment,
    refs: {
      dockId?: string;
      carrierId?: string;
      vehicleId?: string;
      driverId?: string;
    },
  ): Promise<void> {
    if (refs.dockId !== undefined) {
      if (refs.dockId) {
        const k = await this.traffic.getDock(refs.dockId);
        target.dockId = k.id;
        target.dockCode = k.code;
      } else {
        target.dockId = null;
        target.dockCode = null;
      }
    }
    if (refs.carrierId !== undefined) {
      if (refs.carrierId) {
        const c = await this.traffic.getCarrier(refs.carrierId);
        target.carrierId = c.id;
        target.carrierName = c.name;
      } else {
        target.carrierId = null;
        target.carrierName = null;
      }
    }
    if (refs.vehicleId !== undefined) {
      if (refs.vehicleId) {
        const v = await this.traffic.getVehicle(refs.vehicleId);
        target.vehicleId = v.id;
        target.vehiclePlate = v.plate;
      } else {
        target.vehicleId = null;
        target.vehiclePlate = null;
      }
    }
    if (refs.driverId !== undefined) {
      if (refs.driverId) {
        const d = await this.traffic.getDriver(refs.driverId);
        target.driverId = d.id;
        target.driverName = d.name;
      } else {
        target.driverId = null;
        target.driverName = null;
      }
    }
  }

  async create(dto: CreateAppointmentDto): Promise<DockAppointment> {
    const entity = this.repo.create({
      direction: dto.direction ?? 'outbound',
      scheduledAt: new Date(dto.scheduledAt),
      windowEnd: dto.windowEnd ? new Date(dto.windowEnd) : null,
      shipmentRef: dto.shipmentRef ?? null,
      status: 'scheduled',
      arrivedAt: null,
      completedAt: null,
      notes: dto.notes ?? null,
      dockId: null,
      dockCode: null,
      carrierId: null,
      carrierName: null,
      vehicleId: null,
      vehiclePlate: null,
      driverId: null,
      driverName: null,
      ...this.stamp(),
    });
    await this.resolveRefs(entity, dto);
    return this.repo.save(entity);
  }

  async update(
    id: string,
    dto: UpdateAppointmentDto,
  ): Promise<DockAppointment> {
    const a = await this.get(id);
    if (dto.scheduledAt !== undefined)
      a.scheduledAt = new Date(dto.scheduledAt);
    if (dto.windowEnd !== undefined)
      a.windowEnd = dto.windowEnd ? new Date(dto.windowEnd) : null;
    if (dto.direction !== undefined) a.direction = dto.direction;
    if (dto.shipmentRef !== undefined) a.shipmentRef = dto.shipmentRef || null;
    if (dto.notes !== undefined) a.notes = dto.notes || null;
    await this.resolveRefs(a, dto);
    return this.repo.save(a);
  }

  async remove(id: string): Promise<{ ok: true }> {
    const a = await this.get(id);
    await this.repo.softRemove(a);
    return { ok: true };
  }

  /** Gate/scheduling transition with the appointment state machine + timestamps. */
  async setStatus(id: string, to: AppointmentStatus): Promise<DockAppointment> {
    const a = await this.get(id);
    if (a.status === to) return a;
    if (!canTransitionAppointment(a.status, to)) {
      throw new BadRequestException(
        `No se puede mover una cita de ${a.status} a ${to}.`,
      );
    }
    a.status = to;
    if (to === 'arrived' && !a.arrivedAt) a.arrivedAt = new Date();
    if (to === 'completed' && !a.completedAt) a.completedAt = new Date();
    return this.repo.save(a);
  }
}
