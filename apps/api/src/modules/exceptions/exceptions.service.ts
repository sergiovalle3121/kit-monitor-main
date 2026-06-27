import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { KitException } from './entities/kit-exception.entity';
import { Kit } from '../kits/entities/kit.entity';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { CreateExceptionDto } from './dto/create-exception.dto';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';

@Injectable()
export class ExceptionsService {
  constructor(
    @Inject(getTenantRepositoryToken(KitException))
    private readonly repo: TenantScopedRepository<KitException>,
    @Inject(getTenantRepositoryToken(Kit))
    private readonly kitRepo: TenantScopedRepository<Kit>,
    private readonly eventLedger: EventLedgerService,
  ) {}

  findByKit(kitId: number): Promise<KitException[]> {
    return this.repo.find({
      where: { kit: { id: kitId } },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<KitException> {
    const item = await this.repo.findOneBy({ id });
    if (!item) throw new NotFoundException(`Exception ${id} not found`);
    return item;
  }

  async create(dto: CreateExceptionDto): Promise<KitException> {
    const kit = await this.kitRepo.findOne({ where: { id: dto.kitId }, relations: ['plan'] });
    if (!kit) throw new NotFoundException('Kit not found');

    const exception = this.repo.create({
      kit: { id: dto.kitId } as Kit,
      type: dto.type,
      partNumber: dto.partNumber,
      description: dto.description,
    });
    const saved = await this.repo.save(exception);

    // Ledger Event
    await this.eventLedger.recordEvent({
      domain: EventDomain.MATERIALS,
      action: dto.type === 'missing_material' ? 'SHORTAGE_DETECTED' : 'EXCEPTION_REPORTED',
      referenceType: 'KIT',
      referenceId: kit.id.toString(),
      model: kit.plan?.model,
      workOrder: kit.plan?.workOrder,
      line: kit.plan?.line?.toString(),
      metadata: {
        reasonCode: dto.type,
        reasonDesc: dto.description,
        partNumber: dto.partNumber,
      },
    });

    return saved;
  }

  async resolve(id: number): Promise<KitException> {
    const item = await this.findOne(id);
    await this.repo.update(id, { status: 'resolved', resolvedAt: new Date() });
    
    const kit = await this.kitRepo.findOne({ where: { id: item.kit.id }, relations: ['plan'] });

    // Ledger Event
    if (kit) {
      await this.eventLedger.recordEvent({
        domain: EventDomain.MATERIALS,
        action: item.type === 'missing_material' ? 'SHORTAGE_RESOLVED' : 'EXCEPTION_RESOLVED',
        referenceType: 'KIT',
        referenceId: kit.id.toString(),
        model: kit.plan?.model,
        workOrder: kit.plan?.workOrder,
        line: kit.plan?.line?.toString(),
        metadata: {
          reasonCode: item.type,
          partNumber: item.partNumber,
        },
      });
    }

    return this.findOne(id);
  }
}
