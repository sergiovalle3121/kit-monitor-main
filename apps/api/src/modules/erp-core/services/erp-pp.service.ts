import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SignalGateway } from '../../../common/gateway/signal.gateway';
import { BomHeader, BomStatus } from '../../bom/entities/bom-header.entity';
import { BomComponent } from '../../bom/entities/bom-component.entity';
import { BomItem } from '../../bom/entities/bom-item.entity';
import { InventoryPosition } from '../../inventory/entities/inventory-position.entity';
import { ReplenishmentRule } from '../../inventory/entities/replenishment-rule.entity';
import { Plan } from '../../plans/entities/plan.entity';
import { ErpMmService } from './erp-mm.service';
import { ErpSdService } from './erp-sd.service';
import { ErpMrpRun, MrpMode } from '../entities/erp-mrp-run.entity';
import { ErpMrpResult, MrpAction } from '../entities/erp-mrp-result.entity';
import { ErpPlannedOrder } from '../entities/erp-planned-order.entity';
import { ErpPurchaseOrder } from '../entities/erp-purchase-order.entity';
import { ErpPurchaseOrderLine } from '../entities/erp-purchase-order-line.entity';

const TENANT = 'default';
const round = (n: number) => Math.round((Number(n) || 0) * 1e6) / 1e6;

export interface MrpDemand {
  partNumber: string;
  quantity: number;
  needBy?: string;
}
export interface RunMrpInput {
  horizonDays?: number;
  mode?: MrpMode;
  demand?: MrpDemand[];
  includeOpenPlans?: boolean;
  includeSalesOrders?: boolean;
  createdBy?: string;
}

@Injectable()
export class ErpPpService {
  private readonly logger = new Logger(ErpPpService.name);

  constructor(
    @InjectRepository(ErpMrpRun)
    private readonly runRepo: Repository<ErpMrpRun>,
    @InjectRepository(ErpMrpResult)
    private readonly resultRepo: Repository<ErpMrpResult>,
    @InjectRepository(ErpPlannedOrder)
    private readonly plannedRepo: Repository<ErpPlannedOrder>,
    @InjectRepository(ErpPurchaseOrderLine)
    private readonly poLineRepo: Repository<ErpPurchaseOrderLine>,
    @InjectRepository(BomHeader)
    private readonly bomHeaderRepo: Repository<BomHeader>,
    @InjectRepository(BomComponent)
    private readonly bomComponentRepo: Repository<BomComponent>,
    @InjectRepository(BomItem)
    private readonly bomItemRepo: Repository<BomItem>,
    @InjectRepository(InventoryPosition)
    private readonly positionRepo: Repository<InventoryPosition>,
    @InjectRepository(ReplenishmentRule)
    private readonly ruleRepo: Repository<ReplenishmentRule>,
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
    private readonly mm: ErpMmService,
    private readonly sd: ErpSdService,
    private readonly signals: SignalGateway,
  ) {}

  private async nextNumber(prefix: string, repo: Repository<{ id: number }>) {
    const count = await repo.count();
    return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
  }

  /**
   * Run MRP: net the demand against supply, explode multi-level BOMs by
   * low-level code, and generate purchase requisitions (buy) and planned
   * production orders (make). `propose` leaves them for a planner; `auto`
   * firms them (PO issued, planned order → Plan).
   */
  async runMrp(dto: RunMrpInput) {
    const mode: MrpMode = dto.mode ?? 'propose';
    const horizonDays = dto.horizonDays ?? 30;

    // 1. BOM structures (active headers + components; legacy BomItem fallback).
    const headers = await this.bomHeaderRepo.find({
      where: { status: BomStatus.ACTIVE },
    });
    const headerByModel = new Map<string, BomHeader>();
    for (const h of headers)
      if (!headerByModel.has(h.model)) headerByModel.set(h.model, h);
    const components = headers.length
      ? await this.bomComponentRepo.find({
          where: { bomHeaderId: In(headers.map((h) => h.id)) },
        })
      : [];
    const compsByHeader = new Map<number, BomComponent[]>();
    for (const c of components) {
      const arr = compsByHeader.get(c.bomHeaderId) ?? [];
      arr.push(c);
      compsByHeader.set(c.bomHeaderId, arr);
    }
    const itemsByModel = new Map<string, BomItem[]>();
    for (const it of await this.bomItemRepo.find()) {
      const arr = itemsByModel.get(it.model) ?? [];
      arr.push(it);
      itemsByModel.set(it.model, arr);
    }
    const componentsOf = (
      model: string,
    ): { part: string; qtyPer: number }[] => {
      const h = headerByModel.get(model);
      if (h) {
        return (compsByHeader.get(h.id) ?? []).map((c) => ({
          part: c.componentNumber,
          qtyPer: round((c.quantity || 0) * (c.usageFactor || 1)),
        }));
      }
      const items = itemsByModel.get(model);
      if (items)
        return items.map((it) => ({
          part: it.partNumber,
          qtyPer: it.usageFactor || 1,
        }));
      return [];
    };
    const isMade = (part: string) =>
      headerByModel.has(part) || itemsByModel.has(part);

    // 2. Independent demand.
    const grossReq = new Map<string, number>();
    const needByMap = new Map<string, Date>();
    const addDemand = (part: string, qty: number, needBy?: Date) => {
      grossReq.set(part, round((grossReq.get(part) ?? 0) + qty));
      if (
        needBy &&
        (!needByMap.has(part) || needBy < (needByMap.get(part) as Date))
      ) {
        needByMap.set(part, needBy);
      }
    };
    for (const d of dto.demand ?? []) {
      addDemand(
        d.partNumber,
        Number(d.quantity) || 0,
        d.needBy ? new Date(d.needBy) : undefined,
      );
    }
    // Independent demand from confirmed sales orders (SD01).
    if (dto.includeSalesOrders !== false) {
      for (const d of await this.sd.openDemand()) {
        addDemand(
          d.partNumber,
          Number(d.quantity) || 0,
          d.needBy ? new Date(d.needBy) : undefined,
        );
      }
    }

    // 3. Scheduled receipts: open POs + open Plans (which also drive dependent demand).
    const scheduled = new Map<string, number>();
    const openPoLines = await this.poLineRepo
      .createQueryBuilder('l')
      .innerJoin(ErpPurchaseOrder, 'po', 'po.id = l.poId')
      .where("po.status IN ('issued','partially_received')")
      .getMany();
    for (const l of openPoLines) {
      const open = round((l.quantity || 0) - (l.qtyReceived || 0));
      if (open > 0)
        scheduled.set(
          l.partNumber,
          round((scheduled.get(l.partNumber) ?? 0) + open),
        );
    }
    if (dto.includeOpenPlans !== false) {
      const openPlans = await this.planRepo.find({
        where: { status: In(['pending', 'released', 'active']) },
      });
      for (const p of openPlans) {
        scheduled.set(
          p.model,
          round((scheduled.get(p.model) ?? 0) + (p.quantity || 0)),
        );
        for (const c of componentsOf(p.model)) {
          addDemand(
            c.part,
            round((p.quantity || 0) * c.qtyPer),
            p.dueDate ?? undefined,
          );
        }
      }
    }

    // 4. On-hand available + 5. safety stock.
    const onHandMap = new Map<string, number>();
    for (const pos of await this.positionRepo.find()) {
      const avail = (pos.onHand || 0) - (pos.allocated || 0);
      onHandMap.set(
        pos.partNumber,
        round((onHandMap.get(pos.partNumber) ?? 0) + avail),
      );
    }
    const safetyMap = new Map<string, number>();
    for (const r of await this.ruleRepo.find()) {
      safetyMap.set(
        r.partNumber,
        Math.max(safetyMap.get(r.partNumber) ?? 0, r.safetyStock || 0),
      );
    }

    // 6. Low-level codes (max depth) so a part is netted after all its parents.
    const level = new Map<string, number>();
    const assign = (part: string, lvl: number, path: Set<string>) => {
      if (path.has(part)) return; // cycle guard
      level.set(part, Math.max(level.get(part) ?? 0, lvl));
      path.add(part);
      for (const c of componentsOf(part)) assign(c.part, lvl + 1, path);
      path.delete(part);
    };
    for (const part of new Set([...grossReq.keys(), ...scheduled.keys()])) {
      assign(part, 0, new Set());
    }

    // 7. Net + explode, ascending level.
    const allParts = [
      ...new Set([...grossReq.keys(), ...scheduled.keys(), ...level.keys()]),
    ].sort((a, b) => (level.get(a) ?? 0) - (level.get(b) ?? 0));

    const run = await this.runRepo.save(
      this.runRepo.create({
        runNumber: await this.nextNumber('MRP', this.runRepo),
        runAt: new Date(),
        horizonDays,
        mode,
        status: 'completed',
        summary: null,
        createdBy: dto.createdBy ?? null,
      }),
    );

    const results: ErpMrpResult[] = [];
    const plannedOrders: ErpPlannedOrder[] = [];
    const createdReqIds: number[] = [];
    let shortages = 0;

    for (const part of allParts) {
      const gReq = round(grossReq.get(part) ?? 0);
      const onHand = round(onHandMap.get(part) ?? 0);
      const sched = round(scheduled.get(part) ?? 0);
      const safety = round(safetyMap.get(part) ?? 0);
      const netReq = round(Math.max(0, gReq + safety - onHand - sched));
      const needBy = needByMap.get(part) ?? null;
      let action: MrpAction = 'none';
      let plannedQty = 0;
      let shortage = false;

      if (netReq > 0) {
        if (isMade(part)) {
          action = 'make';
          plannedQty = netReq; // lot-for-lot
          const po = await this.plannedRepo.save(
            this.plannedRepo.create({
              plannedOrderNumber: await this.nextNumber(
                'PLN',
                this.plannedRepo,
              ),
              mrpRunId: run.id,
              partNumber: part,
              quantity: plannedQty,
              needBy,
              status: 'planned',
              createdBy: dto.createdBy ?? null,
            }),
          );
          plannedOrders.push(po);
          for (const c of componentsOf(part)) {
            addDemand(
              c.part,
              round(plannedQty * c.qtyPer),
              needBy ?? undefined,
            );
          }
        } else {
          action = 'buy';
          const best = await this.mm.bestSupplierFor(part);
          const moq = best?.moq ?? 1;
          plannedQty = Math.max(netReq, moq);
          if (!best) {
            shortage = true;
            shortages++;
          }
          const pr = await this.mm.createRequisition({
            partNumber: part,
            quantity: plannedQty,
            needBy: needBy ? needBy.toISOString() : undefined,
            source: 'mrp',
            mrpRunId: run.id,
            suggestedSupplierId: best?.supplierId,
            createdBy: dto.createdBy,
          });
          createdReqIds.push(pr.id);
        }
      }

      results.push(
        this.resultRepo.create({
          mrpRunId: run.id,
          partNumber: part,
          level: level.get(part) ?? 0,
          grossReq: gReq,
          scheduledReceipts: sched,
          onHand,
          safetyStock: safety,
          netReq,
          plannedQty,
          action,
          needBy,
          shortage,
          peggedDemand: null,
        }),
      );
    }
    await this.resultRepo.save(results);

    // 8. auto mode → firm everything.
    if (mode === 'auto') {
      for (const po of plannedOrders)
        await this.releasePlannedOrder(po.id, dto.createdBy ?? 'mrp');
      for (const prId of createdReqIds) {
        try {
          const order = await this.mm.convertRequisitionToPO(
            prId,
            {},
            dto.createdBy ?? 'mrp',
          );
          await this.mm.issuePO(order.id);
        } catch (err) {
          this.logger.debug(
            `Auto-convert requisition ${prId} skipped: ${(err as Error).message}`,
          );
        }
      }
    }

    run.summary = {
      parts: results.length,
      requisitions: createdReqIds.length,
      plannedOrders: plannedOrders.length,
      shortages,
      autoReleased: mode === 'auto',
    };
    await this.runRepo.save(run);

    this.signals.emitToTenant(TENANT, 'erp:mrp-completed', {
      runId: run.id,
      runNumber: run.runNumber,
      mode,
      ...run.summary,
    });
    if (shortages > 0) {
      this.signals.emitToTenant(TENANT, 'erp:critical', {
        kind: 'mrp-shortage',
        runId: run.id,
        shortages,
        message: `${shortages} parte(s) sin fuente de suministro en la corrida MRP ${run.runNumber}.`,
      });
    }

    return this.getRun(run.id);
  }

  async getRun(id: number) {
    const run = await this.runRepo.findOne({ where: { id } });
    if (!run) throw new NotFoundException(`Corrida MRP ${id} no encontrada.`);
    const results = await this.resultRepo.find({
      where: { mrpRunId: id },
      order: { level: 'ASC', partNumber: 'ASC' },
    });
    return { ...run, results };
  }
  listRuns() {
    return this.runRepo.find({ order: { createdAt: 'DESC' }, take: 50 });
  }

  // ── Planned orders ──────────────────────────────────────────────────────────
  listPlannedOrders(filters?: {
    status?: string;
    mrpRunId?: number;
    materialId?: string;
  }) {
    const where: Record<string, unknown> = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.mrpRunId) where.mrpRunId = filters.mrpRunId;
    if (filters?.materialId?.trim())
      where.partNumber = filters.materialId.trim();
    return this.plannedRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 300,
    });
  }

  /** Release a planned order (PP03): create a real Plan (work order). */
  async releasePlannedOrder(id: number, actor: string) {
    const po = await this.plannedRepo.findOne({ where: { id } });
    if (!po) throw new NotFoundException(`Orden planeada ${id} no encontrada.`);
    if (po.status !== 'planned') {
      throw new BadRequestException(
        `La orden planeada está en estado ${po.status}.`,
      );
    }
    const plan = await this.planRepo.save(
      this.planRepo.create({
        workOrder: po.plannedOrderNumber,
        model: po.partNumber,
        line: 0,
        quantity: Math.ceil(po.quantity),
        shift: 'MRP',
        status: 'pending',
        priority: 'normal',
        scheduledAt: po.needBy ?? undefined,
        dueDate: po.needBy ?? undefined,
        releasedBy: actor,
      }),
    );
    po.status = 'released';
    po.releasedPlanId = plan.id;
    await this.plannedRepo.save(po);
    this.signals.emitToTenant(TENANT, 'erp:planned-order-released', {
      plannedOrderId: po.id,
      planId: plan.id,
      workOrder: plan.workOrder,
      model: plan.model,
    });
    return { plannedOrder: po, plan };
  }

  async cancelPlannedOrder(id: number) {
    const po = await this.plannedRepo.findOne({ where: { id } });
    if (!po) throw new NotFoundException(`Orden planeada ${id} no encontrada.`);
    if (po.status === 'released') {
      throw new BadRequestException(
        'No se puede cancelar una orden ya liberada.',
      );
    }
    po.status = 'cancelled';
    return this.plannedRepo.save(po);
  }
}
