import { Injectable, Logger } from '@nestjs/common';
import { ImprovementService } from '../improvement/improvement.service';
import { EhsService } from '../ehs/ehs.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { TestingService } from '../testing/testing.service';
import { ProcurementService } from '../procurement/procurement.service';
import { FloorQualityService } from '../floor-quality/floor-quality.service';

export type Health = 'green' | 'amber' | 'red';

export interface AreaCard {
  key: string;
  label: string;
  href: string;
  health: Health;
  headline: string;
  metrics: { label: string; value: string | number }[];
}

export interface ControlTowerSummary {
  generatedAt: string;
  overall: Health;
  areas: AreaCard[];
}

/**
 * Control Tower — read-only cross-area aggregator (no own tables). Pulls each
 * area's KPIs in parallel and derives a simple traffic-light health per area for
 * the executive cockpit. Additive: depends only on existing area services.
 */
@Injectable()
export class ControlTowerService {
  private readonly logger = new Logger(ControlTowerService.name);

  constructor(
    private readonly improvement: ImprovementService,
    private readonly ehs: EhsService,
    private readonly maintenance: MaintenanceService,
    private readonly testing: TestingService,
    private readonly procurement: ProcurementService,
    private readonly floorQuality: FloorQualityService,
  ) {}

  private worst(a: Health, b: Health): Health {
    const rank: Record<Health, number> = { green: 0, amber: 1, red: 2 };
    return rank[a] >= rank[b] ? a : b;
  }

  /** Each card is computed defensively so one failing area never breaks the view. */
  async summary(): Promise<ControlTowerSummary> {
    const [improvement, ehs, maintenance, testing, procurement, quality] =
      await Promise.all([
        this.safe(() => this.improvement.kpis()),
        this.safe(() => this.ehs.kpis()),
        this.safe(() => this.maintenance.kpis()),
        this.safe(() => this.testing.kpis()),
        this.safe(() => this.procurement.kpis()),
        this.safe(() => this.floorQuality.kpis()),
      ]);

    const areas: AreaCard[] = [];

    if (ehs) {
      const health: Health =
        ehs.open > 0 && ehs.recordableCount > 0
          ? 'red'
          : ehs.open > 0
            ? 'amber'
            : 'green';
      areas.push({
        key: 'ehs',
        label: 'EHS · Seguridad',
        href: '/dashboard/ehs',
        health,
        headline:
          ehs.daysSinceLastRecordable === null
            ? 'Sin registrables'
            : `${ehs.daysSinceLastRecordable} días sin registrable`,
        metrics: [
          { label: 'Abiertos', value: ehs.open },
          { label: 'Registrables', value: ehs.recordableCount },
          { label: 'Días perdidos', value: ehs.totalLostDays },
        ],
      });
    }

    if (quality) {
      // Floor quality (MRB holds): overdue holds → red, any open hold → amber.
      const health: Health =
        quality.overdue > 0 ? 'red' : quality.openHolds > 0 ? 'amber' : 'green';
      areas.push({
        key: 'quality',
        label: 'Calidad · Piso (MRB)',
        href: '/dashboard/floor-quality',
        health,
        headline:
          quality.openHolds === 0
            ? 'Sin holds abiertos'
            : `${quality.openHolds} holds abiertos`,
        metrics: [
          { label: 'Vencidos', value: quality.overdue },
          { label: 'Scrap (qty)', value: quality.scrapQty },
          { label: 'Retrabajo (h)', value: quality.reworkHours },
        ],
      });
    }

    if (procurement) {
      const health: Health =
        procurement.overdue > 0 ? 'red' : procurement.awaitingReceipt > 0 ? 'amber' : 'green';
      areas.push({
        key: 'procurement',
        label: 'Compras',
        href: '/dashboard/procurement',
        health,
        headline: `${procurement.open} POs abiertas`,
        metrics: [
          { label: 'Por recibir', value: procurement.awaitingReceipt },
          { label: 'Vencidas', value: procurement.overdue },
          { label: 'OTD', value: procurement.otdPct === null ? '—' : `${procurement.otdPct}%` },
        ],
      });
    }

    if (maintenance) {
      const health: Health =
        maintenance.ordersOverdue > 0 ? 'red' : maintenance.ordersOpen > 0 ? 'amber' : 'green';
      areas.push({
        key: 'maintenance',
        label: 'Mantenimiento',
        href: '/dashboard/maintenance',
        health,
        headline: `${maintenance.ordersOpen} órdenes abiertas`,
        metrics: [
          { label: 'Vencidas', value: maintenance.ordersOverdue },
          { label: '%PM', value: maintenance.pmCompliance === null ? '—' : `${maintenance.pmCompliance}%` },
          { label: 'Activos parados', value: maintenance.assetsDown },
        ],
      });
    }

    if (testing) {
      const fpy = testing.firstPassYieldPct;
      const health: Health =
        fpy === null ? 'green' : fpy < 90 ? 'red' : fpy < 97 ? 'amber' : 'green';
      areas.push({
        key: 'testing',
        label: 'Test Engineering',
        href: '/dashboard/test-engineering',
        health,
        headline: fpy === null ? 'Sin pruebas' : `FPY ${fpy}%`,
        metrics: [
          { label: 'Pruebas', value: testing.totalTests },
          { label: 'Fallas', value: testing.fail },
          { label: 'Yield', value: testing.yieldPct === null ? '—' : `${testing.yieldPct}%` },
        ],
      });
    }

    if (improvement) {
      areas.push({
        key: 'improvement',
        label: 'Mejora Continua',
        href: '/dashboard/improvement',
        health: 'green',
        headline: `${improvement.implemented} implementadas`,
        metrics: [
          { label: 'En progreso', value: improvement.inProgress },
          { label: 'Ahorro real', value: Math.round(improvement.realizedSavings) },
        ],
      });
    }

    const overall = areas.reduce<Health>((acc, a) => this.worst(acc, a.health), 'green');

    return {
      generatedAt: new Date().toISOString(),
      overall,
      areas,
    };
  }

  private async safe<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (err) {
      this.logger.warn(`Control tower area failed: ${(err as Error)?.message}`);
      return null;
    }
  }
}
