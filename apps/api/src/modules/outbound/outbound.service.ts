import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Shipment } from './entities/shipment.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import {
  CreateShipmentDto,
  TransitionShipmentDto,
  UpdateShipmentDto,
} from './dto/outbound.dto';
import { assertTransition, ShipmentStatus } from './shipment-state';

export interface OutboundKpis {
  toShip: number;
  inTransit: number;
  delivered: number;
  overdue: number;
  otdPct: number | null;
  byStatus: Record<ShipmentStatus, number>;
}

@Injectable()
export class OutboundService {
  private readonly logger = new Logger(OutboundService.name);

  constructor(
    @InjectRepository(Shipment)
    private readonly repo: Repository<Shipment>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  private applyScope(
    qb: SelectQueryBuilder<Shipment>,
    alias: string,
  ): SelectQueryBuilder<Shipment> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  async create(dto: CreateShipmentDto): Promise<Shipment> {
    let folio: string | null = null;
    try {
      folio = await this.numbering.allocate('SHIPMENT');
    } catch (err) {
      this.logger.warn(`Folio allocation failed: ${(err as Error)?.message}`);
    }

    const entity = this.repo.create({
      folio,
      title: dto.title,
      customerName: dto.customerName ?? null,
      destination: dto.destination ?? null,
      incoterm: dto.incoterm ?? 'DAP',
      status: 'PACKING',
      carrier: dto.carrier ?? null,
      packageCount: dto.packageCount ?? 0,
      programId: dto.programId ?? null,
      notes: dto.notes ?? null,
      promisedDate: dto.promisedDate ? new Date(dto.promisedDate) : null,
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    });
    const saved = await this.repo.save(entity);
    await this.recordLedger('SHIPMENT_CREATED', saved, { after: saved });
    return saved;
  }

  async list(filters: {
    status?: string;
    customerName?: string;
    programId?: string;
  } = {}): Promise<Shipment[]> {
    const qb = this.repo.createQueryBuilder('s').orderBy('s.created_at', 'DESC');
    this.applyScope(qb, 's');
    if (filters.status) qb.andWhere('s.status = :st', { st: filters.status });
    if (filters.customerName)
      qb.andWhere('s.customer_name = :cn', { cn: filters.customerName });
    if (filters.programId)
      qb.andWhere('s.program_id = :p', { p: filters.programId });
    return qb.getMany();
  }

  async getOne(id: string): Promise<Shipment> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Embarque no encontrado.');
    return found;
  }

  async update(id: string, dto: UpdateShipmentDto): Promise<Shipment> {
    const s = await this.getOne(id);
    Object.assign(s, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.customerName !== undefined && { customerName: dto.customerName }),
      ...(dto.destination !== undefined && { destination: dto.destination }),
      ...(dto.incoterm !== undefined && { incoterm: dto.incoterm }),
      ...(dto.carrier !== undefined && { carrier: dto.carrier }),
      ...(dto.trackingNumber !== undefined && {
        trackingNumber: dto.trackingNumber,
      }),
      ...(dto.packageCount !== undefined && { packageCount: dto.packageCount }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      ...(dto.promisedDate !== undefined && {
        promisedDate: dto.promisedDate ? new Date(dto.promisedDate) : null,
      }),
    });
    const saved = await this.repo.save(s);
    await this.recordLedger('SHIPMENT_UPDATED', saved, { after: saved });
    return saved;
  }

  async transition(
    id: string,
    dto: TransitionShipmentDto,
  ): Promise<Shipment> {
    const s = await this.getOne(id);
    const from = s.status;
    try {
      assertTransition(from, dto.status);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    const now = new Date();
    s.status = dto.status;
    if (dto.carrier) s.carrier = dto.carrier;
    if (dto.trackingNumber) s.trackingNumber = dto.trackingNumber;
    if (dto.status === 'SHIPPED') {
      if (!s.shippedDate) s.shippedDate = now;
      // Generate an ASN folio at ship time (EDI 856 analog).
      if (!s.asn) {
        try {
          s.asn = await this.numbering.allocate('ASN');
        } catch (err) {
          this.logger.warn(`ASN allocation failed: ${(err as Error)?.message}`);
        }
      }
    }
    if (dto.status === 'DELIVERED' && !s.deliveredDate) s.deliveredDate = now;

    const saved = await this.repo.save(s);
    await this.recordLedger('SHIPMENT_TRANSITIONED', saved, {
      before: { status: from },
      after: { status: dto.status },
    });
    return saved;
  }

  async kpis(): Promise<OutboundKpis> {
    const all = await this.list();
    const now = Date.now();
    const byStatus = {
      PACKING: 0,
      READY: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    } as Record<ShipmentStatus, number>;

    let toShip = 0;
    let inTransit = 0;
    let delivered = 0;
    let overdue = 0;
    let otdEligible = 0;
    let otdOnTime = 0;

    for (const s of all) {
      byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
      if (s.status === 'PACKING' || s.status === 'READY') {
        toShip += 1;
        if (s.promisedDate && new Date(s.promisedDate).getTime() < now) {
          overdue += 1;
        }
      }
      if (s.status === 'SHIPPED') inTransit += 1;
      if (s.status === 'DELIVERED') {
        delivered += 1;
        if (s.promisedDate && s.deliveredDate) {
          otdEligible += 1;
          if (
            new Date(s.deliveredDate).getTime() <=
            new Date(s.promisedDate).getTime() + 86_400_000
          ) {
            otdOnTime += 1;
          }
        }
      }
    }

    return {
      toShip,
      inTransit,
      delivered,
      overdue,
      otdPct:
        otdEligible > 0 ? Math.round((otdOnTime / otdEligible) * 1000) / 10 : null,
      byStatus,
    };
  }

  private async recordLedger(
    action: string,
    s: Shipment,
    states: { before?: unknown; after?: unknown },
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.SHIPPING,
        action,
        referenceType: 'SHIPMENT',
        referenceId: s.id,
        program: s.programId ?? undefined,
        plant: s.plant_id ?? undefined,
        metadata: {
          folio: s.folio,
          asn: s.asn,
          customer: s.customerName,
          beforeState: states.before,
          afterState: states.after,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Ledger write skipped for ${action}: ${(err as Error)?.message}`,
      );
    }
  }
}
