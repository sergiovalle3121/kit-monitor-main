import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { RoutingService } from '../routing/routing.service';
import { InventoryService } from '../inventory/inventory.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import {
  BackflushLine,
  computeBackflush,
  totalBackflushQty,
} from './backflush';
import { CommitBackflushDto, PreviewBackflushDto } from './dto/backflush.dto';

export interface BackflushPreview {
  routing: { id: string; partNumber: string; revision: string };
  operation: { id: string; sequence: number; name: string; workCenter: string | null };
  units: number;
  lines: BackflushLine[];
  total: number;
}

export interface BackflushReport {
  units: number;
  operation: { id: string; sequence: number; name: string };
  consumed: Array<{ partNumber: string; qty: number; uom: string }>;
  errors: Array<{ partNumber: string; message: string }>;
}

@Injectable()
export class RoutingBackflushService {
  private readonly logger = new Logger(RoutingBackflushService.name);

  constructor(
    private readonly routing: RoutingService,
    private readonly inventory: InventoryService,
    private readonly tenantCtx: TenantContextService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  async preview(dto: PreviewBackflushDto): Promise<BackflushPreview> {
    const routing = await this.routing.getRouting(dto.routingId); // scope + exists
    const op = routing.operations.find((o) => o.id === dto.operationId);
    if (!op) {
      throw new NotFoundException('Operación no encontrada en este ruteo.');
    }
    const inputs = op.materials.map((m) => ({
      materialId: m.materialId,
      partNumber: m.material?.partNumber ?? m.materialId,
      description: m.material?.description ?? '',
      qtyPerUnit: m.qtyPerUnit,
      uom: m.uom,
    }));
    const lines = computeBackflush(inputs, dto.units);
    return {
      routing: {
        id: routing.id,
        partNumber: routing.material?.partNumber ?? '(desconocido)',
        revision: routing.revision,
      },
      operation: {
        id: op.id,
        sequence: op.sequence,
        name: op.name,
        workCenter: op.workCenter,
      },
      units: dto.units,
      lines,
      total: totalBackflushQty(lines),
    };
  }

  async commit(dto: CommitBackflushDto): Promise<BackflushReport> {
    if (!dto.warehouseId?.trim()) {
      throw new BadRequestException('Se requiere el almacén origen para consumir.');
    }
    const preview = await this.preview(dto);
    const consumed: BackflushReport['consumed'] = [];
    const errors: BackflushReport['errors'] = [];

    for (const line of preview.lines) {
      if (line.consumeQty <= 0) continue;
      try {
        await this.inventory.recordTransaction({
          type: 'CONSUME',
          partNumber: line.partNumber,
          quantity: line.consumeQty,
          fromWarehouseId: dto.warehouseId,
          fromLocation: dto.location?.trim() || undefined,
          actorName: this.tenantCtx.getUserEmail(),
          referenceType: 'BACKFLUSH',
          referenceId: dto.workOrder?.trim() || dto.operationId,
          reason: `Backflush op ${preview.operation.sequence} (${preview.operation.name})`,
        });
        consumed.push({ partNumber: line.partNumber, qty: line.consumeQty, uom: line.uom });
      } catch (err) {
        errors.push({ partNumber: line.partNumber, message: (err as Error).message });
      }
    }

    await this.recordLedger(preview, dto, consumed.length, errors.length);
    return { units: dto.units, operation: preview.operation, consumed, errors };
  }

  private async recordLedger(
    preview: BackflushPreview,
    dto: CommitBackflushDto,
    consumedCount: number,
    errorCount: number,
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.PRODUCTION,
        action: 'ROUTING_BACKFLUSH_POSTED',
        referenceType: 'ROUTING_OPERATION',
        referenceId: dto.operationId,
        plant: this.tenantCtx.getPlantId() ?? undefined,
        workOrder: dto.workOrder?.trim() || undefined,
        metadata: {
          assembly: preview.routing.partNumber,
          operation: preview.operation.name,
          units: dto.units,
          consumed: consumedCount,
          errors: errorCount,
          warehouseId: dto.warehouseId,
        },
      });
    } catch (err) {
      this.logger.warn(`Ledger write skipped: ${(err as Error)?.message}`);
    }
  }
}
