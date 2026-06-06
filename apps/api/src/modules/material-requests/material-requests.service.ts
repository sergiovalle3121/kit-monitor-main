import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaterialRequest } from './entities/material-request.entity';
import { Kit } from '../kits/entities/kit.entity';
import { CreateMaterialRequestDto } from './dto/create-material-request.dto';
import { DecideMaterialRequestDto } from './dto/decide-material-request.dto';
import { assertTransition, MaterialRequestStatus } from './request-state';
import { SignalGateway } from '../../common/gateway/signal.gateway';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';

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
    @InjectRepository(MaterialRequest)
    private readonly repo: Repository<MaterialRequest>,
    @InjectRepository(Kit) private readonly kitRepo: Repository<Kit>,
    private readonly signals: SignalGateway,
    private readonly eventLedger: EventLedgerService,
  ) {}

  async findAll(filters?: {
    kitId?: number;
    status?: MaterialRequestStatus;
  }): Promise<MaterialRequest[]> {
    const where: Record<string, unknown> = {};
    if (filters?.kitId) where.kitId = filters.kitId;
    if (filters?.status) where.status = filters.status;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(id: number): Promise<MaterialRequest> {
    const request = await this.repo.findOne({ where: { id } });
    if (!request)
      throw new NotFoundException(`Material request ${id} not found`);
    return request;
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

  fulfill(
    id: number,
    dto: DecideMaterialRequestDto,
    actor: string,
  ): Promise<MaterialRequest> {
    return this.decide(
      id,
      'fulfilled',
      'materials:request-fulfilled',
      'MATERIAL_REQUEST_FULFILLED',
      dto,
      actor,
    );
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
      workOrder: kit?.plan?.workOrder,
      model: kit?.plan?.model,
      line: kit?.plan?.line,
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
        workOrder: kit?.plan?.workOrder,
        line: kit?.plan?.line?.toString(),
        metadata: { kitId: request.kitId, status: request.status },
      });
    } catch (err) {
      this.logger.error(
        `Failed to record ledger event ${action} for material request ${request.id}`,
        err as Error,
      );
    }
  }
}
