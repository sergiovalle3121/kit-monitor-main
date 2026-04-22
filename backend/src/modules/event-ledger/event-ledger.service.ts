import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LedgerEvent, EventDomain } from './entities/ledger-event.entity';

export interface CreateLedgerEventDto {
  actorId?: string;
  actorName?: string;
  domain: EventDomain;
  action: string;
  referenceType?: string;
  referenceId?: string;
  context?: {
    plant?: string;
    warehouse?: string;
    line?: string;
    shift?: string;
    customer?: string;
    program?: string;
    model?: string;
    workOrder?: string;
    revision?: string;
    lot?: string;
    serial?: string;
  };
  transaction?: {
    quantity?: number;
    fromLocation?: string;
    toLocation?: string;
    unit?: string;
  };
  metadata?: {
    reasonCode?: string;
    reasonDesc?: string;
    approvalContext?: any;
    beforeState?: any;
    afterState?: any;
    [key: string]: any;
  };
}

@Injectable()
export class EventLedgerService {
  private readonly logger = new Logger(EventLedgerService.name);

  constructor(
    @InjectRepository(LedgerEvent)
    private readonly ledgerRepository: Repository<LedgerEvent>,
  ) {}

  async recordEvent(dto: CreateLedgerEventDto): Promise<LedgerEvent> {
    try {
      const event = this.ledgerRepository.create({
        ...dto,
        context: dto.context || {},
        transaction: dto.transaction || {},
        metadata: dto.metadata || {},
      });
      const saved = await this.ledgerRepository.save(event);
      this.logger.log(`Event recorded: [${dto.domain}] ${dto.action} on ${dto.referenceType}:${dto.referenceId}`);
      return saved;
    } catch (error) {
      this.logger.error(`Failed to record event: [${dto.domain}] ${dto.action}`, error);
      // In a strict environment, failing to write to ledger might revert the transaction.
      // For now, we log it and avoid crashing the main workflow.
      throw error;
    }
  }

  async getEventsByReference(referenceType: string, referenceId: string): Promise<LedgerEvent[]> {
    return this.ledgerRepository.find({
      where: { referenceType, referenceId },
      order: { timestamp: 'DESC' },
    });
  }

  async getEventsByWorkOrder(workOrder: string): Promise<LedgerEvent[]> {
    return this.ledgerRepository.createQueryBuilder('event')
      .where("event.context->>'workOrder' = :workOrder", { workOrder })
      .orderBy('event.timestamp', 'DESC')
      .getMany();
  }
}
