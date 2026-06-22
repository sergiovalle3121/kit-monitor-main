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

  /**
   * Analytical roll-up of recent ledger activity — the read primitive behind
   * CIDE's "operations pulse". Aggregates the immutable event stream over a time
   * window into counts by domain / action / line, plus a recent sample. All
   * read-only; the ledger itself is append-only.
   */
  async summarizeActivity(opts: {
    domain?: string;
    line?: string;
    program?: string;
    sinceHours?: number;
    limit?: number;
  } = {}): Promise<{
    window: { sinceHours: number; since: string };
    totalEvents: number;
    byDomain: Record<string, number>;
    byAction: Record<string, number>;
    byLine: Record<string, number>;
    recent: Array<Record<string, unknown>>;
  }> {
    const sinceHours = Math.min(Math.max(opts.sinceHours ?? 24, 1), 24 * 30);
    const since = new Date(Date.now() - sinceHours * 3_600_000);
    const take = Math.min(Math.max(opts.limit ?? 500, 1), 2000);

    const qb = this.ledgerRepository
      .createQueryBuilder('event')
      .where('event.timestamp >= :since', { since })
      .orderBy('event.timestamp', 'DESC')
      .take(take);
    if (opts.domain) qb.andWhere('event.domain = :domain', { domain: opts.domain });
    if (opts.line) qb.andWhere('event.line = :line', { line: opts.line });
    if (opts.program)
      qb.andWhere('event.program = :program', { program: opts.program });

    const rows = await qb.getMany();
    const tally = (key: keyof LedgerEvent): Record<string, number> => {
      const out: Record<string, number> = {};
      for (const r of rows) {
        const k = (r[key] as string) || `(sin ${String(key)})`;
        out[k] = (out[k] ?? 0) + 1;
      }
      return out;
    };

    return {
      window: { sinceHours, since: since.toISOString() },
      totalEvents: rows.length,
      byDomain: tally('domain'),
      byAction: tally('action'),
      byLine: tally('line'),
      recent: rows.slice(0, 30).map((r) => ({
        timestamp: r.timestamp,
        domain: r.domain,
        action: r.action,
        line: r.line,
        program: r.program,
        model: r.model,
        workOrder: r.workOrder,
        ref:
          r.referenceType && r.referenceId
            ? `${r.referenceType}:${r.referenceId}`
            : null,
        actor: r.actorName || null,
      })),
    };
  }
}
