import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SignalGateway } from '../../../common/gateway/signal.gateway';
import { InventoryService } from '../../inventory/inventory.service';
import { ErpFinService } from './erp-fin.service';
import { ErpMmService } from './erp-mm.service';
import { ErpCustomer } from '../entities/erp-customer.entity';
import {
  ErpSalesOrder,
  SalesOrderStatus,
} from '../entities/erp-sales-order.entity';
import { ErpSalesOrderLine } from '../entities/erp-sales-order-line.entity';

const TENANT = 'default';
const round = (n: number) => Math.round((Number(n) || 0) * 10000) / 10000;

export interface CreateSoLine {
  model: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
}

@Injectable()
export class ErpSdService {
  private readonly logger = new Logger(ErpSdService.name);

  constructor(
    @InjectRepository(ErpCustomer)
    private readonly customerRepo: Repository<ErpCustomer>,
    @InjectRepository(ErpSalesOrder)
    private readonly soRepo: Repository<ErpSalesOrder>,
    @InjectRepository(ErpSalesOrderLine)
    private readonly soLineRepo: Repository<ErpSalesOrderLine>,
    private readonly fin: ErpFinService,
    private readonly mm: ErpMmService,
    private readonly inventory: InventoryService,
    private readonly signals: SignalGateway,
  ) {}

  // ── Customers (XD01) ────────────────────────────────────────────────────────
  async upsertCustomer(dto: Partial<ErpCustomer>) {
    if (!dto.code || !dto.name)
      throw new BadRequestException('code y name son obligatorios.');
    const existing = await this.customerRepo.findOne({
      where: { code: dto.code },
    });
    return this.customerRepo.save({ ...(existing ?? {}), ...dto });
  }
  listCustomers() {
    return this.customerRepo.find({ order: { code: 'ASC' } });
  }
  async getCustomer(code: string) {
    const c = await this.customerRepo.findOne({ where: { code } });
    if (!c) throw new NotFoundException(`Cliente ${code} no encontrado.`);
    return c;
  }

  // ── Sales orders (VA01) ─────────────────────────────────────────────────────
  private async nextSoNumber() {
    const count = await this.soRepo.count();
    return `SO-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
  }

  async createSO(
    dto: {
      customerCode: string;
      requestedDate?: string;
      currency?: string;
      notes?: string;
      lines: CreateSoLine[];
    },
    actor: string,
  ) {
    if (!dto.customerCode || !dto.lines?.length) {
      throw new BadRequestException(
        'customerCode y al menos una línea son obligatorios.',
      );
    }
    const customer = await this.customerRepo.findOne({
      where: { code: dto.customerCode },
    });
    if (!customer)
      throw new NotFoundException(`Cliente ${dto.customerCode} no existe.`);

    let subtotal = 0;
    let taxAmount = 0;
    const lines = dto.lines.map((l) => {
      const lineTotal = round(
        (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
      );
      subtotal += lineTotal;
      taxAmount += round((lineTotal * (Number(l.taxRate) || 0)) / 100);
      return { ...l, lineTotal };
    });
    subtotal = round(subtotal);
    taxAmount = round(taxAmount);

    const so = await this.soRepo.save(
      this.soRepo.create({
        soNumber: await this.nextSoNumber(),
        customerCode: dto.customerCode,
        customerName: customer.name,
        orderDate: new Date(),
        requestedDate: dto.requestedDate ? new Date(dto.requestedDate) : null,
        status: 'draft',
        currency: dto.currency ?? customer.currency ?? 'USD',
        subtotal,
        taxAmount,
        total: round(subtotal + taxAmount),
        notes: dto.notes ?? null,
        createdBy: actor,
      }),
    );
    await this.soLineRepo.save(
      lines.map((l, i) =>
        this.soLineRepo.create({
          soId: so.id,
          lineNo: i + 1,
          model: l.model,
          description: l.description ?? null,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          qtyShipped: 0,
          qtyInvoiced: 0,
          taxRate: l.taxRate ?? 0,
          lineTotal: l.lineTotal,
        }),
      ),
    );
    return this.getSO(so.id);
  }

  async getSO(id: number) {
    const so = await this.soRepo.findOne({ where: { id } });
    if (!so) throw new NotFoundException(`Pedido ${id} no encontrado.`);
    const lines = await this.soLineRepo.find({
      where: { soId: id },
      order: { lineNo: 'ASC' },
    });
    return { ...so, lines };
  }
  listSOs(filters?: { status?: string; customerCode?: string }) {
    const where: Record<string, unknown> = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.customerCode) where.customerCode = filters.customerCode;
    return this.soRepo.find({ where, order: { createdAt: 'DESC' }, take: 200 });
  }

  private async setStatus(id: number, status: SalesOrderStatus) {
    await this.soRepo.update(id, { status });
  }

  async confirmSO(id: number) {
    const so = await this.soRepo.findOne({ where: { id } });
    if (!so) throw new NotFoundException(`Pedido ${id} no encontrado.`);
    if (so.status !== 'draft')
      throw new BadRequestException('Solo se confirma un pedido en borrador.');
    await this.setStatus(id, 'confirmed');
    this.signals.emitToTenant(TENANT, 'erp:so-confirmed', {
      soId: id,
      soNumber: so.soNumber,
      customerCode: so.customerCode,
    });
    return this.getSO(id);
  }

  async cancelSO(id: number) {
    const so = await this.soRepo.findOne({ where: { id } });
    if (!so) throw new NotFoundException(`Pedido ${id} no encontrado.`);
    if (['shipped', 'invoiced', 'closed'].includes(so.status)) {
      throw new BadRequestException(
        'No se puede cancelar un pedido ya embarcado/facturado.',
      );
    }
    await this.setStatus(id, 'cancelled');
    return this.getSO(id);
  }

  /** Demand source for MRP: confirmed / in-production sales order lines. */
  async openDemand(): Promise<
    { partNumber: string; quantity: number; needBy?: string }[]
  > {
    const orders = await this.soRepo.find({
      where: [
        { status: 'confirmed' },
        { status: 'in_production' },
        { status: 'partially_shipped' },
      ],
    });
    if (!orders.length) return [];
    const byId = new Map(orders.map((o) => [o.id, o]));
    const lines = await this.soLineRepo.find();
    const demand: { partNumber: string; quantity: number; needBy?: string }[] =
      [];
    for (const l of lines) {
      const o = byId.get(l.soId);
      if (!o) continue;
      const open = round(l.quantity - l.qtyShipped);
      if (open > 0) {
        demand.push({
          partNumber: l.model,
          quantity: open,
          needBy: o.requestedDate
            ? new Date(o.requestedDate).toISOString()
            : undefined,
        });
      }
    }
    return demand;
  }

  /** Ship a sales order (VL01N): issue finished goods and post COGS (D COGS / C FG Inventory). */
  async shipSO(
    id: number,
    dto: { lines?: { lineNo: number; qty: number }[] } | undefined,
    actor: string,
  ) {
    const so = await this.soRepo.findOne({ where: { id } });
    if (!so) throw new NotFoundException(`Pedido ${id} no encontrado.`);
    if (
      !['confirmed', 'in_production', 'partially_shipped'].includes(so.status)
    ) {
      throw new BadRequestException(
        `El pedido está en estado ${so.status}; confírmalo antes de embarcar.`,
      );
    }
    const lines = await this.soLineRepo.find({ where: { soId: id } });
    const wanted = new Map<number, number>();
    if (dto?.lines?.length)
      for (const r of dto.lines) wanted.set(r.lineNo, r.qty);
    else
      for (const l of lines)
        wanted.set(l.lineNo, round(l.quantity - l.qtyShipped));

    let cogsTotal = 0;
    const shipped: { model: string; qty: number; cogs: number }[] = [];
    for (const line of lines) {
      const qty = round(wanted.get(line.lineNo) ?? 0);
      if (qty <= 0) continue;
      const open = round(line.quantity - line.qtyShipped);
      if (qty > open + 1e-6) {
        throw new BadRequestException(
          `Línea ${line.lineNo}: embarcar ${qty} excede lo pendiente (${open}).`,
        );
      }
      const unitCost = await this.mm.unitCostOf(line.model);
      const cogs = round(qty * unitCost);

      await this.inventory
        .recordTransaction({
          type: 'ISSUE',
          partNumber: line.model,
          quantity: qty,
          fromWarehouseId: 'WH-FG',
          actorName: actor,
          referenceType: 'SO',
          referenceId: so.soNumber,
          reason: `Embarque pedido ${so.soNumber}`,
        })
        .catch(() => undefined);

      if (cogs > 0) {
        await this.fin.postByRule('COGS', cogs, {
          docType: 'SALES',
          sourceId: so.soNumber,
          reference: so.soNumber,
          partNumber: line.model,
          narrative: `COGS embarque ${so.soNumber} · ${line.model}`,
          actorName: actor,
          partnerType: 'customer',
          partnerId: so.customerCode,
        });
      }
      line.qtyShipped = round(line.qtyShipped + qty);
      await this.soLineRepo.save(line);
      cogsTotal = round(cogsTotal + cogs);
      shipped.push({ model: line.model, qty, cogs });
    }
    if (!shipped.length)
      throw new BadRequestException('No hay cantidades por embarcar.');

    const fresh = await this.soLineRepo.find({ where: { soId: id } });
    const fully = fresh.every((l) => l.qtyShipped >= l.quantity - 1e-6);
    await this.setStatus(id, fully ? 'shipped' : 'partially_shipped');

    this.signals.emitToTenant(TENANT, 'erp:so-shipped', {
      soId: id,
      soNumber: so.soNumber,
      cogs: cogsTotal,
      fully,
    });
    return {
      soNumber: so.soNumber,
      status: fully ? 'shipped' : 'partially_shipped',
      cogs: cogsTotal,
      shipped,
    };
  }

  /** Invoice the shipped-but-not-invoiced quantity (VF01) → AR invoice in FIN. */
  async invoiceSO(id: number, actor: string) {
    const so = await this.soRepo.findOne({ where: { id } });
    if (!so) throw new NotFoundException(`Pedido ${id} no encontrado.`);
    const customer = await this.customerRepo.findOne({
      where: { code: so.customerCode },
    });
    const lines = await this.soLineRepo.find({ where: { soId: id } });
    const toInvoice = lines
      .map((l) => ({ line: l, qty: round(l.qtyShipped - l.qtyInvoiced) }))
      .filter((x) => x.qty > 0);
    if (!toInvoice.length) {
      throw new BadRequestException(
        'No hay cantidad embarcada pendiente de facturar.',
      );
    }

    const dueDays = customer?.paymentTermsDays ?? 30;
    const dueDate = new Date(Date.now() + dueDays * 86400000);
    const invoice = await this.fin.createInvoice({
      kind: 'AR',
      partnerType: 'customer',
      partnerId: so.customerCode,
      partnerName: so.customerName ?? undefined,
      salesOrderId: so.id,
      dueDate: dueDate.toISOString(),
      currency: so.currency,
      narrative: `Pedido ${so.soNumber}`,
      createdBy: actor,
      lines: toInvoice.map((x) => ({
        partNumber: x.line.model,
        description: x.line.description ?? x.line.model,
        quantity: x.qty,
        unitPrice: x.line.unitPrice,
        taxRate: x.line.taxRate,
        accountCode: '4000',
      })),
    });
    const posted = await this.fin.postInvoice(invoice.id, actor);

    for (const x of toInvoice) {
      x.line.qtyInvoiced = round(x.line.qtyInvoiced + x.qty);
      await this.soLineRepo.save(x.line);
    }
    const fresh = await this.soLineRepo.find({ where: { soId: id } });
    const fullyInvoiced = fresh.every(
      (l) => l.qtyInvoiced >= l.quantity - 1e-6,
    );
    await this.setStatus(id, fullyInvoiced ? 'invoiced' : so.status);

    this.signals.emitToTenant(TENANT, 'erp:so-invoiced', {
      soId: id,
      soNumber: so.soNumber,
      invoiceId: invoice.id,
      total: invoice.total,
    });
    return posted;
  }
}
