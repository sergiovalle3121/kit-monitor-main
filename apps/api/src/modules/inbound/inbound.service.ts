import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Receipt } from './entities/receipt.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import { CreateReceiptDto, TransitionReceiptDto } from './dto/inbound.dto';
import { assertTransition, ReceiptStatus } from './receipt-state';
import { InventoryService } from '../inventory/inventory.service';

export interface InboundKpis {
  total: number;
  pendingIqc: number;
  inQuarantine: number;
  released: number;
  rejected: number;
  rejectRatePct: number | null;
  dockToStockAvgHours: number | null;
  byStatus: Record<ReceiptStatus, number>;
}

@Injectable()
export class InboundService {
  private readonly logger = new Logger(InboundService.name);

  constructor(
    @InjectRepository(Receipt)
    private readonly repo: Repository<Receipt>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
    @Optional() private readonly ledger?: EventLedgerService,
    @Optional() private readonly inventory?: InventoryService,
  ) {}

  private applyScope(
    qb: SelectQueryBuilder<Receipt>,
    alias: string,
  ): SelectQueryBuilder<Receipt> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  async create(dto: CreateReceiptDto): Promise<Receipt> {
    let folio: string | null = null;
    try {
      folio = await this.numbering.allocate('RECEIPT');
    } catch (err) {
      this.logger.warn(`Folio allocation failed: ${(err as Error)?.message}`);
    }

    const entity = this.repo.create({
      folio,
      supplierName: dto.supplierName ?? null,
      poFolio: dto.poFolio ?? null,
      partNumber: dto.partNumber,
      description: dto.description ?? null,
      quantity: dto.quantity ?? 0,
      uom: (dto.uom ?? 'PCS').toUpperCase(),
      lotNumber: dto.lotNumber ?? null,
      serialNumber: dto.serialNumber ?? null,
      dateCode: dto.dateCode ?? null,
      status: 'RECEIVED',
      iqcResult: null,
      receivedBy: this.tenantCtx.getUserEmail(),
      programId: dto.programId ?? null,
      warehouseId: dto.warehouseId ?? 'WH-RAW',
      location: dto.location ?? null,
      inventoryPosted: false,
      receivedAt: new Date(),
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    });
    const saved = await this.repo.save(entity);
    await this.recordLedger('RECEIPT_CREATED', saved, { after: saved });
    return saved;
  }

  async list(filters: {
    status?: string;
    partNumber?: string;
    poFolio?: string;
  } = {}): Promise<Receipt[]> {
    const qb = this.repo.createQueryBuilder('r').orderBy('r.received_at', 'DESC');
    this.applyScope(qb, 'r');
    if (filters.status) qb.andWhere('r.status = :s', { s: filters.status });
    if (filters.partNumber)
      qb.andWhere('r.part_number = :pn', { pn: filters.partNumber });
    if (filters.poFolio) qb.andWhere('r.po_folio = :po', { po: filters.poFolio });
    return qb.getMany();
  }

  async getOne(id: string): Promise<Receipt> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Recibo no encontrado.');
    return found;
  }

  async transition(id: string, dto: TransitionReceiptDto): Promise<Receipt> {
    const r = await this.getOne(id);
    const from = r.status;
    try {
      assertTransition(from, dto.status);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    const now = new Date();
    r.status = dto.status;
    if (dto.rejectCode) r.rejectCode = dto.rejectCode;
    if (dto.status === 'QUARANTINE') r.iqcResult = 'FAIL';
    if (dto.status === 'REJECTED') r.iqcResult = 'FAIL';
    if (dto.status === 'RELEASED') {
      if (from === 'INSPECTING' || from === 'RECEIVED') r.iqcResult = 'PASS';
      if (!r.releasedAt) r.releasedAt = now;
      // IQC gate: only RELEASED material is put away into available inventory.
      await this.putaway(r);
    }

    const saved = await this.repo.save(r);
    await this.recordLedger('RECEIPT_TRANSITIONED', saved, {
      before: { status: from },
      after: { status: dto.status },
    });
    return saved;
  }

  /**
   * Put away a released receipt into available inventory (best-effort, idempotent).
   * Receiving raises stock — the mirror of the outbound goods-issue. QUARANTINE /
   * REJECTED never reach here, so only IQC-passed material becomes available.
   */
  private async putaway(r: Receipt): Promise<void> {
    if (!this.inventory || r.inventoryPosted || !(r.quantity > 0)) return;
    try {
      await this.inventory.ensureMaterial({
        partNumber: r.partNumber,
        description: r.description ?? undefined,
      });
      await this.inventory.recordTransaction({
        type: 'RECEIVE',
        partNumber: r.partNumber,
        quantity: r.quantity,
        toWarehouseId: r.warehouseId || 'WH-RAW',
        toLocation: r.location || 'BULK',
        actorName: this.tenantCtx.getUserEmail() ?? 'Inbound',
        holdStatus: 'available',
        lotNumber: r.lotNumber ?? undefined,
        serialNumber: r.serialNumber ?? undefined,
        referenceType: 'INBOUND_RECEIPT',
        referenceId: r.folio ?? r.id,
        reason: `Putaway recibo ${r.folio ?? r.id}`,
      });
      r.inventoryPosted = true;
    } catch (err) {
      this.logger.warn(
        `Putaway skipped for ${r.partNumber} (${r.id}): ${(err as Error)?.message}`,
      );
    }
  }

  async kpis(): Promise<InboundKpis> {
    const all = await this.list();
    const byStatus = {
      RECEIVED: 0,
      INSPECTING: 0,
      RELEASED: 0,
      QUARANTINE: 0,
      REJECTED: 0,
    } as Record<ReceiptStatus, number>;

    let dtsSum = 0;
    let dtsCount = 0;

    for (const r of all) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      if (r.status === 'RELEASED' && r.releasedAt && r.receivedAt) {
        const hrs =
          (new Date(r.releasedAt).getTime() - new Date(r.receivedAt).getTime()) /
          3_600_000;
        if (hrs >= 0) {
          dtsSum += hrs;
          dtsCount += 1;
        }
      }
    }

    const released = byStatus.RELEASED;
    const rejected = byStatus.REJECTED;
    const dispositioned = released + rejected;

    return {
      total: all.length,
      pendingIqc: byStatus.RECEIVED + byStatus.INSPECTING,
      inQuarantine: byStatus.QUARANTINE,
      released,
      rejected,
      rejectRatePct:
        dispositioned > 0
          ? Math.round((rejected / dispositioned) * 1000) / 10
          : null,
      dockToStockAvgHours:
        dtsCount > 0 ? Math.round((dtsSum / dtsCount) * 10) / 10 : null,
      byStatus,
    };
  }

  private async recordLedger(
    action: string,
    r: Receipt,
    states: { before?: unknown; after?: unknown },
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.MATERIALS,
        action,
        referenceType: 'RECEIPT',
        referenceId: r.id,
        program: r.programId ?? undefined,
        plant: r.plant_id ?? undefined,
        context: { lot: r.lotNumber ?? undefined, serial: r.serialNumber ?? undefined },
        metadata: {
          folio: r.folio,
          partNumber: r.partNumber,
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
