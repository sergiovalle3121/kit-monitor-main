import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Plan } from '../plans/entities/plan.entity';
import { PickListService } from '../pick-lists/pick-list.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import { InventoryPosition } from '../inventory/entities/inventory-position.entity';
import { InventoryService } from '../inventory/inventory.service';
import {
  MesStagingLine,
  MesStagingStatus,
} from './entities/mes-staging-line.entity';
import { StagePlanLineDto } from './dto/material-staging-mes.dto';

/** A pick-list line (kit_materials) as returned by PickListService.getByPlan. */
interface PickListLine {
  id: number;
  partNumber: string;
  description?: string | null;
  quantityRequired: number;
  quantityActual?: number | null;
  quantityConsumed?: number | null;
  quantityRemaining?: number | null;
  unit?: string;
}

/** Shape of PickListService.getByPlan(planId) (typed locally; it returns `any`). */
interface PickListResult {
  planId: number;
  workOrder: string | null;
  model: string;
  quantity: number;
  status: string;
  published: boolean;
  publishedAt: Date | null;
  publishedBy: string | null;
  kitId: number | null;
  lineCount: number;
  lines: PickListLine[];
}

interface StagingSummary {
  totalLines: number;
  stagedLines: number;
  shortageLines: number;
  stockShortageLines: number;
  fillRatePct: number;
  allStaged: boolean;
  stockReady: boolean;
}

interface LineStockSnapshot {
  availableQty: number;
  shortageQty: number;
}

/**
 * Carril 1 (puente MES) del kitteador — capa SEPARADA y aditiva.
 *
 * Lee los PLANES publicados (Plan + kit ligado) como cola de surtido y devuelve,
 * por plan, su pick-list vía `PickListService.getByPlan(planId)`. El surtido se
 * registra en un estado PROPIO (`sf_mes_staging`), nunca en el carril 2
 * (`sf_staging`) ni en el kit que lee el operador MES. Retirar el puente (Forma 2)
 * = borrar esta clase + el módulo carril 1, sin desenredar el carril 2.
 */
@Injectable()
export class MaterialStagingMesService {
  private readonly logger = new Logger(MaterialStagingMesService.name);

  constructor(
    // Plain repo (como mes-execution / plans): los planes no son tenant-scoped,
    // así el kitteador ve los MISMOS planes que monta el operador en /operador.
    @Inject(getTenantRepositoryToken(MesStagingLine))
    private readonly staging: TenantScopedRepository<MesStagingLine>,
    @Inject(getTenantRepositoryToken(InventoryPosition))
    private readonly positions: TenantScopedRepository<InventoryPosition>,
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
    private readonly pickList: PickListService,
    private readonly tenantCtx: TenantContextService,
    private readonly inventory: InventoryService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  /**
   * Surtir a línea = abastecer el "tanque" `LINE-<línea>` del que el operador
   * consume en /operador. Resuelve la línea del PLAN (la que hereda la ejecución)
   * y delega en `InventoryService.issueToLine` (ISSUE; crea la posición destino
   * si no existe; sin línea registra y omite; un fallo se PROPAGA). Cierra el
   * lazo de inventario para el flujo principal de surtido por plan.
   */
  private async depositStagedToLine(opts: {
    planId: number;
    line: number | string | null;
    workOrder: string | null;
    partNumber: string;
    stagedQty: number;
  }): Promise<void> {
    await this.inventory.issueToLine({
      partNumber: opts.partNumber,
      quantity: opts.stagedQty,
      line: opts.line,
      actorName: this.tenantCtx.getUserEmail() ?? 'mes-staging',
      referenceType: 'MES_STAGING',
      referenceId: String(opts.planId),
      reason:
        `Surtido a línea ${opts.line ?? '—'} · ${opts.workOrder ?? ''}`.trim(),
    });
  }

  // ── Cola de surtido: planes publicados (kit ligado, status != cancelled) ──────
  async listPublishedPlans(filters: { status?: string } = {}): Promise<any[]> {
    const qb = this.planRepo
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.kit', 'kit')
      .leftJoinAndSelect('kit.materials', 'materials')
      .where('kit.id IS NOT NULL')
      .andWhere('plan.status != :cancelled', { cancelled: 'cancelled' })
      .orderBy('plan.createdAt', 'DESC');
    if (filters.status)
      qb.andWhere('plan.status = :st', { st: filters.status });
    const plans = await qb.getMany();

    const planIds = plans.map((p) => p.id);
    const rows = planIds.length
      ? await this.staging.find({ where: { planId: In(planIds) } })
      : [];
    const byPlan = new Map<number, MesStagingLine[]>();
    for (const r of rows) {
      const list = byPlan.get(r.planId) ?? [];
      list.push(r);
      byPlan.set(r.planId, list);
    }

    return plans.map((plan) => {
      const totalLines = plan.kit?.materials?.length ?? 0;
      const planRows = byPlan.get(plan.id) ?? [];
      const stagedLines = planRows.filter((r) => r.status === 'STAGED').length;
      const shortageLines = planRows.filter(
        (r) => r.status === 'SHORTAGE',
      ).length;
      return {
        planId: plan.id,
        workOrder: plan.workOrder,
        model: plan.model,
        line: plan.line,
        quantity: plan.quantity,
        priority: plan.priority,
        status: plan.status,
        publishedAt: plan.publishedAt ?? null,
        kitId: plan.kit?.id ?? null,
        totalLines,
        stagedLines,
        shortageLines,
        fillRatePct: totalLines ? round(stagedLines / totalLines, 4) : 0,
        allStaged: totalLines > 0 && stagedLines >= totalLines,
      };
    });
  }

  // ── Pick-list de un plan + estado de surtido carril 1 ────────────────────────
  async getPlanPickList(planId: number): Promise<any> {
    const pick = (await this.pickList.getByPlan(planId)) as PickListResult; // vía PickListService
    const rows = await this.staging.find({ where: { planId } });
    const byKitMat = new Map<number, MesStagingLine>();
    for (const r of rows)
      if (r.kitMaterialId != null) byKitMat.set(r.kitMaterialId, r);

    const pickLines = pick.lines ?? [];
    const stockByLine = await this.stockByLine(pickLines);
    const lines = pickLines.map((l) => {
      const st = byKitMat.get(l.id);
      const requiredQty = Number(l.quantityRequired) || 0;
      const stagedQty = st ? Number(st.stagedQty) : 0;
      const stagingStatus: MesStagingStatus = st?.status ?? 'PENDING';
      const stock = stockByLine.get(l.id) ?? {
        availableQty: 0,
        shortageQty: requiredQty,
      };
      return {
        id: l.id,
        partNumber: l.partNumber,
        description: l.description ?? null,
        unit: l.unit ?? 'EA',
        quantityRequired: requiredQty,
        quantityActual: l.quantityActual ?? null,
        quantityConsumed: l.quantityConsumed ?? null,
        quantityRemaining: l.quantityRemaining ?? null,
        requiredQty,
        stagedQty,
        stagingStatus,
        availableQty: stock.availableQty,
        shortageQty: stock.shortageQty,
        stockStatus: stock.shortageQty > 0 ? 'SHORTAGE' : 'READY',
        staged: stagingStatus === 'STAGED',
      };
    });

    return { ...pick, lines, summary: summarize(lines) };
  }

  // ── Marcar surtido (staged) ──────────────────────────────────────────────────
  async stageLine(
    planId: number,
    kitMaterialId: number,
    dto: StagePlanLineDto,
  ): Promise<any> {
    const pick = (await this.pickList.getByPlan(planId)) as PickListResult;
    const line = (pick.lines ?? []).find((l) => l.id === kitMaterialId);
    if (!line) {
      throw new NotFoundException(
        `La línea ${kitMaterialId} no existe en el pick-list del plan ${planId}.`,
      );
    }
    const requiredQty = Number(line.quantityRequired) || 0;
    const stagedQty =
      dto?.stagedQty != null ? Number(dto.stagedQty) : requiredQty;
    await this.assertStockAvailableForLine(planId, line, stagedQty);
    await this.upsert(
      planId,
      pick.workOrder ?? null,
      line,
      requiredQty,
      stagedQty,
    );
    // Cerrar el lazo: el material surtido ENTRA al tanque `LINE-<línea>`.
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    await this.depositStagedToLine({
      planId,
      line: plan?.line ?? null,
      workOrder: pick.workOrder ?? null,
      partNumber: line.partNumber,
      stagedQty,
    });
    await this.record('MES_STAGING_LINE_STAGED', planId, {
      kitMaterialId,
      part: line.partNumber,
      stagedQty,
    });
    return this.getPlanPickList(planId);
  }

  async stageAllForPlan(planId: number): Promise<any> {
    const pick = (await this.pickList.getByPlan(planId)) as PickListResult;
    const lines = pick.lines ?? [];
    await this.assertAllStockAvailable(lines);
    // Línea del plan resuelta una vez para abastecer el tanque `LINE-<línea>`.
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    for (const line of lines) {
      const requiredQty = Number(line.quantityRequired) || 0;
      await this.upsert(
        planId,
        pick.workOrder ?? null,
        line,
        requiredQty,
        requiredQty,
      );
      await this.depositStagedToLine({
        planId,
        line: plan?.line ?? null,
        workOrder: pick.workOrder ?? null,
        partNumber: line.partNumber,
        stagedQty: requiredQty,
      });
    }
    await this.record('MES_STAGING_PLAN_STAGED', planId, {
      lines: lines.length,
    });
    return this.getPlanPickList(planId);
  }

  async unstageLine(planId: number, kitMaterialId: number): Promise<any> {
    const row = await this.staging.findOne({
      where: { planId, kitMaterialId },
    });
    if (row) {
      row.stagedQty = 0;
      row.status = 'PENDING';
      row.stagedAt = null;
      await this.staging.save(row);
      await this.record('MES_STAGING_LINE_UNSTAGED', planId, { kitMaterialId });
    }
    return this.getPlanPickList(planId);
  }

  // ── Internos ─────────────────────────────────────────────────────────────────
  private async upsert(
    planId: number,
    workOrder: string | null,
    line: PickListLine,
    requiredQty: number,
    stagedQty: number,
  ): Promise<MesStagingLine> {
    const status = deriveStagedStatus(requiredQty, stagedQty);
    const stagedAt = status === 'STAGED' ? new Date() : null;
    let row = await this.staging.findOne({
      where: { planId, kitMaterialId: line.id },
    });
    if (!row) {
      row = this.staging.create({
        planId,
        workOrder,
        kitMaterialId: line.id,
        part: line.partNumber,
        requiredQty,
        stagedQty,
        status,
        stagedAt,
        stagedBy: this.tenantCtx.getUserEmail(),
        ...this.scopeFields(),
      });
    } else {
      row.part = line.partNumber;
      row.requiredQty = requiredQty;
      row.stagedQty = stagedQty;
      row.status = status;
      row.stagedAt = stagedAt;
      row.stagedBy = this.tenantCtx.getUserEmail();
    }
    return this.staging.save(row);
  }

  private async assertAllStockAvailable(lines: PickListLine[]): Promise<void> {
    const availableByPart = await this.availableByPart(
      lines.map((line) => line.partNumber),
    );
    const demandByPart = this.demandByPart(lines);
    const shortages = [...demandByPart.entries()]
      .map(([partNumber, demand]) => {
        const availableQty = availableByPart.get(partNumber) ?? 0;
        const shortageQty = round(
          Math.max(0, demand.requiredQty - availableQty),
        );
        return {
          partNumber,
          requiredQty: demand.requiredQty,
          availableQty,
          shortageQty,
          unit: demand.unit,
        };
      })
      .filter((line) => line.shortageQty > 0);

    if (shortages.length === 0) return;

    const detail = shortages
      .slice(0, 3)
      .map(
        (line) =>
          `${line.partNumber}: faltan ${line.shortageQty} ${line.unit} (req ${line.requiredQty}, disp ${line.availableQty})`,
      )
      .join('; ');
    throw new BadRequestException(
      `No se puede surtir el plan: inventario disponible insuficiente. ${detail}`,
    );
  }

  private async assertStockAvailableForLine(
    planId: number,
    line: PickListLine,
    stagedQty: number,
  ): Promise<void> {
    const availableQty = await this.availableForPart(line.partNumber);
    const requestedQty = Math.max(0, Number(stagedQty) || 0);
    const siblingRows = await this.staging.find({
      where: { planId, part: line.partNumber },
    });
    const alreadyStagedForPart = siblingRows
      .filter((row) => row.kitMaterialId !== line.id)
      .reduce((sum, row) => sum + (Number(row.stagedQty) || 0), 0);
    const projectedQty = round(alreadyStagedForPart + requestedQty);
    if (projectedQty <= availableQty) return;

    throw new BadRequestException(
      `No se puede surtir ${line.partNumber}: faltan ${round(
        projectedQty - availableQty,
      )} ${line.unit ?? 'EA'} (req ${projectedQty}, disp ${availableQty}).`,
    );
  }

  private async availableForPart(partNumber: string): Promise<number> {
    const availableByPart = await this.availableByPart([partNumber]);
    return availableByPart.get(partNumber) ?? 0;
  }

  private async availableByPart(parts: string[]): Promise<Map<string, number>> {
    const partNumbers = [...new Set(parts.filter(Boolean))];
    const availableByPart = new Map<string, number>();
    if (partNumbers.length === 0) return availableByPart;

    const positions = await this.positions.find({
      where: { partNumber: In(partNumbers), holdStatus: 'available' },
    });
    for (const position of positions) {
      const available = Math.max(
        0,
        (Number(position.onHand) || 0) - (Number(position.allocated) || 0),
      );
      availableByPart.set(
        position.partNumber,
        round((availableByPart.get(position.partNumber) ?? 0) + available),
      );
    }
    return availableByPart;
  }

  private async stockByLine(
    lines: PickListLine[],
  ): Promise<Map<number, LineStockSnapshot>> {
    const availableByPart = await this.availableByPart(
      lines.map((line) => line.partNumber),
    );
    const remainingByPart = new Map(availableByPart);
    const stockByLine = new Map<number, LineStockSnapshot>();
    for (const line of lines) {
      const requiredQty = Number(line.quantityRequired) || 0;
      const availableQty = remainingByPart.get(line.partNumber) ?? 0;
      const shortageQty = round(Math.max(0, requiredQty - availableQty));
      stockByLine.set(line.id, {
        availableQty: round(Math.max(0, availableQty)),
        shortageQty,
      });
      remainingByPart.set(
        line.partNumber,
        round(Math.max(0, availableQty - requiredQty)),
      );
    }
    return stockByLine;
  }

  private demandByPart(lines: PickListLine[]): Map<
    string,
    {
      requiredQty: number;
      unit: string;
    }
  > {
    const demandByPart = new Map<
      string,
      { requiredQty: number; unit: string }
    >();
    for (const line of lines) {
      if (!line.partNumber) continue;
      const existing = demandByPart.get(line.partNumber) ?? {
        requiredQty: 0,
        unit: line.unit ?? 'EA',
      };
      existing.requiredQty = round(
        existing.requiredQty + (Number(line.quantityRequired) || 0),
      );
      demandByPart.set(line.partNumber, existing);
    }
    return demandByPart;
  }

  private scopeFields() {
    return {
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    };
  }

  private async record(
    action: string,
    planId: number,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.MATERIALS,
        action,
        referenceType: 'SF_MES_STAGING',
        referenceId: String(planId),
        plant: this.tenantCtx.getPlantId() ?? undefined,
        metadata,
      });
    } catch (err) {
      this.logger.warn(
        `Ledger skipped for ${action}: ${(err as Error)?.message}`,
      );
    }
  }
}

/** Lane-1 status from staged vs required quantity (self-contained — no lane-2 dep). */
export function deriveStagedStatus(
  requiredQty: number,
  stagedQty: number,
): MesStagingStatus {
  if (Number(stagedQty) >= Number(requiredQty) && Number(requiredQty) > 0)
    return 'STAGED';
  return 'PENDING';
}

function summarize(
  lines: {
    staged: boolean;
    stagingStatus: MesStagingStatus;
    shortageQty?: number;
  }[],
): StagingSummary {
  const totalLines = lines.length;
  const stagedLines = lines.filter((l) => l.staged).length;
  const shortageLines = lines.filter(
    (l) => l.stagingStatus === 'SHORTAGE',
  ).length;
  const stockShortageLines = lines.filter(
    (l) => Number(l.shortageQty) > 0,
  ).length;
  return {
    totalLines,
    stagedLines,
    shortageLines,
    stockShortageLines,
    fillRatePct: totalLines ? round(stagedLines / totalLines, 4) : 0,
    allStaged: totalLines > 0 && stagedLines >= totalLines,
    stockReady: stockShortageLines === 0,
  };
}

function round(n: number, dp = 4): number {
  const f = Math.pow(10, dp);
  return Math.round((Number(n) || 0) * f) / f;
}
