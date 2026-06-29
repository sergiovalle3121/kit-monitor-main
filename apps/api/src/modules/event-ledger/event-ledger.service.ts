import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Brackets, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { LedgerEvent, EventDomain } from './entities/ledger-event.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';

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

export interface QueryLedgerEventsDto {
  actor?: string;
  actorId?: string;
  actorName?: string;
  domain?: string;
  action?: string;
  referenceType?: string;
  referenceId?: string;
  workOrder?: string;
  plant?: string;
  warehouse?: string;
  line?: string;
  shift?: string;
  customer?: string;
  program?: string;
  model?: string;
  from?: string;
  to?: string;
  page?: string | number;
  pageSize?: string | number;
  limit?: string | number;
}

export interface LedgerEventQueryResult {
  items: LedgerEvent[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

@Injectable()
export class EventLedgerService {
  private readonly logger = new Logger(EventLedgerService.name);

  constructor(
    @Inject(getTenantRepositoryToken(LedgerEvent))
    private readonly ledgerRepository: TenantScopedRepository<LedgerEvent>,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private applyScope<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
  ): SelectQueryBuilder<T> {
    const tenant = this.tenantCtx.getTenantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    return qb;
  }

  private scalar(value: unknown): string | undefined {
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw === undefined || raw === null) return undefined;
    const text = String(raw).trim();
    return text.length > 0 ? text : undefined;
  }

  private boundedInt(
    value: unknown,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const raw = this.scalar(value);
    if (!raw) return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(Math.max(Math.trunc(n), min), max);
  }

  private parseDate(value: unknown, name: string): Date | undefined {
    const raw = this.scalar(value);
    if (!raw) return undefined;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${name} must be a valid ISO-8601 date`);
    }
    return date;
  }

  private normalizeDomain(value: unknown): EventDomain | undefined {
    const raw = this.scalar(value);
    if (!raw) return undefined;
    const domain = raw.toUpperCase();
    if (!Object.values(EventDomain).includes(domain as EventDomain)) {
      throw new BadRequestException(`Unsupported ledger domain: ${raw}`);
    }
    return domain as EventDomain;
  }

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

  async queryEvents(
    query: QueryLedgerEventsDto = {},
  ): Promise<LedgerEventQueryResult> {
    const page = this.boundedInt(query.page, 1, 1, 10_000);
    const pageSize = this.boundedInt(query.pageSize ?? query.limit, 50, 1, 200);
    const domain = this.normalizeDomain(query.domain);
    const actor = this.scalar(query.actor);
    const actorId = this.scalar(query.actorId);
    const actorName = this.scalar(query.actorName);
    const action = this.scalar(query.action);
    const referenceType = this.scalar(query.referenceType)?.toUpperCase();
    const referenceId = this.scalar(query.referenceId);
    const workOrder = this.scalar(query.workOrder);
    const plant = this.scalar(query.plant);
    const warehouse = this.scalar(query.warehouse);
    const line = this.scalar(query.line);
    const shift = this.scalar(query.shift);
    const customer = this.scalar(query.customer);
    const program = this.scalar(query.program);
    const model = this.scalar(query.model);
    const from = this.parseDate(query.from, 'from');
    const to = this.parseDate(query.to, 'to');

    if (from && to && from.getTime() > to.getTime()) {
      throw new BadRequestException('from must be earlier than or equal to to');
    }

    const qb = this.ledgerRepository
      .createQueryBuilder('event')
      .orderBy('event.timestamp', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    this.applyScope(qb, 'event');

    if (domain) qb.andWhere('event.domain = :domain', { domain });
    if (action) qb.andWhere('event.action = :action', { action });
    if (referenceType)
      qb.andWhere('event.referenceType = :referenceType', { referenceType });
    if (referenceId)
      qb.andWhere('event.referenceId = :referenceId', { referenceId });
    if (workOrder) qb.andWhere('event.workOrder = :workOrder', { workOrder });
    if (plant) qb.andWhere('event.plant = :plant', { plant });
    if (warehouse) qb.andWhere('event.warehouse = :warehouse', { warehouse });
    if (line) qb.andWhere('event.line = :line', { line });
    if (shift) qb.andWhere('event.shift = :shift', { shift });
    if (customer) qb.andWhere('event.customer = :customer', { customer });
    if (program) qb.andWhere('event.program = :program', { program });
    if (model) qb.andWhere('event.model = :model', { model });
    if (actorId) qb.andWhere('event.actorId = :actorId', { actorId });
    if (actorName) {
      qb.andWhere('LOWER(event.actorName) LIKE :actorName', {
        actorName: `%${actorName.toLowerCase()}%`,
      });
    }
    if (actor) {
      qb.andWhere(
        new Brackets((scoped) => {
          scoped
            .where('event.actorId = :actor', { actor })
            .orWhere('LOWER(event.actorName) LIKE :actorLike', {
              actorLike: `%${actor.toLowerCase()}%`,
            });
        }),
      );
    }
    if (from) qb.andWhere('event.timestamp >= :from', { from });
    if (to) qb.andWhere('event.timestamp <= :to', { to });

    const [items, total] = await qb.getManyAndCount();
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getEventsByReference(
    referenceType: string,
    referenceId: string,
  ): Promise<LedgerEvent[]> {
    return this.ledgerRepository.find({
      where: { referenceType, referenceId },
      order: { timestamp: 'DESC' },
    });
  }

  async getEventsByWorkOrder(workOrder: string): Promise<LedgerEvent[]> {
    const qb = this.ledgerRepository.createQueryBuilder('event')
      .where('event.workOrder = :workOrder', { workOrder })
      .orderBy('event.timestamp', 'DESC');
    this.applyScope(qb, 'event');
    return qb.getMany();
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
    this.applyScope(qb, 'event');
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

  /**
   * Daily event counts over a window — the time-series primitive behind CIDE's
   * conversational analytics and the Intelligence Center charts. Buckets are
   * pre-filled (zero-padded) so the series is continuous for plotting. Bucketing
   * is done in JS to stay portable across SQLite (dev) and Postgres (prod).
   */
  async dailyActivity(
    opts: { days?: number; domain?: string; line?: string } = {},
  ): Promise<{
    series: { date: string; count: number }[];
    total: number;
    window: { days: number };
  }> {
    const days = Math.min(Math.max(opts.days ?? 14, 1), 90);
    const now = new Date();
    const startDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
        (days - 1) * 86_400_000,
    );

    const qb = this.ledgerRepository
      .createQueryBuilder('event')
      .where('event.timestamp >= :since', { since: startDay })
      .orderBy('event.timestamp', 'ASC')
      .take(20_000);
    this.applyScope(qb, 'event');
    if (opts.domain) qb.andWhere('event.domain = :domain', { domain: opts.domain });
    if (opts.line) qb.andWhere('event.line = :line', { line: opts.line });

    const rows = await qb.getMany();
    const buckets = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(startDay.getTime() + i * 86_400_000);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }
    for (const r of rows) {
      const key = new Date(r.timestamp).toISOString().slice(0, 10);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return {
      series: [...buckets.entries()].map(([date, count]) => ({ date, count })),
      total: rows.length,
      window: { days },
    };
  }
}
