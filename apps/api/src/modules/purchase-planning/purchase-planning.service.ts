import { Injectable, Logger, Optional } from '@nestjs/common';
import { MrpService } from '../mrp/mrp.service';
import { MaterialMasterService } from '../material-master/material-master.service';
import { ProcurementService } from '../procurement/procurement.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import {
  groupBySupplier,
  PoDraft,
  ShortageLine,
  UNASSIGNED_SUPPLIER,
} from './po-grouping';

export interface SuggestResult {
  root: { partNumber: string; description: string; revision: string; qty: number };
  drafts: PoDraft[];
  shortageCount: number;
}

export interface GenerateResult {
  root: { partNumber: string; qty: number };
  created: Array<{ id: string; folio: string | null; supplierName: string; totalValue: number; lineCount: number }>;
  count: number;
}

@Injectable()
export class PurchasePlanningService {
  private readonly logger = new Logger(PurchasePlanningService.name);

  constructor(
    private readonly mrp: MrpService,
    private readonly materials: MaterialMasterService,
    private readonly procurement: ProcurementService,
    private readonly tenantCtx: TenantContextService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  /** Preferred approved manufacturer (AVL) for a material, or null. */
  private async preferredSupplier(materialId: string): Promise<string | null> {
    try {
      const avl = await this.materials.listAvl(materialId);
      const approved = avl
        .filter((a) => a.status === 'APPROVED')
        .sort((a, b) => a.preference - b.preference);
      return approved[0]?.manufacturer ?? null;
    } catch {
      return null;
    }
  }

  async suggest(
    bomNodeId: string,
    qty?: number,
    warehouseId?: string,
  ): Promise<SuggestResult> {
    const mrp = await this.mrp.netting(bomNodeId, qty, warehouseId);
    const shortages = mrp.rows.filter((r) => r.net > 0);

    const lines: ShortageLine[] = [];
    for (const r of shortages) {
      const supplier = await this.preferredSupplier(r.materialId);
      lines.push({
        materialId: r.materialId,
        partNumber: r.partNumber,
        description: r.description,
        uom: r.uom,
        qty: r.suggestedOrder,
        unitCost: r.unitCost,
        value: r.shortageValue,
        supplierName: supplier ?? '',
      });
    }

    return {
      root: mrp.root,
      drafts: groupBySupplier(lines, mrp.root.partNumber),
      shortageCount: shortages.length,
    };
  }

  async generate(
    bomNodeId: string,
    qty?: number,
    warehouseId?: string,
    requiredDate?: string,
  ): Promise<GenerateResult> {
    const { root, drafts } = await this.suggest(bomNodeId, qty, warehouseId);
    const created: GenerateResult['created'] = [];

    for (const d of drafts) {
      const po = await this.procurement.create({
        title: d.title,
        supplierName: d.supplierName === UNASSIGNED_SUPPLIER ? undefined : d.supplierName,
        totalValue: d.totalValue,
        currency: d.currency,
        notes: d.notes,
        priority: 'MEDIUM',
        ...(requiredDate ? { requiredDate } : {}),
      });
      created.push({
        id: po.id,
        folio: po.folio,
        supplierName: d.supplierName,
        totalValue: d.totalValue,
        lineCount: d.lineCount,
      });
    }

    await this.recordLedger(root.partNumber, created.length);
    return { root: { partNumber: root.partNumber, qty: root.qty }, created, count: created.length };
  }

  private async recordLedger(rootPart: string, count: number): Promise<void> {
    if (!this.ledger || count === 0) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.MATERIALS,
        action: 'PURCHASE_ORDERS_GENERATED',
        referenceType: 'MRP',
        referenceId: rootPart,
        plant: this.tenantCtx.getPlantId() ?? undefined,
        metadata: { rootPart, ordersCreated: count },
      });
    } catch (err) {
      this.logger.warn(`Ledger write skipped: ${(err as Error)?.message}`);
    }
  }
}
