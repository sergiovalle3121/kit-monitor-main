import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Plan } from '../plans/entities/plan.entity';
import { Kit } from '../kits/entities/kit.entity';
import { BomItem } from '../bom/entities/bom-item.entity';
import { BomHeader, BomStatus } from '../bom/entities/bom-header.entity';
import { KitMaterial } from '../kit-materials/entities/kit-material.entity';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import { explodeBom, BomExplosionInput } from './bom-explosion';

/**
 * Materials pull system — Phase 1A.
 *
 * Turns a published production plan into a PickList: the BOM for the plan's
 * model is exploded against the plan quantity and persisted as `kit_materials`
 * rows under a warehouse Kit. This is the hand-off point from Planning to the
 * warehouse; later phases layer production requests and socket authorization on
 * top of the PickList created here.
 */
@Injectable()
export class PickListService {
  private readonly logger = new Logger(PickListService.name);

  constructor(
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
    @InjectRepository(BomItem) private readonly bomRepo: Repository<BomItem>,
    @InjectRepository(BomHeader)
    private readonly bomHeaderRepo: Repository<BomHeader>,
    private readonly dataSource: DataSource,
    private readonly eventLedger: EventLedgerService,
  ) {}

  /**
   * Resolve the BOM lines to explode for a model. Prefers the SAP-style ACTIVE
   * BomHeader (the one captured from the Model master in NPI); falls back to the
   * legacy flat `bom_items` so older imported BOMs keep working. Returns the
   * per-finished-unit usage so `explodeBom` can scale it by the plan quantity.
   */
  private async resolveBomInput(model: string): Promise<BomExplosionInput[]> {
    const headers = await this.bomHeaderRepo.find({
      where: { model, status: BomStatus.ACTIVE },
      relations: ['components'],
      order: { createdAt: 'DESC' },
    });
    const header = headers[0];
    if (header && header.components?.length) {
      const base = Number(header.baseQuantity) || 1;
      return header.components.map((c) => ({
        partNumber: c.componentNumber,
        description: c.description,
        // per finished unit = (qty per base × scrap factor) / base quantity
        usageFactor:
          (Number(c.quantity) * (Number(c.usageFactor) || 1)) / base,
        unit: c.unit,
      }));
    }
    return this.bomRepo.findBy({ model });
  }

  /**
   * Publish a plan: explode its BOM and generate the warehouse PickList.
   * Idempotent guard — a plan can only be published once (one Kit per plan).
   */
  async publishPlan(planId: number, actor: string): Promise<any> {
    const plan = await this.planRepo.findOne({
      where: { id: planId },
      relations: ['kit'],
    });
    if (!plan) throw new NotFoundException(`Plan ${planId} not found`);
    if (plan.kit) {
      throw new BadRequestException(
        `Plan ${planId} already has a pick list (kit #${plan.kit.id}). Publish only generates it once.`,
      );
    }
    if (!plan.quantity || plan.quantity <= 0) {
      throw new BadRequestException(
        `Plan ${planId} has no positive quantity to plan materials for.`,
      );
    }

    const bomInput = await this.resolveBomInput(plan.model);
    if (!bomInput.length) {
      throw new BadRequestException(
        `No hay BOM para el modelo "${plan.model}". Activa su BOM en Modelos (o cárgalo) antes de publicar el plan.`,
      );
    }

    const lines = explodeBom(bomInput, plan.quantity);

    await this.dataSource.transaction(async (em) => {
      const kit = await em.save(
        Kit,
        em.create(Kit, { plan: { id: plan.id } as Plan, status: 'preparing' }),
      );

      const materials = lines.map((line) =>
        em.create(KitMaterial, {
          kit: { id: kit.id } as Kit,
          partNumber: line.partNumber,
          description: line.description,
          quantityRequired: line.quantityRequired,
          quantityActual: null,
          quantityConsumed: 0,
          quantityRemaining: line.quantityRequired,
          isBulkResupply: false,
          unit: line.unit,
        }),
      );
      await em.save(KitMaterial, materials);

      await em.update(Plan, plan.id, {
        status: 'published',
        publishedAt: new Date(),
        publishedBy: actor,
      });
    });

    // Ledger is best-effort: the PickList is already committed, so never let an
    // audit write failure surface as a publish failure.
    try {
      await this.eventLedger.recordEvent({
        domain: EventDomain.MATERIALS,
        action: 'PICKLIST_GENERATED',
        referenceType: 'PLAN',
        referenceId: String(plan.id),
        actorName: actor,
        model: plan.model,
        workOrder: plan.workOrder,
        line: plan.line?.toString(),
        shift: plan.shift,
        transaction: { quantity: plan.quantity },
        metadata: { pickListLines: lines.length },
      });
    } catch (err) {
      this.logger.error(
        `Failed to record PICKLIST_GENERATED ledger event for plan ${plan.id}`,
        err as Error,
      );
    }

    return this.getByPlan(plan.id);
  }

  /**
   * Preview the materials a plan would pull WITHOUT publishing it: explode the
   * model's ACTIVE BOM against the plan quantity. Lets Planning show the real
   * requirement (and whether the model even has an active BOM) before commit.
   */
  async previewPlan(planId: number): Promise<any> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Plan ${planId} not found`);
    const bomInput = await this.resolveBomInput(plan.model);
    const lines =
      bomInput.length && plan.quantity > 0
        ? explodeBom(bomInput, plan.quantity)
        : [];
    return {
      planId: plan.id,
      model: plan.model,
      quantity: plan.quantity,
      hasBom: bomInput.length > 0,
      lineCount: lines.length,
      lines,
    };
  }

  /** Return the generated PickList (and publication state) for a plan. */
  async getByPlan(planId: number): Promise<any> {
    const plan = await this.planRepo.findOne({
      where: { id: planId },
      relations: ['kit', 'kit.materials'],
    });
    if (!plan) throw new NotFoundException(`Plan ${planId} not found`);

    const lines = plan.kit?.materials ?? [];
    return {
      planId: plan.id,
      workOrder: plan.workOrder,
      model: plan.model,
      quantity: plan.quantity,
      status: plan.status,
      published: plan.status === 'published',
      publishedAt: plan.publishedAt ?? null,
      publishedBy: plan.publishedBy ?? null,
      kitId: plan.kit?.id ?? null,
      lineCount: lines.length,
      lines,
    };
  }
}
