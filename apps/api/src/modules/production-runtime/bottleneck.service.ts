import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { BayLayout } from '../bay-layout/entities/bay-layout.entity';
import { BomItem } from '../bom/entities/bom-item.entity';
import { ProductionBayEvent } from './entities/production-bay-event.entity';
import { ProductionWip } from './entities/production-wip.entity';
import {
  BottleneckQueryDto,
  BottleneckReportDto,
  BayNodeDto,
  HotspotDto,
} from './dto/bottleneck.dto';

/**
 * BottleneckService
 *
 * Implements graph-based production flow analysis to identify constraints,
 * starvation points, and blocking conditions on the shopfloor.
 *
 * ALGORITHM OVERVIEW
 * ──────────────────
 * 1. Build a directed graph from BayLayout where each bay is a node and
 *    edges represent the sequential physical flow: Bay1 → Bay2 → ... → BayN.
 *
 * 2. For each node compute:
 *      theoreticalCapacity: Derived from BOM usagePerAssembly for parts
 *                           assigned to that bay via BayLayout. Normalised
 *                           to "assemblies per window" using the WIP targetQty.
 *      observedUnits:       Sum of ProductionBayEvent.quantity for that bay
 *                           within the analysis window.
 *      efficiency:          observedUnits / theoreticalCapacity
 *
 * 3. Classify each node using flow-graph rules:
 *      Bottleneck:  efficiency < 0.7  AND  below the mean of all nodes
 *      Starvation:  upstream bay throughput < 80 % of this bay's capacity
 *      Blocking:    downstream bay throughput < 80 % of this bay's throughput
 *
 * 4. Compute SeverityScore (0.0–1.0):
 *      SeverityScore = clamp(1 - efficiency, 0, 1)
 *      For blocking/starvation: incorporate flow imbalance ratio.
 *
 * 5. Return a BottleneckReport with all bay nodes and a sorted hotspot list.
 */
@Injectable()
export class BottleneckService {
  private readonly logger = new Logger(BottleneckService.name);

  constructor(
    @InjectRepository(BayLayout)
    private readonly bayLayoutRepo: Repository<BayLayout>,
    @InjectRepository(BomItem)
    private readonly bomRepo: Repository<BomItem>,
    @InjectRepository(ProductionBayEvent)
    private readonly bayEventRepo: Repository<ProductionBayEvent>,
    @InjectRepository(ProductionWip)
    private readonly wipRepo: Repository<ProductionWip>,
  ) {}

  async analyzeBottlenecks(query: BottleneckQueryDto): Promise<BottleneckReportDto> {
    const { model, kitId } = query;
    const windowMinutes    = Math.min(480, Math.max(10, query.windowMinutes ?? 60));
    const since            = new Date(Date.now() - windowMinutes * 60_000);

    // ── 1. Build theoretical capacity per bay from BayLayout + BOM ──────────

    const layouts = await this.bayLayoutRepo.find({ where: { model } });
    const boms    = await this.bomRepo.find({ where: { model } });

    // Map bayId → BOM items assigned to that bay
    const bayBomMap = new Map<number, BomItem[]>();
    for (const layout of layouts) {
      const bomItem = boms.find((b) => b.partNumber === layout.partNumber);
      if (!bomItem) continue;
      const existing = bayBomMap.get(layout.bahia) ?? [];
      existing.push(bomItem);
      bayBomMap.set(layout.bahia, existing);
    }

    // Distinct bays in ascending order
    const bayIds = [...new Set(layouts.map((l) => l.bahia))].sort((a, b) => a - b);

    if (bayIds.length === 0) {
      return this.emptyReport(model, kitId, windowMinutes);
    }

    // Target assembly rate from WIP (units / window)
    let targetQty = 0;
    if (kitId) {
      const wip = await this.wipRepo.findOne({ where: { kit: { id: kitId } } });
      targetQty  = wip?.targetQty ?? 0;
    }
    if (!targetQty) {
      // Fallback: use average targetQty of recent WIPs for this model
      const recentWips = await this.wipRepo
        .createQueryBuilder('w')
        .where("w.partNumber LIKE :prefix OR w.partNumber = :model", {
          prefix: `${model.split('-')[0]}%`,
          model,
        })
        .limit(10)
        .getMany();
      targetQty = recentWips.length
        ? recentWips.reduce((s, w) => s + w.targetQty, 0) / recentWips.length
        : 50; // sensible default when no WIP exists
    }

    // Theoretical capacity per bay = (sum of usagePerAssembly for bay's BOM items)
    // normalised to units per window using target throughput rate
    const theoreticalByBay = new Map<number, number>();
    for (const bayId of bayIds) {
      const items   = bayBomMap.get(bayId) ?? [];
      const totalBomUsage = items.reduce((s, b) => s + (b.usageFactor ?? 1), 0);
      // Simpler model: each bay should process targetQty assemblies per window
      // weighted by how many distinct components it handles (complexity factor)
      const complexityFactor  = Math.max(1, items.length);
      const theoreticalUnits  = targetQty * (1 / complexityFactor) * (windowMinutes / 60);
      theoreticalByBay.set(bayId, Math.max(1, theoreticalUnits));
    }

    // ── 2. Observed throughput from real bay events ──────────────────────────

    const qb = this.bayEventRepo.createQueryBuilder('ev')
      .select('ev.bayId', 'bayId')
      .addSelect('SUM(ev.quantity)', 'totalUnits')
      .addSelect('COUNT(ev.id)', 'eventCount')
      .where('ev.model = :model', { model })
      .andWhere('ev.timestamp > :since', { since })
      .andWhere('ev.revertedAt IS NULL')
      .groupBy('ev.bayId');

    if (kitId) {
      qb.andWhere('ev.kit.id = :kitId', { kitId });
    }

    const rawAgg = await qb.getRawMany<{ bayId: number; totalUnits: string; eventCount: string }>();

    const observedByBay   = new Map<number, number>();
    const eventCountByBay = new Map<number, number>();
    for (const row of rawAgg) {
      observedByBay.set(Number(row.bayId), parseFloat(row.totalUnits) || 0);
      eventCountByBay.set(Number(row.bayId), parseInt(row.eventCount, 10) || 0);
    }

    // ── 3. Build graph nodes ─────────────────────────────────────────────────

    const nodes: BayNodeDto[] = bayIds.map((bayId) => {
      const observed     = observedByBay.get(bayId)   ?? 0;
      const theoretical  = theoreticalByBay.get(bayId) ?? 1;
      const efficiency   = theoretical > 0 ? observed / theoretical : 0;
      return {
        bayId,
        observedUnits:       observed,
        theoreticalCapacity: Math.round(theoretical * 100) / 100,
        efficiency:          Math.round(efficiency * 1000) / 1000,
        eventCount:          eventCountByBay.get(bayId) ?? 0,
        state:               'normal' as const,
      };
    });

    // ── 4. Classify nodes: bottleneck / starvation / blocking ────────────────

    const meanEfficiency = nodes.reduce((s, n) => s + n.efficiency, 0) / nodes.length;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const prev = i > 0 ? nodes[i - 1] : null;
      const next = i < nodes.length - 1 ? nodes[i + 1] : null;

      // Blocking: this bay is producing significantly more than downstream can absorb
      if (next && node.observedUnits > next.observedUnits * 1.25) {
        node.state = 'blocking';
        continue;
      }

      // Starvation: upstream bay feeds significantly less than this bay can consume
      if (prev && prev.observedUnits < node.theoreticalCapacity * 0.8) {
        node.state = 'starvation';
        continue;
      }

      // Bottleneck: own efficiency well below threshold AND below site mean
      if (node.efficiency < 0.7 && node.efficiency < meanEfficiency * 0.85) {
        node.state = 'bottleneck';
        continue;
      }
    }

    // ── 5. Compute hotspots with severity scores ──────────────────────────────

    const hotspots: HotspotDto[] = nodes
      .filter((n) => n.state !== 'normal')
      .map((n): HotspotDto => {
        let severityScore: number;
        let recommendation: string;

        switch (n.state) {
          case 'bottleneck':
            severityScore  = Math.min(1, Math.max(0, 1 - n.efficiency));
            recommendation = this.bottleneckRec(n);
            break;
          case 'starvation': {
            const upstream = nodes.find((x) => x.bayId === n.bayId - 1);
            const ratio    = upstream
              ? Math.max(0, 1 - upstream.observedUnits / n.theoreticalCapacity)
              : 0.5;
            severityScore  = Math.min(1, ratio);
            recommendation = `Bay ${n.bayId} is starved. Investigate upstream Bay ${n.bayId - 1} for material or labour delays.`;
            break;
          }
          case 'blocking': {
            const downstream = nodes.find((x) => x.bayId === n.bayId + 1);
            const ratio      = downstream
              ? Math.max(0, 1 - downstream.observedUnits / n.observedUnits)
              : 0.5;
            severityScore    = Math.min(1, ratio * 0.8); // blocking is less severe than starvation
            recommendation   = `Bay ${n.bayId} is blocked by downstream Bay ${n.bayId + 1}. Clear downstream backlog.`;
            break;
          }
          default:
            severityScore  = 0;
            recommendation = 'No action required.';
        }

        return {
          bayId:               n.bayId,
          type:                n.state as 'bottleneck' | 'starvation' | 'blocking',
          severityScore:       Math.round(severityScore * 1000) / 1000,
          observedUnits:       n.observedUnits,
          theoreticalCapacity: n.theoreticalCapacity,
          efficiencyGap:       Math.max(0, Math.round((n.theoreticalCapacity - n.observedUnits) * 100) / 100),
          recommendation,
        };
      })
      .sort((a, b) => b.severityScore - a.severityScore);

    const overallFlowEfficiency =
      Math.round((nodes.reduce((s, n) => s + n.efficiency, 0) / Math.max(1, nodes.length)) * 1000) / 1000;

    return {
      model,
      kitId,
      windowMinutes,
      analyzedAt:           new Date(),
      bayCount:             bayIds.length,
      bayNodes:             nodes,
      hotspots,
      overallFlowEfficiency,
      criticalHotspot:      hotspots[0] ?? null,
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private bottleneckRec(node: BayNodeDto): string {
    if (node.efficiency < 0.3) {
      return `Bay ${node.bayId} is critically constrained (${Math.round(node.efficiency * 100)}% efficiency). Immediate investigation required — check tooling, staffing, and material flow.`;
    }
    if (node.efficiency < 0.5) {
      return `Bay ${node.bayId} is significantly underperforming (${Math.round(node.efficiency * 100)}% efficiency). Review cycle time, operator assignments, and component availability.`;
    }
    return `Bay ${node.bayId} is a moderate bottleneck (${Math.round(node.efficiency * 100)}% efficiency). Monitor and consider load balancing.`;
  }

  private emptyReport(model: string, kitId: number | undefined, windowMinutes: number): BottleneckReportDto {
    this.logger.warn(`No BayLayout found for model "${model}" — returning empty bottleneck report`);
    return {
      model,
      kitId,
      windowMinutes,
      analyzedAt:           new Date(),
      bayCount:             0,
      bayNodes:             [],
      hotspots:             [],
      overallFlowEfficiency: 0,
      criticalHotspot:      null,
    };
  }
}
