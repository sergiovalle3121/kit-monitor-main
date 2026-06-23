import { Inject, Injectable } from '@nestjs/common';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { LineEngineeringService } from './line-engineering.service';
import { SfFloorEvent } from '../operator-terminal/entities/sf-floor-event.entity';
import { SfQualityHold } from '../floor-quality/entities/sf-quality-hold.entity';
import { SfReplenishCall } from '../material-staging/entities/sf-replenish-call.entity';
import { SfWorkOrder } from '../production-plan/entities/sf-work-order.entity';

/**
 * Live per-station status for the 2D layout overlay (Fase 3) — the EMS
 * differentiator. Read-only: it DERIVES a station's light from the freshest
 * shop-floor signals that already exist (andon/defect/downtime, quality holds,
 * material calls) plus whether the model is in production on the line. It does
 * not write or change any of those sources.
 *
 *   down  — andon máquina/seguridad, paro, o señal CRÍTICA/ALTA
 *   warn  — andon material/calidad/ayuda, defecto, retención de calidad, faltante
 *   ok    — el modelo está corriendo en esa línea, sin señales abiertas
 *   idle  — sin producción del modelo en la línea y sin señales
 *   unknown — sin datos
 */
export type StationStatusLevel = 'down' | 'warn' | 'ok' | 'idle' | 'unknown';

export interface StationLiveStatus {
  station: string;
  line: string;
  status: StationStatusLevel;
  label: string;
  severity: string | null;
  since: string | null;
}

export interface StationStatusSummary {
  model: string;
  revision: string;
  running: boolean;
  updatedAt: string;
  counts: Record<StationStatusLevel, number>;
  stations: StationLiveStatus[];
}

const OPEN_FLOOR: string[] = ['OPEN', 'ACK'];
const ACTIVE_HOLD: string[] = ['HELD', 'MRB_REVIEW', 'REWORK', 'REINSPECT'];
const ACTIVE_REPLENISH: string[] = ['OPEN', 'IN_TRANSIT'];
const RANK: Record<StationStatusLevel, number> = {
  down: 4,
  warn: 3,
  ok: 2,
  idle: 1,
  unknown: 0,
};

const ANDON_LABEL: Record<string, string> = {
  ANDON_MATERIAL: 'Andon material',
  ANDON_QUALITY: 'Andon calidad',
  ANDON_MACHINE: 'Andon máquina',
  ANDON_HELP: 'Andon ayuda',
  ANDON_SAFETY: 'Andon seguridad',
  DEFECT: 'Defecto',
  DOWNTIME: 'Paro',
};

@Injectable()
export class StationStatusService {
  constructor(
    private readonly lineEng: LineEngineeringService,
    @Inject(getTenantRepositoryToken(SfFloorEvent))
    private readonly floor: TenantScopedRepository<SfFloorEvent>,
    @Inject(getTenantRepositoryToken(SfQualityHold))
    private readonly holds: TenantScopedRepository<SfQualityHold>,
    @Inject(getTenantRepositoryToken(SfReplenishCall))
    private readonly replenish: TenantScopedRepository<SfReplenishCall>,
    @Inject(getTenantRepositoryToken(SfWorkOrder))
    private readonly workOrders: TenantScopedRepository<SfWorkOrder>,
    private readonly tenantCtx: TenantContextService,
  ) {}

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

  private iso(d: Date | null | undefined): string | null {
    return d ? new Date(d).toISOString() : null;
  }

  async getStatus(
    model: string,
    revision = 'A',
  ): Promise<StationStatusSummary> {
    const m = (model ?? '').trim();
    const r = (revision ?? 'A').trim() || 'A';
    const stations = await this.lineEng.routing(m, r);

    // Freshest open floor event per station (worst severity, then most recent).
    const fQb = this.floor.createQueryBuilder('f');
    this.applyScope(fQb, 'f');
    fQb
      .andWhere('f.status IN (:...st)', { st: OPEN_FLOOR })
      .andWhere('f.station IS NOT NULL');
    const events = await fQb.orderBy('f.raised_at', 'DESC').getMany();

    const hQb = this.holds.createQueryBuilder('h');
    this.applyScope(hQb, 'h');
    hQb
      .andWhere('h.status IN (:...st)', { st: ACTIVE_HOLD })
      .andWhere('h.station IS NOT NULL');
    const heldList = await hQb.orderBy('h.raised_at', 'DESC').getMany();

    const rQb = this.replenish.createQueryBuilder('rp');
    this.applyScope(rQb, 'rp');
    rQb.andWhere('rp.status IN (:...st)', { st: ACTIVE_REPLENISH });
    const replenishList = await rQb.orderBy('rp.raised_at', 'DESC').getMany();

    // Lines where THIS model+revision is currently in production.
    const wQb = this.workOrders.createQueryBuilder('w');
    this.applyScope(wQb, 'w');
    wQb
      .andWhere('w.model = :m', { m })
      .andWhere('w.revision = :r', { r })
      .andWhere('w.status = :s', { s: 'IN_PRODUCTION' });
    const runningWos = await wQb.getMany();
    const runningLines = new Set(runningWos.map((w) => w.line));

    const sevRank = (s: string | null | undefined) =>
      s === 'CRITICAL' ? 3 : s === 'HIGH' ? 2 : s === 'MEDIUM' ? 1 : 0;
    const floorByStation = new Map<string, SfFloorEvent>();
    for (const e of events) {
      const key = e.station as string;
      const cur = floorByStation.get(key);
      if (!cur || sevRank(e.severity) > sevRank(cur.severity))
        floorByStation.set(key, e);
    }
    const holdByStation = new Map<string, SfQualityHold>();
    for (const h of heldList)
      if (!holdByStation.has(h.station as string))
        holdByStation.set(h.station as string, h);
    const repByStation = new Map<string, SfReplenishCall>();
    for (const rp of replenishList)
      if (!repByStation.has(rp.station)) repByStation.set(rp.station, rp);

    const counts: Record<StationStatusLevel, number> = {
      down: 0,
      warn: 0,
      ok: 0,
      idle: 0,
      unknown: 0,
    };
    const out: StationLiveStatus[] = stations.map((s) => {
      const candidates: StationLiveStatus[] = [];
      const running = runningLines.has(s.line);
      candidates.push({
        station: s.station,
        line: s.line,
        status: running ? 'ok' : 'idle',
        label: running ? 'En producción' : 'Sin producción',
        severity: null,
        since: null,
      });

      const rp = repByStation.get(s.station);
      if (rp)
        candidates.push({
          station: s.station,
          line: s.line,
          status: 'warn',
          label: `Falta material: ${rp.part}`,
          severity: rp.priority,
          since: this.iso(rp.raisedAt),
        });

      const hold = holdByStation.get(s.station);
      if (hold)
        candidates.push({
          station: s.station,
          line: s.line,
          status: hold.severity === 'CRITICAL' ? 'down' : 'warn',
          label: `Retención de calidad${hold.folio ? ` ${hold.folio}` : ''}`,
          severity: hold.severity,
          since: this.iso(hold.raisedAt),
        });

      const ev = floorByStation.get(s.station);
      if (ev) {
        const isDown =
          ev.type === 'DOWNTIME' ||
          ev.type === 'ANDON_MACHINE' ||
          ev.type === 'ANDON_SAFETY' ||
          ev.severity === 'CRITICAL' ||
          ev.severity === 'HIGH';
        candidates.push({
          station: s.station,
          line: s.line,
          status: isDown ? 'down' : 'warn',
          label: ANDON_LABEL[ev.type] ?? ev.type,
          severity: ev.severity,
          since: this.iso(ev.raisedAt),
        });
      }

      const best = candidates.reduce((a, b) =>
        RANK[b.status] >= RANK[a.status] ? b : a,
      );
      counts[best.status] += 1;
      return best;
    });

    return {
      model: m,
      revision: r,
      running: runningLines.size > 0,
      updatedAt: new Date().toISOString(),
      counts,
      stations: out,
    };
  }
}
