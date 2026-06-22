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
  
  plant?: string;
  warehouse?: string;
  line?: string;
  shift?: string;
  customer?: string;
  program?: string;
  model?: string;
  workOrder?: string;

  context?: {
    revision?: string;
    lot?: string;
    serial?: string;
    [key: string]: any;
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
        plant: dto.plant,
        warehouse: dto.warehouse,
        line: dto.line,
        shift: dto.shift,
        customer: dto.customer,
        program: dto.program,
        model: dto.model,
        workOrder: dto.workOrder,
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

  /**
   * Feed global de la bitácora: los eventos más recientes (orden DESC), con un
   * tope acotado. El frontend filtra por dominio/entidad/fecha del lado cliente,
   * así que aquí solo devolvemos la ventana reciente. `limit` se sanea a [1,1000].
   */
  async findRecent(limit = 200): Promise<LedgerEvent[]> {
    const take = Math.min(Math.max(Number.isFinite(limit) ? limit : 200, 1), 1000);
    return this.ledgerRepository.find({
      order: { timestamp: 'DESC' },
      take,
    });
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
