import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { SfDowntimeEvent } from './entities/sf-downtime-event.entity';
import { SfHxhTarget } from './entities/sf-hxh-target.entity';
import { SfConsumptionEvent } from '../operator-terminal/entities/sf-consumption-event.entity';
import { SfQualityHold } from '../floor-quality/entities/sf-quality-hold.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { ProductionPlanService } from '../production-plan/production-plan.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import {
  CloseDowntimeDto,
  OpenDowntimeDto,
  SetHxhTargetDto,
} from './dto/oee.dto';
import {
  computeOee,
  weightedIdealCycleSec,
  DowntimeReason,
  OeeBreakdown,
} from './oee';
import { lossBreakdown, LossBreakdownResult } from './oee-losses';

interface Window {
  start: Date;
  end: Date;
  minutes: number;
}

export interface DowntimeRollup {
  totalMinutes: number;
  openCount: number;
  byReason: Record<DowntimeReason, number>;
}

export interface OeeReport extends OeeBreakdown {
  scope: 'WORK_ORDER' | 'LINE';
  line: string | null;
  woId?: string | null;
  woFolio?: string | null;
  model?: string | null;
  shift?: string | null;
  from: string;
  to: string;
  downtimeByReason: Record<DowntimeReason, number>;
  openDowntime: number;
}

export interface HxhRow {
  hour: number;
  target: number;
  real: number;
  delta: number;
  hit: boolean;
  missReason: DowntimeReason | 'PACE_OR_QUALITY' | null;
  missMinutes: number;
}

export interface HxhReport {
  line: string;
  shift: string | null;
  date: string;
  rows: HxhRow[];
  totals: {
    target: number;
    real: number;
    delta: number;
    attainmentPct: number;
  };
}

export interface LineOeeCard {
  line: string;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  output: number;
  goodPieces: number;
  downtimeMinutes: number;
  openDowntime: number;
}

export interface ControlTowerOee {
  generatedAt: string;
  from: string;
  to: string;
  lines: LineOeeCard[];
  rollup: {
    avgOee: number;
    totalOutput: number;
    totalDowntimeMinutes: number;
    openDowntime: number;
  };
}

const ZERO_BY_REASON = (): Record<DowntimeReason, number> => ({
  EQUIPMENT: 0,
  MATERIAL: 0,
  QUALITY: 0,
  CHANGEOVER: 0,
  NO_OPERATOR: 0,
  OTHER: 0,
});

@Injectable()
export class OeeService {
  private readonly logger = new Logger(OeeService.name);

  constructor(
    @Inject(getTenantRepositoryToken(SfDowntimeEvent))
    private readonly downtimes: TenantScopedRepository<SfDowntimeEvent>,
    @Inject(getTenantRepositoryToken(SfHxhTarget))
    private readonly targets: TenantScopedRepository<SfHxhTarget>,
    @InjectRepository(SfConsumptionEvent)
    private readonly consumption: Repository<SfConsumptionEvent>,
    @InjectRepository(SfQualityHold)
    private readonly holds: Repository<SfQualityHold>,
    private readonly tenantCtx: TenantContextService,
    private readonly plan: ProductionPlanService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  // ── scope helpers (QueryBuilder reads bypass the tenant-scoped repo) ─────────
  private applyScope<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
  ): SelectQueryBuilder<T> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  private scopeFields() {
    return {
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Downtime — open / close / list (the Availability source)
  // ════════════════════════════════════════════════════════════════════════════
  async openDowntime(dto: OpenDowntimeDto): Promise<SfDowntimeEvent> {
    let woFolio: string | null = null;
    let model: string | null = null;
    if (dto.woId) {
      try {
        const wo = await this.plan.getOne(dto.woId);
        woFolio = wo.folio;
        model = wo.model;
      } catch {
        /* WO is optional context */
      }
    }
    const ev = this.downtimes.create({
      line: dto.line.trim(),
      station: dto.station?.trim() || null,
      woId: dto.woId ?? null,
      woFolio,
      model,
      reasonCode: dto.reasonCode,
      reasonNote: dto.reasonNote ?? null,
      status: 'OPEN',
      startAt: dto.startAt ? new Date(dto.startAt) : new Date(),
      endAt: null,
      durationMinutes: 0,
      openedBy: this.tenantCtx.getUserEmail(),
      closedBy: null,
      programId: null,
      ...this.scopeFields(),
    });
    const saved = await this.downtimes.save(ev);
    await this.record('SF_DOWNTIME_OPENED', saved.id, {
      line: saved.line,
      station: saved.station,
      reasonCode: saved.reasonCode,
    });
    return saved;
  }

  async closeDowntime(
    id: string,
    dto: CloseDowntimeDto = {},
  ): Promise<SfDowntimeEvent> {
    const ev = await this.downtimes.findOne({ where: { id } });
    if (!ev) throw new NotFoundException('Evento de paro no encontrado.');
    if (ev.status === 'CLOSED')
      throw new BadRequestException('El paro ya está cerrado.');
    const end = dto.endAt ? new Date(dto.endAt) : new Date();
    if (end.getTime() < new Date(ev.startAt).getTime()) {
      throw new BadRequestException(
        'El fin del paro no puede ser anterior al inicio.',
      );
    }
    ev.endAt = end;
    ev.status = 'CLOSED';
    ev.durationMinutes = round(
      (end.getTime() - new Date(ev.startAt).getTime()) / 60_000,
      2,
    );
    if (dto.reasonCode) ev.reasonCode = dto.reasonCode;
    if (dto.reasonNote !== undefined) ev.reasonNote = dto.reasonNote;
    ev.closedBy = this.tenantCtx.getUserEmail();
    const saved = await this.downtimes.save(ev);
    await this.record('SF_DOWNTIME_CLOSED', saved.id, {
      line: saved.line,
      reasonCode: saved.reasonCode,
      durationMinutes: saved.durationMinutes,
    });
    return saved;
  }

  async listDowntime(
    filters: { line?: string; status?: string; reasonCode?: string } = {},
  ): Promise<SfDowntimeEvent[]> {
    const qb = this.downtimes.createQueryBuilder('d');
    this.applyScope(qb, 'd');
    if (filters.line) qb.andWhere('d.line = :l', { l: filters.line });
    if (filters.status) qb.andWhere('d.status = :s', { s: filters.status });
    if (filters.reasonCode)
      qb.andWhere('d.reason_code = :r', { r: filters.reasonCode });
    return qb.orderBy('d.start_at', 'DESC').getMany();
  }

  /** Downtime minutes overlapping [start, end] for a line, split by reason. */
  private async downtimeRollup(
    line: string,
    w: Window,
  ): Promise<DowntimeRollup> {
    // Fetch by line; compute the [start, end] overlap in JS (portable sqlite/PG,
    // and the overlap math naturally excludes non-overlapping events).
    const evs = await this.downtimeForLine(line);
    const byReason = ZERO_BY_REASON();
    let totalMinutes = 0;
    let openCount = 0;
    for (const e of evs) {
      const s = new Date(e.startAt).getTime();
      const rawEnd = e.endAt ? new Date(e.endAt).getTime() : Date.now();
      if (e.status === 'OPEN') openCount++;
      const overlapStart = Math.max(s, w.start.getTime());
      const overlapEnd = Math.min(rawEnd, w.end.getTime());
      const mins = Math.max(0, (overlapEnd - overlapStart) / 60_000);
      if (mins > 0) {
        byReason[e.reasonCode] = round((byReason[e.reasonCode] ?? 0) + mins, 2);
        totalMinutes += mins;
      }
    }
    return { totalMinutes: round(totalMinutes, 2), openCount, byReason };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Hour-by-hour target vs (derived) real + miss reason
  // ════════════════════════════════════════════════════════════════════════════
  async setTarget(dto: SetHxhTargetDto): Promise<SfHxhTarget> {
    const shift = (dto.shift ?? 'A').trim();
    const effectiveDate = dto.effectiveDate ?? null;
    const existing = await this.targets.findOne({
      where: {
        line: dto.line.trim(),
        shift,
        hour: dto.hour,
        effectiveDate: effectiveDate === null ? IsNull() : effectiveDate,
      },
    });
    if (existing) {
      existing.targetQty = dto.targetQty;
      existing.model = dto.model ?? existing.model ?? null;
      existing.notes = dto.notes ?? existing.notes ?? null;
      return this.targets.save(existing);
    }
    const target = this.targets.create({
      line: dto.line.trim(),
      shift,
      hour: dto.hour,
      targetQty: dto.targetQty,
      model: dto.model ?? null,
      effectiveDate,
      notes: dto.notes ?? null,
      ...this.scopeFields(),
    });
    return this.targets.save(target);
  }

  async listTargets(
    filters: { line?: string; shift?: string } = {},
  ): Promise<SfHxhTarget[]> {
    const qb = this.targets.createQueryBuilder('t');
    this.applyScope(qb, 't');
    if (filters.line) qb.andWhere('t.line = :l', { l: filters.line });
    if (filters.shift) qb.andWhere('t.shift = :s', { s: filters.shift });
    return qb.orderBy('t.hour', 'ASC').getMany();
  }

  async hourByHour(
    line: string,
    opts: { date?: string; shift?: string } = {},
  ): Promise<HxhReport> {
    if (!line) throw new BadRequestException('Falta el parámetro line.');
    const day = this.dayBounds(opts.date);
    const w: Window = { start: day.start, end: day.end, minutes: 24 * 60 };

    // Targets for the line (+ optional shift); per hour prefer the day-specific
    // override, else the standing template (null effectiveDate).
    const allTargets = await this.listTargets({ line, shift: opts.shift });
    const targetByHour = new Map<number, number>();
    for (const t of allTargets) {
      if (t.effectiveDate && t.effectiveDate !== day.ymd) continue; // a different day's override
      const prev = targetByHour.get(t.hour);
      // day-specific beats template: overwrite only if none yet or this one is dated
      if (prev === undefined || t.effectiveDate === day.ymd)
        targetByHour.set(t.hour, Number(t.targetQty ?? 0));
    }

    // Real output derived from consumption (advance) events bucketed by clock hour.
    const realByHour = await this.realUnitsByHour(line, w);

    // Downtime split by hour+reason, to attribute the miss reason.
    const downByHourReason = await this.downtimeByHourReason(line, w);

    const hours = new Set<number>([
      ...targetByHour.keys(),
      ...realByHour.keys(),
    ]);
    const rows: HxhRow[] = [];
    let totalTarget = 0;
    let totalReal = 0;
    for (const hour of Array.from(hours).sort((a, b) => a - b)) {
      const target = targetByHour.get(hour) ?? 0;
      const real = realByHour.get(hour) ?? 0;
      const delta = round(real - target, 2);
      totalTarget += target;
      totalReal += real;
      let missReason: HxhRow['missReason'] = null;
      let missMinutes = 0;
      if (real < target) {
        const reasons = downByHourReason.get(hour);
        if (reasons) {
          const top = (Object.entries(reasons) as [DowntimeReason, number][])
            .filter(([, m]) => m > 0)
            .sort((a, b) => b[1] - a[1])[0];
          if (top) {
            missReason = top[0];
            missMinutes = round(top[1], 2);
          }
        }
        if (!missReason) missReason = 'PACE_OR_QUALITY';
      }
      rows.push({
        hour,
        target,
        real: round(real, 2),
        delta,
        hit: real >= target && target > 0,
        missReason,
        missMinutes,
      });
    }

    return {
      line,
      shift: opts.shift ?? null,
      date: day.ymd,
      rows,
      totals: {
        target: round(totalTarget, 2),
        real: round(totalReal, 2),
        delta: round(totalReal - totalTarget, 2),
        attainmentPct: totalTarget > 0 ? round(totalReal / totalTarget, 4) : 0,
      },
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // OEE — by WO and by line
  // ════════════════════════════════════════════════════════════════════════════
  async oeeForWorkOrder(
    woId: string,
    opts: { from?: string; to?: string; plannedMinutes?: number } = {},
  ): Promise<OeeReport> {
    const wo = await this.plan.getOne(woId);
    const w = this.window(
      opts.from,
      opts.to,
      wo.startedAt ?? null,
      wo.completedAt ?? null,
    );

    const pieces = await this.sumUnits([woId], w);
    const scrap = await this.scrapForWoIds([woId], w);
    const down = await this.downtimeRollup(wo.line, w);
    const plannedTimeMin =
      opts.plannedMinutes != null
        ? Math.max(0, opts.plannedMinutes)
        : w.minutes;

    const breakdown = computeOee({
      plannedTimeMin,
      downtimeMin: down.totalMinutes,
      idealCycleSec: Number(wo.taktTargetSec ?? 0),
      totalPieces: pieces,
      goodPieces: pieces - scrap,
    });

    return {
      ...breakdown,
      scope: 'WORK_ORDER',
      line: wo.line,
      woId: wo.id,
      woFolio: wo.folio,
      model: wo.model,
      from: w.start.toISOString(),
      to: w.end.toISOString(),
      downtimeByReason: down.byReason,
      openDowntime: down.openCount,
    };
  }

  async oeeForLine(
    line: string,
    opts: {
      from?: string;
      to?: string;
      shift?: string;
      plannedMinutes?: number;
    } = {},
  ): Promise<OeeReport> {
    if (!line) throw new BadRequestException('Falta el parámetro line.');
    const w = this.window(opts.from, opts.to);
    const wos = await this.plan.list({ line });
    const woIds = wos.map((wo) => wo.id);

    const unitsByWo = await this.unitsByWo(woIds, w);
    const parts = wos.map((wo) => ({
      taktSec: Number(wo.taktTargetSec ?? 0),
      pieces: unitsByWo.get(wo.id) ?? 0,
    }));
    const totalPieces = parts.reduce((a, p) => a + p.pieces, 0);
    const idealCycleSec = weightedIdealCycleSec(parts);
    const scrap = await this.scrapForWoIds(woIds, w);
    const down = await this.downtimeRollup(line, w);
    const plannedTimeMin =
      opts.plannedMinutes != null
        ? Math.max(0, opts.plannedMinutes)
        : w.minutes;

    const breakdown = computeOee({
      plannedTimeMin,
      downtimeMin: down.totalMinutes,
      idealCycleSec,
      totalPieces,
      goodPieces: totalPieces - scrap,
    });

    return {
      ...breakdown,
      scope: 'LINE',
      line,
      shift: opts.shift ?? null,
      from: w.start.toISOString(),
      to: w.end.toISOString(),
      downtimeByReason: down.byReason,
      openDowntime: down.openCount,
    };
  }

  /**
   * OEE loss breakdown (F-Q1): the line's OEE split into a ranked Pareto of the
   * big losses (in OEE points), so OEE + Σ(losses) = 100. Availability loss is
   * split across the actual downtime reasons. Read-only; reuses oeeForLine.
   */
  async getLosses(
    line: string,
    opts: {
      from?: string;
      to?: string;
      shift?: string;
      plannedMinutes?: number;
    } = {},
  ): Promise<LossBreakdownResult & { line: string; from: string; to: string }> {
    const report = await this.oeeForLine(line, opts);
    const result = lossBreakdown({
      availability: report.availability,
      performance: report.performance,
      quality: report.quality,
      downtimeByReason: report.downtimeByReason,
    });
    return { ...result, line, from: report.from, to: report.to };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Control Tower feed — OEE / output by line (read-only aggregator)
  // ════════════════════════════════════════════════════════════════════════════
  async controlTowerFeed(
    opts: { from?: string; to?: string; plannedMinutes?: number } = {},
  ): Promise<ControlTowerOee> {
    const w = this.window(opts.from, opts.to);
    const lines = await this.activeLines();
    const cards: LineOeeCard[] = [];
    for (const line of lines) {
      try {
        const r = await this.oeeForLine(line, {
          from: w.start.toISOString(),
          to: w.end.toISOString(),
          plannedMinutes: opts.plannedMinutes,
        });
        cards.push({
          line,
          oee: r.oee,
          availability: r.availability,
          performance: r.performance,
          quality: r.quality,
          output: r.totalPieces,
          goodPieces: r.goodPieces,
          downtimeMinutes: r.downtimeMin,
          openDowntime: r.openDowntime,
        });
      } catch (err) {
        this.logger.warn(
          `OEE feed skipped line ${line}: ${(err as Error)?.message}`,
        );
      }
    }
    cards.sort((a, b) => a.oee - b.oee); // worst first — the manager looks here
    const totalOutput = cards.reduce((a, c) => a + c.output, 0);
    const totalDowntime = cards.reduce((a, c) => a + c.downtimeMinutes, 0);
    const openDowntime = cards.reduce((a, c) => a + c.openDowntime, 0);
    const avgOee = cards.length
      ? round(cards.reduce((a, c) => a + c.oee, 0) / cards.length, 4)
      : 0;
    return {
      generatedAt: new Date().toISOString(),
      from: w.start.toISOString(),
      to: w.end.toISOString(),
      lines: cards,
      rollup: {
        avgOee,
        totalOutput: round(totalOutput, 2),
        totalDowntimeMinutes: round(totalDowntime, 2),
        openDowntime,
      },
    };
  }

  // ── derivation helpers (REAL is always read, never re-counted) ───────────────
  /** Distinct lines that have a WO, a target, or any downtime — the live floor. */
  private async activeLines(): Promise<string[]> {
    const set = new Set<string>();
    for (const wo of await this.plan.list()) if (wo.line) set.add(wo.line);
    for (const t of await this.listTargets()) if (t.line) set.add(t.line);
    for (const d of await this.listDowntime()) if (d.line) set.add(d.line);
    return Array.from(set).sort();
  }

  /** All downtime rows for a line (tenant-scoped); time math is done in JS. */
  private async downtimeForLine(line: string): Promise<SfDowntimeEvent[]> {
    const qb = this.downtimes.createQueryBuilder('d');
    this.applyScope(qb, 'd');
    qb.andWhere('d.line = :l', { l: line });
    return qb.getMany();
  }

  private async consumptionInWindow(
    woIds: string[],
    w: Window,
  ): Promise<SfConsumptionEvent[]> {
    if (woIds.length === 0) return [];
    const qb = this.consumption.createQueryBuilder('e');
    this.applyScope(qb, 'e');
    qb.andWhere('e.wo_id IN (:...ids)', { ids: woIds });
    const rows = await qb.getMany();
    // Filter the window in JS so the date comparison is portable (sqlite/PG).
    const s = w.start.getTime();
    const e = w.end.getTime();
    return rows.filter((r) => {
      const t = new Date(r.created_at).getTime();
      return t >= s && t <= e;
    });
  }

  private async sumUnits(woIds: string[], w: Window): Promise<number> {
    const evs = await this.consumptionInWindow(woIds, w);
    return round(
      evs.reduce((a, e) => a + Number(e.units ?? 0), 0),
      2,
    );
  }

  private async unitsByWo(
    woIds: string[],
    w: Window,
  ): Promise<Map<string, number>> {
    const evs = await this.consumptionInWindow(woIds, w);
    const m = new Map<string, number>();
    for (const e of evs)
      m.set(e.woId, (m.get(e.woId) ?? 0) + Number(e.units ?? 0));
    return m;
  }

  private async realUnitsByHour(
    line: string,
    w: Window,
  ): Promise<Map<number, number>> {
    const wos = await this.plan.list({ line });
    const evs = await this.consumptionInWindow(
      wos.map((wo) => wo.id),
      w,
    );
    const m = new Map<number, number>();
    for (const e of evs) {
      const hour = new Date(e.created_at).getHours();
      m.set(hour, (m.get(hour) ?? 0) + Number(e.units ?? 0));
    }
    return m;
  }

  private async downtimeByHourReason(
    line: string,
    w: Window,
  ): Promise<Map<number, Record<DowntimeReason, number>>> {
    const evs = await this.downtimeForLine(line);
    const m = new Map<number, Record<DowntimeReason, number>>();
    for (const e of evs) {
      const s = Math.max(new Date(e.startAt).getTime(), w.start.getTime());
      const en = Math.min(
        e.endAt ? new Date(e.endAt).getTime() : Date.now(),
        w.end.getTime(),
      );
      if (en <= s) continue;
      // walk each clock hour the stop touches, crediting the overlap minutes
      let cursor = s;
      while (cursor < en) {
        const d = new Date(cursor);
        const hourEnd = new Date(
          d.getFullYear(),
          d.getMonth(),
          d.getDate(),
          d.getHours() + 1,
          0,
          0,
          0,
        ).getTime();
        const segEnd = Math.min(en, hourEnd);
        const mins = (segEnd - cursor) / 60_000;
        const bucket = m.get(d.getHours()) ?? ZERO_BY_REASON();
        bucket[e.reasonCode] = round((bucket[e.reasonCode] ?? 0) + mins, 2);
        m.set(d.getHours(), bucket);
        cursor = segEnd;
      }
    }
    return m;
  }

  private async scrapForWoIds(woIds: string[], w: Window): Promise<number> {
    if (woIds.length === 0) return 0;
    const qb = this.holds.createQueryBuilder('h');
    this.applyScope(qb, 'h');
    qb.andWhere('h.wo_id IN (:...ids)', { ids: woIds });
    const rows = await qb.getMany();
    // Filtrar a la MISMA ventana que las piezas (en JS, portable sqlite/PG). Sin
    // esto, el scrap de días previos de una WO multi-día se restaba de las piezas
    // de HOY → quality/OEE subestimados. Se usa raisedAt y, si falta, created_at.
    const s = w.start.getTime();
    const e = w.end.getTime();
    return round(
      rows
        .filter((h) => {
          const t = new Date(h.raisedAt ?? h.created_at).getTime();
          return Number.isFinite(t) && t >= s && t <= e;
        })
        .reduce((a, h) => a + Number(h.scrapQty ?? 0), 0),
      2,
    );
  }

  // ── time helpers ─────────────────────────────────────────────────────────────
  /** Resolve a window: explicit from/to, else fallbacks, else today→now. */
  private window(
    from?: string,
    to?: string,
    fbStart?: Date | null,
    fbEnd?: Date | null,
  ): Window {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const start = from
      ? new Date(from)
      : fbStart
        ? new Date(fbStart)
        : todayStart;
    const end = to ? new Date(to) : fbEnd ? new Date(fbEnd) : now;
    const minutes = Math.max(0, (end.getTime() - start.getTime()) / 60_000);
    return { start, end, minutes: round(minutes, 2) };
  }

  private dayBounds(date?: string): { start: Date; end: Date; ymd: string } {
    const base = date ? new Date(`${date}T00:00:00`) : new Date();
    const start = new Date(base);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const ymd = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
    return { start, end, ymd };
  }

  private async record(
    action: string,
    referenceId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.PRODUCTION,
        action,
        referenceType: 'SF_OEE',
        referenceId,
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

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round((Number(n) || 0) * f) / f;
}
