import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { MaterialRequest } from './entities/material-request.entity';
import { Kit } from '../kits/entities/kit.entity';
import { CreateMaterialRequestDto } from './dto/create-material-request.dto';
import { DecideMaterialRequestDto } from './dto/decide-material-request.dto';
import { assertTransition, MaterialRequestStatus } from './request-state';
import { SignalGateway } from '../../common/gateway/signal.gateway';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import { InventoryService } from '../inventory/inventory.service';

const DEFAULT_TENANT = 'default';

/**
 * Materials pull system — Phase 1B.
 *
 * Production raises a material request against a published kit's PickList; the
 * warehouse authorizes or rejects it. Every state change is broadcast over the
 * SignalGateway so the warehouse and production screens update in real time.
 */
@Injectable()
export class MaterialRequestsService {
  private readonly logger = new Logger(MaterialRequestsService.name);

  constructor(
    @Inject(getTenantRepositoryToken(MaterialRequest))
    private readonly repo: TenantScopedRepository<MaterialRequest>,
    @Inject(getTenantRepositoryToken(Kit))
    private readonly kitRepo: TenantScopedRepository<Kit>,
    private readonly signals: SignalGateway,
    private readonly eventLedger: EventLedgerService,
    private readonly inventory: InventoryService,
  ) {}

  async findAll(filters?: {
    kitId?: number;
    status?: MaterialRequestStatus;
  }): Promise<any[]> {
    const where: Record<string, unknown> = {};
    if (filters?.kitId) where.kitId = filters.kitId;
    if (filters?.status) where.status = filters.status;
    const rows = await this.repo.find({
      where,
      relations: ['kit', 'kit.plan'],
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => this.serialize(r));
  }

  async findOne(id: number): Promise<MaterialRequest> {
    const request = await this.repo.findOne({ where: { id } });
    if (!request)
      throw new NotFoundException(`Material request ${id} not found`);
    return request;
  }

  /** Flatten the request with its plan context for the warehouse board. */
  private serialize(r: MaterialRequest): any {
    const plan = r.kit?.plan;
    const planLine = plan?.line === undefined ? null : String(plan.line);
    return {
      id: r.id,
      kitId: r.kitId,
      requestedBy: r.requestedBy,
      status: r.status,
      note: r.note,
      workOrder: r.workOrder ?? plan?.workOrder ?? null,
      line: r.line ?? planLine,
      station: r.station,
      partNumber: r.partNumber,
      requestedQty: r.requestedQty,
      unit: r.unit,
      decidedBy: r.decidedBy,
      decidedAt: r.decidedAt,
      decisionNote: r.decisionNote,
      createdAt: r.createdAt,
      model: plan?.model ?? null,
      quantity: plan?.quantity ?? null,
    };
  }

  /** Production raises a request for a published kit. */
  async create(
    dto: CreateMaterialRequestDto,
    actor: string,
  ): Promise<MaterialRequest> {
    const kit = await this.kitRepo.findOne({
      where: { id: dto.kitId },
      relations: ['plan'],
    });
    if (!kit) throw new NotFoundException(`Kit ${dto.kitId} not found`);
    if (
      kit.plan &&
      kit.plan.status !== 'published' &&
      kit.plan.status !== 'active'
    ) {
      throw new BadRequestException(
        `Kit ${dto.kitId} has no published PickList yet (plan status: ${kit.plan?.status ?? 'unknown'}).`,
      );
    }

    const open = await this.repo.findOne({
      where: { kitId: dto.kitId, status: 'pending' },
    });
    if (open) {
      throw new BadRequestException(
        `Kit ${dto.kitId} already has a pending request (#${open.id}).`,
      );
    }

    const saved = await this.repo.save(
      this.repo.create({
        kitId: dto.kitId,
        requestedBy: actor,
        status: 'pending',
        note: dto.note ?? null,
        workOrder: this.cleanText(dto.workOrder) ?? kit.plan?.workOrder ?? null,
        line:
          this.cleanText(dto.line) ??
          (kit.plan?.line === undefined ? null : String(kit.plan.line)),
        station: this.cleanText(dto.station),
        partNumber: this.cleanText(dto.partNumber),
        requestedQty: this.cleanQty(dto.requestedQty),
        unit: this.cleanText(dto.unit),
      }),
    );

    this.broadcast('materials:request-created', saved, kit);
    await this.recordLedger('MATERIAL_REQUESTED', saved, kit, actor);
    return saved;
  }

  authorize(
    id: number,
    dto: DecideMaterialRequestDto,
    actor: string,
  ): Promise<MaterialRequest> {
    return this.decide(
      id,
      'authorized',
      'materials:request-authorized',
      'MATERIAL_REQUEST_AUTHORIZED',
      dto,
      actor,
    );
  }

  reject(
    id: number,
    dto: DecideMaterialRequestDto,
    actor: string,
  ): Promise<MaterialRequest> {
    return this.decide(
      id,
      'rejected',
      'materials:request-rejected',
      'MATERIAL_REQUEST_REJECTED',
      dto,
      actor,
    );
  }

  async fulfill(
    id: number,
    dto: DecideMaterialRequestDto,
    actor: string,
  ): Promise<MaterialRequest> {
    // Cerrar el lazo de inventario: al surtir, el material ENTRA al tanque de la
    // línea (`LINE-<línea>`), de donde el operador lo consumirá en /operador.
    // El depósito ocurre ANTES de marcar 'fulfilled' y se PROPAGA si falla — no
    // marcamos como surtido lo que no pudimos abastecer (igual que resupplies).
    const request = await this.findOne(id);
    const kit = await this.kitRepo.findOne({
      where: { id: request.kitId },
      relations: ['plan'],
    });
    await this.depositToLine(request, kit ?? null, actor);

    return this.decide(
      id,
      'fulfilled',
      'materials:request-fulfilled',
      'MATERIAL_REQUEST_FULFILLED',
      dto,
      actor,
    );
  }

  /**
   * Deposita el material surtido en el "tanque" de la línea `LINE-<línea>` para
   * que el consumo posterior (mes-execution /operador) tenga stock real de dónde
   * descontar — cerrando el lazo de inventario. Delega en el punto único
   * `InventoryService.transferToLine` (TRANSFER CONSERVATIVO: debita existencias
   * reales de los almacenes de origen y las acredita en el tanque, conservando el
   * on-hand global; sin línea registra y omite; si no hay existencias reales
   * suficientes, un fallo se PROPAGA antes de marcar surtida la solicitud).
   *
   * La línea autoritativa es la del PLAN (la que hereda la ejecución y de la que
   * el operador consume), no el texto libre `request.line`.
   */
  private async depositToLine(
    request: MaterialRequest,
    kit: Kit | null,
    actor: string,
  ): Promise<void> {
    const line = kit?.plan?.line ?? request.line ?? null;
    await this.inventory.transferToLine({
      partNumber: request.partNumber,
      quantity: request.requestedQty,
      line,
      actorName: actor,
      referenceType: 'MATERIAL_REQUEST_FULFILL',
      referenceId: String(request.id),
      reason:
        `Surtido a línea ${line} · ${request.workOrder ?? kit?.plan?.workOrder ?? ''}`.trim(),
    });
  }

  private async decide(
    id: number,
    to: MaterialRequestStatus,
    event: string,
    ledgerAction: string,
    dto: DecideMaterialRequestDto,
    actor: string,
  ): Promise<MaterialRequest> {
    const request = await this.findOne(id);
    try {
      assertTransition(request.status, to);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    request.status = to;
    request.decidedBy = actor;
    request.decidedAt = new Date();
    if (dto.decisionNote !== undefined) request.decisionNote = dto.decisionNote;
    const saved = await this.repo.save(request);

    const kit = await this.kitRepo.findOne({
      where: { id: saved.kitId },
      relations: ['plan'],
    });
    this.broadcast(event, saved, kit ?? undefined);
    await this.recordLedger(ledgerAction, saved, kit ?? undefined, actor);
    return saved;
  }

  private broadcast(
    event: string,
    request: MaterialRequest,
    kit?: Kit | null,
  ): void {
    this.signals.emitToTenant(DEFAULT_TENANT, event, {
      id: request.id,
      kitId: request.kitId,
      status: request.status,
      requestedBy: request.requestedBy,
      decidedBy: request.decidedBy,
      workOrder: request.workOrder ?? kit?.plan?.workOrder,
      station: request.station,
      partNumber: request.partNumber,
      requestedQty: request.requestedQty,
      unit: request.unit,
      model: kit?.plan?.model,
      line: request.line ?? kit?.plan?.line,
    });
  }

  private async recordLedger(
    action: string,
    request: MaterialRequest,
    kit: Kit | undefined | null,
    actor: string,
  ): Promise<void> {
    try {
      await this.eventLedger.recordEvent({
        domain: EventDomain.MATERIALS,
        action,
        referenceType: 'MATERIAL_REQUEST',
        referenceId: String(request.id),
        actorName: actor,
        model: kit?.plan?.model,
        workOrder: request.workOrder ?? kit?.plan?.workOrder,
        line: request.line ?? kit?.plan?.line?.toString(),
        metadata: {
          kitId: request.kitId,
          status: request.status,
          station: request.station,
          partNumber: request.partNumber,
          requestedQty: request.requestedQty,
          unit: request.unit,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to record ledger event ${action} for material request ${request.id}`,
        err as Error,
      );
    }
  }

  private cleanText(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private cleanQty(value: unknown): number | null {
    const qty = Number(value);
    return Number.isFinite(qty) && qty > 0 ? qty : null;
  }
}
