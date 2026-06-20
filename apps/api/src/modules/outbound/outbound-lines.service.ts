import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { InventoryService } from '../inventory/inventory.service';
import { OutboundShipmentLine } from './entities/outbound-shipment-line.entity';
import {
  CreateOutboundLineDto,
  UpdateOutboundLineDto,
} from './dto/outbound.dto';

export interface PostResult {
  posted: number;
  failed: number;
  skipped: number;
}

/**
 * Outbound shipment lines (content) + the finished-goods goods-issue at ship time.
 * Tenant-scoped like the outbound spine. Inventory is OPTIONAL and the posting is
 * best-effort: when a part is inventory-tracked the FG position is decremented
 * (with the inventory module's own poka-yoke — only `available` stock moves);
 * when it isn't (or stock is short) the inventory module records the exception and
 * we continue, so a shipment is never blocked from leaving by missing master data.
 */
@Injectable()
export class OutboundLinesService {
  private readonly logger = new Logger(OutboundLinesService.name);

  constructor(
    @InjectRepository(OutboundShipmentLine)
    private readonly repo: Repository<OutboundShipmentLine>,
    private readonly tenantCtx: TenantContextService,
    @Optional() private readonly inventory?: InventoryService,
  ) {}

  private applyScope(
    qb: SelectQueryBuilder<OutboundShipmentLine>,
    alias: string,
  ): SelectQueryBuilder<OutboundShipmentLine> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  async listLines(shipmentId: string): Promise<OutboundShipmentLine[]> {
    const qb = this.repo.createQueryBuilder('l').orderBy('l.created_at', 'ASC');
    this.applyScope(qb, 'l');
    qb.andWhere('l.shipment_id = :sid', { sid: shipmentId });
    return qb.getMany();
  }

  async getLine(id: string): Promise<OutboundShipmentLine> {
    const qb = this.repo.createQueryBuilder('l').where('l.id = :id', { id });
    this.applyScope(qb, 'l');
    const found = await qb.getOne();
    if (!found) throw new NotFoundException('Línea de embarque no encontrada.');
    return found;
  }

  async addLine(
    shipmentId: string,
    dto: CreateOutboundLineDto,
  ): Promise<OutboundShipmentLine> {
    const entity = this.repo.create({
      shipmentId,
      partNumber: dto.partNumber,
      description: dto.description ?? null,
      quantity: dto.quantity ?? 0,
      quantityShipped: 0,
      uom: dto.uom ?? 'EA',
      lotNumber: dto.lotNumber ?? null,
      warehouseId: dto.warehouseId ?? 'WH-FG',
      location: dto.location ?? null,
      salesOrder: dto.salesOrder ?? null,
      salesOrderLine: dto.salesOrderLine ?? null,
      inventoryPosted: false,
      notes: dto.notes ?? null,
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    });
    return this.repo.save(entity);
  }

  async updateLine(
    id: string,
    dto: UpdateOutboundLineDto,
  ): Promise<OutboundShipmentLine> {
    const l = await this.getLine(id);
    Object.assign(l, {
      ...(dto.partNumber !== undefined && { partNumber: dto.partNumber }),
      ...(dto.description !== undefined && {
        description: dto.description || null,
      }),
      ...(dto.quantity !== undefined && { quantity: dto.quantity }),
      ...(dto.uom !== undefined && { uom: dto.uom }),
      ...(dto.lotNumber !== undefined && { lotNumber: dto.lotNumber || null }),
      ...(dto.warehouseId !== undefined && { warehouseId: dto.warehouseId }),
      ...(dto.location !== undefined && { location: dto.location || null }),
      ...(dto.salesOrder !== undefined && {
        salesOrder: dto.salesOrder || null,
      }),
      ...(dto.salesOrderLine !== undefined && {
        salesOrderLine: dto.salesOrderLine || null,
      }),
      ...(dto.notes !== undefined && { notes: dto.notes || null }),
    });
    return this.repo.save(l);
  }

  async removeLine(id: string): Promise<{ ok: true }> {
    const l = await this.getLine(id);
    await this.repo.softRemove(l);
    return { ok: true };
  }

  /**
   * Post the finished-goods goods-issue for every not-yet-posted line at ship
   * time. Best-effort: a line whose part isn't inventory-tracked (or is short)
   * is left unposted (the inventory module logs the exception) and the shipment
   * still ships. Idempotent — already-posted lines are skipped.
   */
  async postShipmentInventory(
    shipmentId: string,
    actor: string,
  ): Promise<PostResult> {
    const result: PostResult = { posted: 0, failed: 0, skipped: 0 };
    if (!this.inventory) return result;

    const lines = await this.listLines(shipmentId);
    for (const line of lines) {
      if (line.inventoryPosted || !(line.quantity > 0)) {
        result.skipped += 1;
        continue;
      }
      try {
        await this.inventory.recordTransaction({
          type: 'ISSUE',
          partNumber: line.partNumber,
          quantity: line.quantity,
          fromWarehouseId: line.warehouseId || 'WH-FG',
          fromLocation: line.location || undefined,
          actorName: actor || 'Outbound',
          lotNumber: line.lotNumber || undefined,
          referenceType: 'OUTBOUND_SHIPMENT',
          referenceId: shipmentId,
          reason: `Salida de mercancía — embarque ${shipmentId}`,
        });
        line.inventoryPosted = true;
        line.quantityShipped = line.quantity;
        await this.repo.save(line);
        result.posted += 1;
      } catch (err) {
        // The inventory module already recorded an operational exception; the
        // shipment is not blocked from leaving by missing/short FG stock.
        this.logger.warn(
          `FG goods-issue skipped for ${line.partNumber} (${shipmentId}): ${(err as Error)?.message}`,
        );
        result.failed += 1;
      }
    }
    return result;
  }
}
