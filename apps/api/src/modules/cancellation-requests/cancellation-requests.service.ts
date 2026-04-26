import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { CancellationRequest } from './entities/cancellation-request.entity';
import { CreateCancellationRequestDto } from './dto/create-cancellation-request.dto';
import { RespondCancellationRequestDto } from './dto/respond-cancellation-request.dto';
import { Plan } from '../plans/entities/plan.entity';
import { Kit } from '../kits/entities/kit.entity';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';

@Injectable()
export class CancellationRequestsService
  implements OnModuleInit, OnModuleDestroy
{
  private expireTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(CancellationRequest)
    private readonly repo: Repository<CancellationRequest>,
    @InjectRepository(Plan)
    private readonly plansRepo: Repository<Plan>,
    @InjectRepository(Kit)
    private readonly kitsRepo: Repository<Kit>,
    private readonly eventLedger: EventLedgerService,
  ) {}

  onModuleInit(): void {
    this.expireTimer = setInterval(() => {
      void this.expirePending();
    }, 60_000);
  }

  onModuleDestroy(): void {
    if (this.expireTimer) clearInterval(this.expireTimer);
  }

  async create(
    dto: CreateCancellationRequestDto,
  ): Promise<CancellationRequest> {
    const publication = await this.plansRepo.findOne({
      where: { id: dto.publicationId },
      relations: ['kit'],
    });
    if (!publication)
      throw new NotFoundException(
        `Publicación ${dto.publicationId} no encontrada`,
      );

    const kitId = dto.kitId ?? publication.kit?.id;
    if (!kitId)
      throw new BadRequestException('La publicación no tiene kit ligado');

    const kit = await this.kitsRepo.findOne({
      where: { id: kitId },
      relations: ['plan'],
    });
    if (!kit) throw new NotFoundException(`Kit ${kitId} no encontrado`);

    const pending = await this.repo.findOne({
      where: { kit: { id: kit.id }, status: 'pending' },
    });
    if (pending) {
      throw new BadRequestException(
        'Ya existe una solicitud pendiente para este kit',
      );
    }

    const request = this.repo.create({
      publication,
      kit,
      requestedBy: dto.requestedBy?.trim() || 'planeacion',
      status: 'pending',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      respondedAt: null,
    });

    const saved = await this.repo.save(request);

    // Ledger Event
    await this.eventLedger.recordEvent({
      domain: EventDomain.MATERIALS,
      action: 'CANCELLATION_REQUESTED',
      actorName: request.requestedBy,
      referenceType: 'KIT',
      referenceId: kit.id.toString(),
      model: kit.plan?.model,
      workOrder: kit.plan?.workOrder,
      line: kit.plan?.line?.toString(),
    });

    return saved;
  }

  async findPending(): Promise<CancellationRequest[]> {
    await this.expirePending();
    return this.repo.find({
      where: { status: 'pending' },
      order: { createdAt: 'DESC' },
    });
  }

  async findRecent(): Promise<CancellationRequest[]> {
    await this.expirePending();
    return this.repo.find({
      order: { createdAt: 'DESC' },
      take: 80,
    });
  }

  async respond(
    id: number,
    dto: RespondCancellationRequestDto,
  ): Promise<CancellationRequest> {
    const request = await this.repo.findOne({
      where: { id },
      relations: ['kit', 'publication'],
    });
    if (!request) throw new NotFoundException(`Solicitud ${id} no encontrada`);
    if (request.status !== 'pending') {
      throw new BadRequestException(
        `La solicitud ya fue atendida (${request.status})`,
      );
    }

    const nextStatus = dto.action === 'accept' ? 'accepted' : 'rejected';
    request.status = nextStatus;
    request.respondedAt = new Date();

    if (dto.action === 'accept') {
      await this.kitsRepo.update(request.kit.id, {
        status: 'cancelled',
      });
      await this.plansRepo.update(request.publication.id, {
        status: 'cancelled',
      });
    }

    const saved = await this.repo.save(request);

    // Ledger Event
    await this.eventLedger.recordEvent({
      domain: EventDomain.MATERIALS,
      action:
        dto.action === 'accept'
          ? 'CANCELLATION_APPROVED'
          : 'CANCELLATION_REJECTED',
      referenceType: 'KIT',
      referenceId: request.kit.id.toString(),
      model: request.kit.plan?.model,
      workOrder: request.kit.plan?.workOrder,
      line: request.kit.plan?.line?.toString(),
      metadata: {
        approvalContext: dto.action,
      },
    });

    return saved;
  }

  async expirePending(): Promise<number> {
    const expired = await this.repo.find({
      where: {
        status: 'pending',
        expiresAt: LessThan(new Date()),
      },
    });

    if (!expired.length) return 0;

    for (const request of expired) {
      request.status = 'expired';
      request.respondedAt = new Date();
    }

    await this.repo.save(expired);
    return expired.length;
  }
}
