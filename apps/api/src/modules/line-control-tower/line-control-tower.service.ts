import { Injectable, Logger } from '@nestjs/common';
import { ProductionPlanService } from '../production-plan/production-plan.service';
import { SfWorkOrder } from '../production-plan/entities/sf-work-order.entity';
import { MaterialStagingService } from '../material-staging/material-staging.service';
import { SfReplenishCall } from '../material-staging/entities/sf-replenish-call.entity';
import { OperatorTerminalService } from '../operator-terminal/operator-terminal.service';
import { SfFloorEvent } from '../operator-terminal/entities/sf-floor-event.entity';
import { FloorQualityService } from '../floor-quality/floor-quality.service';
import { SfQualityHold } from '../floor-quality/entities/sf-quality-hold.entity';

export type Light = 'green' | 'amber' | 'red';

export interface LineStatus {
  line: string;
  light: Light;
  woOpen: number;
  woReady: number;
  unitsPlanned: number;
  unitsCompleted: number;
  adherencePct: number;
  behind: number;
  openAndons: number;
  openHolds: number;
  openReplenish: number;
  models: string[];
  reasons: string[];
}

export interface LineControlTowerSummary {
  global: Light;
  lines: LineStatus[];
  totals: {
    lines: number;
    woOpen: number;
    openAndons: number;
    openHolds: number;
    openReplenish: number;
    adherencePct: number;
  };
  generatedAt: string;
}

const worst = (a: Light, b: Light): Light => {
  const rank: Record<Light, number> = { green: 0, amber: 1, red: 2 };
  return rank[a] >= rank[b] ? a : b;
};

/**
 * Line Control Tower (Block L) — the manager's morning view. Read-only; owns no
 * tables. Aggregates the same plan/WO/material/quality objects the floor runs on
 * (Block M unification): readiness, plan vs real, open andons, holds and
 * replenishment per line, with a worst-of traffic light.
 */
@Injectable()
export class LineControlTowerService {
  private readonly logger = new Logger(LineControlTowerService.name);

  constructor(
    private readonly plan: ProductionPlanService,
    private readonly staging: MaterialStagingService,
    private readonly operator: OperatorTerminalService,
    private readonly quality: FloorQualityService,
  ) {}

  async summary(): Promise<LineControlTowerSummary> {
    const wos = await this.plan.list().catch(() => [] as SfWorkOrder[]);
    const lineOf = new Map<string, string>(wos.map((w) => [w.id, w.line] as [string, string]));

    const [calls, holds, andons] = await Promise.all([
      this.staging.listReplenishCalls({}).catch((e) => {
        this.logger.warn(`staging unavailable: ${(e as Error)?.message}`);
        return [] as SfReplenishCall[];
      }),
      this.quality.listHolds({}).catch((e) => {
        this.logger.warn(`quality unavailable: ${(e as Error)?.message}`);
        return [] as SfQualityHold[];
      }),
      this.operator.listFloorEvents({}).catch((e) => {
        this.logger.warn(`operator unavailable: ${(e as Error)?.message}`);
        return [] as SfFloorEvent[];
      }),
    ]);

    const openCalls = calls.filter((c) => c.status === 'OPEN' || c.status === 'IN_TRANSIT');
    const openHolds = holds.filter((h) => h.status !== 'CLOSED' && h.status !== 'CANCELLED');
    const openAndons = andons.filter((a) => (a.status === 'OPEN' || a.status === 'ACK') && a.type.startsWith('ANDON'));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lines = new Set<string>(wos.map((w) => w.line));
    const lineStatuses: LineStatus[] = [];

    for (const line of lines) {
      const lineWos = wos.filter((w) => w.line === line);
      const open = lineWos.filter((w) => w.status !== 'COMPLETED' && w.status !== 'CANCELLED');
      const unitsPlanned = open.reduce((a, w) => a + Number(w.quantityPlanned ?? 0), 0);
      const unitsCompleted = open.reduce((a, w) => a + Number(w.quantityCompleted ?? 0), 0);
      const ready = open.filter((w) => w.materialReady && w.qualityClear && (!w.faiRequired || w.faiApproved));
      const behind = open.filter((w) => w.scheduledDate && new Date(w.scheduledDate) < today).length;

      const lineAndons = openAndons.filter((a) => a.line === line);
      const lineHolds = openHolds.filter((h) => h.woId && lineOf.get(h.woId) === line);
      const lineCalls = openCalls.filter((c) => lineOf.get(c.woId) === line);
      const stockouts = lineCalls.filter((c) => c.reason === 'STOCKOUT').length;
      const criticalAndon = lineAndons.some((a) => a.severity === 'CRITICAL');
      const models = Array.from(new Set(open.map((w) => w.model)));

      const reasons: string[] = [];
      let light: Light = 'green';
      if (lineHolds.length > 0) { light = 'red'; reasons.push(`${lineHolds.length} hold(s) de calidad`); }
      if (stockouts > 0) { light = 'red'; reasons.push(`${stockouts} faltante(s) crítico(s)`); }
      if (criticalAndon) { light = 'red'; reasons.push('andon crítico abierto'); }
      if (light !== 'red') {
        if (behind > 0) { light = 'amber'; reasons.push(`${behind} WO atrasada(s)`); }
        if (lineCalls.length > 0) { light = 'amber'; reasons.push(`${lineCalls.length} reposición(es) pendiente(s)`); }
        if (lineAndons.length > 0) { light = 'amber'; reasons.push(`${lineAndons.length} andon(s) abierto(s)`); }
      }

      lineStatuses.push({
        line,
        light,
        woOpen: open.length,
        woReady: ready.length,
        unitsPlanned,
        unitsCompleted,
        adherencePct: unitsPlanned > 0 ? round(unitsCompleted / unitsPlanned, 4) : 0,
        behind,
        openAndons: lineAndons.length,
        openHolds: lineHolds.length,
        openReplenish: lineCalls.length,
        models,
        reasons,
      });
    }

    lineStatuses.sort((a, b) => a.line.localeCompare(b.line));
    const global = lineStatuses.reduce<Light>((acc, l) => worst(acc, l.light), 'green');
    const totalPlanned = lineStatuses.reduce((a, l) => a + l.unitsPlanned, 0);
    const totalCompleted = lineStatuses.reduce((a, l) => a + l.unitsCompleted, 0);

    return {
      global,
      lines: lineStatuses,
      totals: {
        lines: lineStatuses.length,
        woOpen: lineStatuses.reduce((a, l) => a + l.woOpen, 0),
        openAndons: lineStatuses.reduce((a, l) => a + l.openAndons, 0),
        openHolds: lineStatuses.reduce((a, l) => a + l.openHolds, 0),
        openReplenish: lineStatuses.reduce((a, l) => a + l.openReplenish, 0),
        adherencePct: totalPlanned > 0 ? round(totalCompleted / totalPlanned, 4) : 0,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}

function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round((Number(n) || 0) * f) / f;
}
