import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { SignalGateway } from '../../../common/gateway/signal.gateway';
import { InventoryService } from '../../inventory/inventory.service';
import { MaterialMaster } from '../../inventory/entities/material-master.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { ErpFinService } from './erp-fin.service';
import {
  ErpMaterialValuation,
  CostingMethod,
} from '../entities/erp-material-valuation.entity';
import { ErpValuationLayer } from '../entities/erp-valuation-layer.entity';
import { ErpSupplierPrice } from '../entities/erp-supplier-price.entity';
import {
  ErpPurchaseRequisition,
  RequisitionSource,
} from '../entities/erp-purchase-requisition.entity';
import { ErpPurchaseOrder } from '../entities/erp-purchase-order.entity';
import { ErpPurchaseOrderLine } from '../entities/erp-purchase-order-line.entity';

const TENANT = 'default';
const round = (n: number) => Math.round((Number(n) || 0) * 1e6) / 1e6;
const round2 = (n: number) => Math.round((Number(n) || 0) * 10000) / 10000;

export interface CreatePoLine {
  partNumber: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  needBy?: string;
}

@Injectable()
export class ErpMmService {
  private readonly logger = new Logger(ErpMmService.name);

  constructor(
    @InjectRepository(ErpMaterialValuation)
    private readonly valRepo: Repository<ErpMaterialValuation>,
    @InjectRepository(ErpValuationLayer)
    private readonly layerRepo: Repository<ErpValuationLayer>,
    @InjectRepository(ErpSupplierPrice)
    private readonly priceRepo: Repository<ErpSupplierPrice>,
    @InjectRepository(ErpPurchaseRequisition)
    private readonly prRepo: Repository<ErpPurchaseRequisition>,
    @InjectRepository(ErpPurchaseOrder)
    private readonly poRepo: Repository<ErpPurchaseOrder>,
    @InjectRepository(ErpPurchaseOrderLine)
    private readonly poLineRepo: Repository<ErpPurchaseOrderLine>,
    @InjectRepository(MaterialMaster)
    private readonly materialRepo: Repository<MaterialMaster>,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    private readonly inventory: InventoryService,
    private readonly fin: ErpFinService,
    private readonly dataSource: DataSource,
    private readonly signals: SignalGateway,
  ) {}

  // ── Valuation engine ────────────────────────────────────────────────────────
  private async getValuation(
    partNumber: string,
    mgr?: EntityManager,
  ): Promise<ErpMaterialValuation> {
    const repo = mgr ? mgr.getRepository(ErpMaterialValuation) : this.valRepo;
    let val = await repo.findOne({ where: { partNumber } });
    if (!val) {
      val = repo.create({
        partNumber,
        costingMethod: 'moving_average',
        movingAvgCost: 0,
        totalQty: 0,
        totalValue: 0,
        lastCost: 0,
      });
      val = await repo.save(val);
    }
    return val;
  }

  async setCostingMethod(partNumber: string, method: CostingMethod) {
    if (!['standard', 'moving_average', 'fifo', 'lifo'].includes(method)) {
      throw new BadRequestException('Método de costeo inválido.');
    }
    const val = await this.getValuation(partNumber);
    val.costingMethod = method;
    return this.valRepo.save(val);
  }

  /** Create a cost layer on receipt and roll the moving average forward. */
  private async receiveLayer(
    mgr: EntityManager,
    partNumber: string,
    warehouseId: string | null,
    qty: number,
    unitCost: number,
    source: { sourceType?: string; sourceId?: string },
  ): Promise<void> {
    await mgr.save(
      mgr.create(ErpValuationLayer, {
        partNumber,
        warehouseId,
        receiptDate: new Date(),
        qtyReceived: qty,
        qtyRemaining: qty,
        unitCost: round(unitCost),
        sourceType: source.sourceType ?? null,
        sourceId: source.sourceId ?? null,
      }),
    );
    const val = await this.getValuation(partNumber, mgr);
    const newQty = round(val.totalQty + qty);
    const newValue = round2(val.totalValue + qty * unitCost);
    val.totalQty = newQty;
    val.totalValue = newValue;
    val.movingAvgCost = newQty > 0 ? round(newValue / newQty) : round(unitCost);
    val.lastCost = round(unitCost);
    await mgr.save(val);
  }

  /** Value a consumption of `qty` per the material's costing method. */
  private async valueConsumption(
    mgr: EntityManager,
    partNumber: string,
    qty: number,
  ): Promise<{ totalCost: number; unitCost: number }> {
    const val = await this.getValuation(partNumber, mgr);
    const material = await mgr
      .getRepository(MaterialMaster)
      .findOne({ where: { partNumber } });
    const standard = material?.standardCost ?? 0;

    if (val.costingMethod === 'fifo' || val.costingMethod === 'lifo') {
      const layers = await mgr.getRepository(ErpValuationLayer).find({
        where: { partNumber },
        order: {
          receiptDate: val.costingMethod === 'fifo' ? 'ASC' : 'DESC',
          id: 'ASC',
        },
      });
      let remaining = qty;
      let totalCost = 0;
      for (const layer of layers) {
        if (remaining <= 0) break;
        if (layer.qtyRemaining <= 0) continue;
        const take = Math.min(layer.qtyRemaining, remaining);
        totalCost += take * layer.unitCost;
        layer.qtyRemaining = round(layer.qtyRemaining - take);
        remaining = round(remaining - take);
        await mgr.save(layer);
      }
      if (remaining > 0) {
        // Not enough layered stock — value the rest at moving avg / standard.
        totalCost += remaining * (val.movingAvgCost || standard);
      }
      this.decrementMovingAverage(val, qty);
      await mgr.save(val);
      return {
        totalCost: round2(totalCost),
        unitCost: qty > 0 ? round(totalCost / qty) : 0,
      };
    }

    const unitCost =
      val.costingMethod === 'standard'
        ? standard
        : val.movingAvgCost || standard;
    this.decrementMovingAverage(val, qty);
    await mgr.save(val);
    const totalCost = round2(qty * unitCost);
    return { totalCost, unitCost: round(unitCost) };
  }

  private decrementMovingAverage(val: ErpMaterialValuation, qty: number): void {
    const unit = val.movingAvgCost;
    val.totalQty = round(Math.max(0, val.totalQty - qty));
    val.totalValue = round2(Math.max(0, val.totalValue - qty * unit));
  }

  async inventoryValuation() {
    const vals = await this.valRepo.find({ order: { partNumber: 'ASC' } });
    const rows = vals.map((v) => ({
      partNumber: v.partNumber,
      method: v.costingMethod,
      qty: v.totalQty,
      unitCost: v.movingAvgCost,
      value: v.totalValue,
    }));
    return { rows, totalValue: round2(rows.reduce((s, r) => s + r.value, 0)) };
  }

  /** Best available unit cost for a part (moving avg → standard cost). Used for COGS. */
  async unitCostOf(partNumber: string): Promise<number> {
    const val = await this.valRepo.findOne({ where: { partNumber } });
    if (val && val.movingAvgCost > 0) return val.movingAvgCost;
    const material = await this.materialRepo.findOne({ where: { partNumber } });
    return material?.standardCost ?? 0;
  }

  // ── Supplier prices / sourcing ──────────────────────────────────────────────
  async upsertSupplierPrice(dto: Partial<ErpSupplierPrice>) {
    if (!dto.supplierId || !dto.partNumber || dto.unitPrice == null) {
      throw new BadRequestException(
        'supplierId, partNumber y unitPrice son obligatorios.',
      );
    }
    const existing = await this.priceRepo.findOne({
      where: { supplierId: dto.supplierId, partNumber: dto.partNumber },
    });
    return this.priceRepo.save({ ...(existing ?? {}), ...dto });
  }
  listSupplierPrices(partNumber?: string) {
    return this.priceRepo.find({
      where: partNumber ? { partNumber } : {},
      order: { partNumber: 'ASC', preferred: 'DESC', unitPrice: 'ASC' },
    });
  }
  async bestSupplierFor(partNumber: string): Promise<ErpSupplierPrice | null> {
    const prices = await this.priceRepo.find({
      where: { partNumber, active: true },
    });
    if (!prices.length) return null;
    const preferred = prices.find((p) => p.preferred);
    if (preferred) return preferred;
    return prices.sort((a, b) => a.unitPrice - b.unitPrice)[0];
  }

  // ── Purchase requisitions ───────────────────────────────────────────────────
  private async nextNumber(prefix: string, repo: Repository<{ id: number }>) {
    const count = await repo.count();
    return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
  }

  async createRequisition(dto: {
    partNumber: string;
    quantity: number;
    needBy?: string;
    description?: string;
    source?: RequisitionSource;
    suggestedSupplierId?: number;
    mrpRunId?: number;
    notes?: string;
    createdBy?: string;
  }) {
    if (!dto.partNumber || !dto.quantity) {
      throw new BadRequestException('partNumber y quantity son obligatorios.');
    }
    return this.prRepo.save(
      this.prRepo.create({
        prNumber: await this.nextNumber('PR', this.prRepo),
        partNumber: dto.partNumber,
        description: dto.description ?? null,
        quantity: dto.quantity,
        needBy: dto.needBy ? new Date(dto.needBy) : null,
        source: dto.source ?? 'manual',
        status: 'open',
        suggestedSupplierId: dto.suggestedSupplierId ?? null,
        mrpRunId: dto.mrpRunId ?? null,
        notes: dto.notes ?? null,
        createdBy: dto.createdBy ?? null,
      }),
    );
  }
  listRequisitions(filters?: { status?: string }) {
    return this.prRepo.find({
      where: filters?.status ? { status: filters.status as never } : {},
      order: { createdAt: 'DESC' },
      take: 300,
    });
  }
  async cancelRequisition(id: number) {
    const pr = await this.prRepo.findOne({ where: { id } });
    if (!pr) throw new NotFoundException(`Requisición ${id} no encontrada.`);
    if (pr.status === 'converted')
      throw new BadRequestException('Ya fue convertida a PO.');
    pr.status = 'cancelled';
    return this.prRepo.save(pr);
  }

  /** Convert an open requisition into a (draft) purchase order. */
  async convertRequisitionToPO(
    id: number,
    opts: { supplierId?: number; unitPrice?: number },
    actor: string,
  ) {
    const pr = await this.prRepo.findOne({ where: { id } });
    if (!pr) throw new NotFoundException(`Requisición ${id} no encontrada.`);
    if (pr.status !== 'open')
      throw new BadRequestException('La requisición no está abierta.');

    const best = await this.bestSupplierFor(pr.partNumber);
    const supplierId =
      opts.supplierId ?? pr.suggestedSupplierId ?? best?.supplierId;
    if (!supplierId) {
      throw new BadRequestException(
        'No hay proveedor sugerido ni precio de proveedor para esta parte.',
      );
    }
    const material = await this.materialRepo.findOne({
      where: { partNumber: pr.partNumber },
    });
    const unitPrice =
      opts.unitPrice ?? best?.unitPrice ?? material?.standardCost ?? 0;

    const po = await this.createPO(
      {
        supplierId,
        lines: [
          {
            partNumber: pr.partNumber,
            description: pr.description ?? undefined,
            quantity: pr.quantity,
            unitPrice,
            needBy: pr.needBy ? pr.needBy.toISOString() : undefined,
          },
        ],
      },
      actor,
    );
    pr.status = 'converted';
    pr.purchaseOrderId = po.id;
    await this.prRepo.save(pr);
    return po;
  }

  // ── Purchase orders ─────────────────────────────────────────────────────────
  async createPO(
    dto: {
      supplierId: number;
      lines: CreatePoLine[];
      currency?: string;
      warehouseId?: string;
      expectedDate?: string;
      notes?: string;
    },
    actor: string,
  ) {
    if (!dto.supplierId || !dto.lines?.length) {
      throw new BadRequestException(
        'supplierId y al menos una línea son obligatorios.',
      );
    }
    const supplier = await this.supplierRepo.findOne({
      where: { id: dto.supplierId },
    });
    const total = round2(
      dto.lines.reduce(
        (s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
        0,
      ),
    );
    const po = await this.poRepo.save(
      this.poRepo.create({
        poNumber: await this.nextNumber('PO', this.poRepo),
        supplierId: dto.supplierId,
        supplierName: supplier?.name ?? null,
        status: 'draft',
        currency: dto.currency ?? 'USD',
        warehouseId: dto.warehouseId ?? 'WH-RAW',
        orderDate: new Date(),
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
        totalAmount: total,
        notes: dto.notes ?? null,
        createdBy: actor,
      }),
    );
    await this.poLineRepo.save(
      dto.lines.map((l, i) =>
        this.poLineRepo.create({
          poId: po.id,
          lineNo: i + 1,
          partNumber: l.partNumber,
          description: l.description ?? null,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          qtyReceived: 0,
          needBy: l.needBy ? new Date(l.needBy) : null,
          lineTotal: round2(
            (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
          ),
        }),
      ),
    );
    return this.getPO(po.id);
  }

  async getPO(id: number) {
    const po = await this.poRepo.findOne({ where: { id } });
    if (!po)
      throw new NotFoundException(`Orden de compra ${id} no encontrada.`);
    const lines = await this.poLineRepo.find({
      where: { poId: id },
      order: { lineNo: 'ASC' },
    });
    return { ...po, lines };
  }
  listPOs(filters?: { status?: string; supplierId?: number }) {
    const where: Record<string, unknown> = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.supplierId) where.supplierId = filters.supplierId;
    return this.poRepo.find({ where, order: { createdAt: 'DESC' }, take: 200 });
  }
  async issuePO(id: number) {
    const po = await this.poRepo.findOne({ where: { id } });
    if (!po)
      throw new NotFoundException(`Orden de compra ${id} no encontrada.`);
    if (po.status !== 'draft')
      throw new BadRequestException('Solo se emite una PO en borrador.');
    po.status = 'issued';
    po.orderDate = po.orderDate ?? new Date();
    return this.poRepo.save(po);
  }
  async cancelPO(id: number) {
    const po = await this.poRepo.findOne({ where: { id } });
    if (!po)
      throw new NotFoundException(`Orden de compra ${id} no encontrada.`);
    if (['received', 'closed'].includes(po.status)) {
      throw new BadRequestException(
        'No se puede cancelar una PO ya recibida/cerrada.',
      );
    }
    po.status = 'cancelled';
    return this.poRepo.save(po);
  }

  /**
   * Goods receipt (MM03 / MIGO): receives PO lines into inventory, builds the
   * cost layer + moving average, and posts the GOODS_RECEIPT journal
   * (D Inventory / C GR-IR) to the GL.
   */
  async receivePO(
    id: number,
    dto: { lines?: { lineNo: number; qty: number }[] } | undefined,
    actor: string,
  ) {
    const result = await this.dataSource.transaction(async (mgr) => {
      const po = await mgr.findOne(ErpPurchaseOrder, { where: { id } });
      if (!po)
        throw new NotFoundException(`Orden de compra ${id} no encontrada.`);
      if (['draft', 'cancelled', 'closed'].includes(po.status)) {
        throw new BadRequestException(
          `La PO está en estado ${po.status}; emítela antes de recibir.`,
        );
      }
      const lines = await mgr.find(ErpPurchaseOrderLine, {
        where: { poId: id },
      });
      const wanted = new Map<number, number>();
      if (dto?.lines?.length) {
        for (const r of dto.lines) wanted.set(r.lineNo, r.qty);
      } else {
        for (const l of lines)
          wanted.set(l.lineNo, round(l.quantity - l.qtyReceived));
      }

      let receivedAmount = 0;
      const received: { partNumber: string; qty: number; amount: number }[] =
        [];
      for (const line of lines) {
        const qty = round(wanted.get(line.lineNo) ?? 0);
        if (qty <= 0) continue;
        const open = round(line.quantity - line.qtyReceived);
        if (qty > open + 1e-6) {
          throw new BadRequestException(
            `Línea ${line.lineNo}: recibir ${qty} excede lo pendiente (${open}).`,
          );
        }
        const amount = round2(qty * line.unitPrice);

        // Inventory move (best-effort — never blocks the receipt/GL if master data isn't set up).
        await this.inventory
          .recordTransaction({
            type: 'RECEIVE',
            partNumber: line.partNumber,
            quantity: qty,
            toWarehouseId: po.warehouseId,
            actorName: actor,
            referenceType: 'PO',
            referenceId: po.poNumber,
            reason: `Recepción PO ${po.poNumber}`,
          })
          .catch(() => undefined);

        await this.receiveLayer(
          mgr,
          line.partNumber,
          po.warehouseId,
          qty,
          line.unitPrice,
          {
            sourceType: 'PO',
            sourceId: po.poNumber,
          },
        );

        await this.fin.postByRule(
          'GOODS_RECEIPT',
          amount,
          {
            docType: 'PURCH',
            sourceId: po.poNumber,
            reference: po.poNumber,
            partNumber: line.partNumber,
            narrative: `Recepción PO ${po.poNumber} · ${line.partNumber}`,
            actorName: actor,
            partnerType: 'supplier',
            partnerId: String(po.supplierId),
          },
          mgr,
        );

        line.qtyReceived = round(line.qtyReceived + qty);
        await mgr.save(line);
        receivedAmount = round2(receivedAmount + amount);
        received.push({ partNumber: line.partNumber, qty, amount });
      }

      if (!received.length) {
        throw new BadRequestException('No hay cantidades por recibir.');
      }

      const fresh = await mgr.find(ErpPurchaseOrderLine, {
        where: { poId: id },
      });
      const fullyReceived = fresh.every(
        (l) => l.qtyReceived >= l.quantity - 1e-6,
      );
      po.status = fullyReceived ? 'received' : 'partially_received';
      await mgr.save(po);

      return {
        poNumber: po.poNumber,
        status: po.status,
        receivedAmount,
        received,
      };
    });

    this.signals.emitToTenant(TENANT, 'erp:goods-receipt', {
      poId: id,
      poNumber: result.poNumber,
      status: result.status,
      amount: result.receivedAmount,
    });
    return result;
  }

  /** Goods issue (MM03): issue material to production at valued cost → GOODS_ISSUE GL. */
  async issueMaterial(
    dto: {
      partNumber: string;
      quantity: number;
      warehouseId?: string;
      workOrder?: string;
      reason?: string;
    },
    actor: string,
  ) {
    if (!dto.partNumber || !dto.quantity || dto.quantity <= 0) {
      throw new BadRequestException(
        'partNumber y quantity (>0) son obligatorios.',
      );
    }
    return this.dataSource.transaction(async (mgr) => {
      const valued = await this.valueConsumption(
        mgr,
        dto.partNumber,
        dto.quantity,
      );
      await this.inventory
        .recordTransaction({
          type: 'ISSUE',
          partNumber: dto.partNumber,
          quantity: dto.quantity,
          fromWarehouseId: dto.warehouseId ?? 'WH-RAW',
          actorName: actor,
          referenceType: dto.workOrder ? 'WO' : 'ISSUE',
          referenceId: dto.workOrder ?? undefined,
          reason: dto.reason ?? 'Salida a producción',
        })
        .catch(() => undefined);
      const entry = await this.fin.postByRule(
        'GOODS_ISSUE',
        valued.totalCost,
        {
          docType: 'INV',
          sourceId: dto.workOrder ?? dto.partNumber,
          reference: dto.workOrder ?? undefined,
          partNumber: dto.partNumber,
          workOrder: dto.workOrder ?? undefined,
          narrative: `Salida ${dto.partNumber}`,
          actorName: actor,
        },
        mgr,
      );
      return { ...valued, journalEntryId: entry?.id ?? null };
    });
  }
}
