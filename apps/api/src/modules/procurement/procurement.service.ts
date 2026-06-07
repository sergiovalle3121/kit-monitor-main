import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import {
  CreatePurchaseOrderDto,
  TransitionPurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from './dto/procurement.dto';
import { assertTransition, PurchaseOrderStatus } from './po-state';

export interface ProcurementKpis {
  open: number;
  awaitingReceipt: number;
  overdue: number;
  received: number;
  committedValue: number;
  otdPct: number | null;
  currency: string;
  byStatus: Record<PurchaseOrderStatus, number>;
}

const OPEN_STATES: PurchaseOrderStatus[] = ['DRAFT', 'ISSUED', 'ACKNOWLEDGED'];

@Injectable()
export class ProcurementService {
  private readonly logger = new Logger(ProcurementService.name);

  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly repo: Repository<PurchaseOrder>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  private applyScope(
    qb: SelectQueryBuilder<PurchaseOrder>,
    alias: string,
  ): SelectQueryBuilder<PurchaseOrder> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  async create(dto: CreatePurchaseOrderDto): Promise<PurchaseOrder> {
    let folio: string | null = null;
    try {
      folio = await this.numbering.allocate('PURCHASE_ORDER');
    } catch (err) {
      this.logger.warn(`Folio allocation failed: ${(err as Error)?.message}`);
    }

    const entity = this.repo.create({
      folio,
      title: dto.title,
      supplierName: dto.supplierName ?? null,
      supplierId: dto.supplierId ?? null,
      status: 'DRAFT',
      priority: dto.priority ?? 'MEDIUM',
      totalValue: dto.totalValue ?? 0,
      currency: (dto.currency ?? 'USD').toUpperCase(),
      buyer: this.tenantCtx.getUserEmail(),
      programId: dto.programId ?? null,
      notes: dto.notes ?? null,
      requiredDate: dto.requiredDate ? new Date(dto.requiredDate) : null,
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    });
    const saved = await this.repo.save(entity);
    await this.recordLedger('PURCHASE_ORDER_CREATED', saved, { after: saved });
    return saved;
  }

  async list(filters: {
    status?: string;
    supplierName?: string;
    programId?: string;
  } = {}): Promise<PurchaseOrder[]> {
    const qb = this.repo.createQueryBuilder('po').orderBy('po.created_at', 'DESC');
    this.applyScope(qb, 'po');
    if (filters.status) qb.andWhere('po.status = :s', { s: filters.status });
    if (filters.supplierName)
      qb.andWhere('po.supplier_name = :sn', { sn: filters.supplierName });
    if (filters.programId)
      qb.andWhere('po.program_id = :p', { p: filters.programId });
    return qb.getMany();
  }

  async getOne(id: string): Promise<PurchaseOrder> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Orden de compra no encontrada.');
    return found;
  }

  async update(
    id: string,
    dto: UpdatePurchaseOrderDto,
  ): Promise<PurchaseOrder> {
    const po = await this.getOne(id);
    Object.assign(po, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.supplierName !== undefined && { supplierName: dto.supplierName }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
      ...(dto.totalValue !== undefined && { totalValue: dto.totalValue }),
      ...(dto.currency !== undefined && { currency: dto.currency.toUpperCase() }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      ...(dto.requiredDate !== undefined && {
        requiredDate: dto.requiredDate ? new Date(dto.requiredDate) : null,
      }),
      ...(dto.promisedDate !== undefined && {
        promisedDate: dto.promisedDate ? new Date(dto.promisedDate) : null,
      }),
    });
    const saved = await this.repo.save(po);
    await this.recordLedger('PURCHASE_ORDER_UPDATED', saved, { after: saved });
    return saved;
  }

  async transition(
    id: string,
    dto: TransitionPurchaseOrderDto,
  ): Promise<PurchaseOrder> {
    const po = await this.getOne(id);
    const from = po.status;
    try {
      assertTransition(from, dto.status);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    const now = new Date();
    po.status = dto.status;
    if (dto.status === 'ISSUED' && !po.issuedAt) po.issuedAt = now;
    if (dto.status === 'ACKNOWLEDGED' && dto.promisedDate)
      po.promisedDate = new Date(dto.promisedDate);
    if (dto.status === 'RECEIVED' && !po.receivedDate) po.receivedDate = now;

    const saved = await this.repo.save(po);
    await this.recordLedger('PURCHASE_ORDER_TRANSITIONED', saved, {
      before: { status: from },
      after: { status: dto.status },
    });
    return saved;
  }

  async kpis(): Promise<ProcurementKpis> {
    const all = await this.list();
    const now = Date.now();
    const byStatus = {
      DRAFT: 0,
      ISSUED: 0,
      ACKNOWLEDGED: 0,
      RECEIVED: 0,
      CLOSED: 0,
      CANCELLED: 0,
    } as Record<PurchaseOrderStatus, number>;

    let open = 0;
    let awaitingReceipt = 0;
    let overdue = 0;
    let received = 0;
    let committedValue = 0;
    let currency = 'USD';
    let otdEligible = 0;
    let otdOnTime = 0;

    for (const po of all) {
      byStatus[po.status] = (byStatus[po.status] ?? 0) + 1;
      if (po.currency) currency = po.currency;
      const isOpen = OPEN_STATES.includes(po.status);
      if (isOpen) {
        open += 1;
        committedValue += Number(po.totalValue ?? 0);
      }
      if (po.status === 'ISSUED' || po.status === 'ACKNOWLEDGED') {
        awaitingReceipt += 1;
        if (po.requiredDate && new Date(po.requiredDate).getTime() < now) {
          overdue += 1;
        }
      }
      if (po.status === 'RECEIVED' || po.status === 'CLOSED') {
        received += 1;
        // OTD: received on/before promised (or required) date.
        const target = po.promisedDate ?? po.requiredDate;
        if (target && po.receivedDate) {
          otdEligible += 1;
          if (
            new Date(po.receivedDate).getTime() <=
            new Date(target).getTime() + 86_400_000 // grace: same day
          ) {
            otdOnTime += 1;
          }
        }
      }
    }

    return {
      open,
      awaitingReceipt,
      overdue,
      received,
      committedValue,
      otdPct:
        otdEligible > 0 ? Math.round((otdOnTime / otdEligible) * 1000) / 10 : null,
      currency,
      byStatus,
    };
  }

  private async recordLedger(
    action: string,
    po: PurchaseOrder,
    states: { before?: unknown; after?: unknown },
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.MATERIALS,
        action,
        referenceType: 'PURCHASE_ORDER',
        referenceId: po.id,
        program: po.programId ?? undefined,
        plant: po.plant_id ?? undefined,
        metadata: {
          folio: po.folio,
          supplier: po.supplierName,
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
