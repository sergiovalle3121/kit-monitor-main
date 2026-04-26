import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { DispositionItem, VisualAid } from './ie-data.models';
import {
  BayMaterialState,
  CompletedKitSummary,
  HourlyProductionPoint,
  ProductionLineRuntime,
  ProductionBayEvent,
  ProductionRuntimeSnapshot,
  ProductionRuntimeStatus,
} from './production-ops.models';

interface EnsureRuntimeInput {
  line: number;
  kitId: number;
  model: string;
  workOrder?: string;
  shift?: string;
  targetQty: number;
  completedQty: number;
  hasIncident: boolean;
  sourceStatus: string;
  visualAid: VisualAid | null;
  disposition: DispositionItem[];
}

@Injectable({ providedIn: 'root' })
export class ProductionOpsService {
  private readonly snapshots = new BehaviorSubject<Map<string, ProductionRuntimeSnapshot>>(new Map());

  readonly snapshots$ = this.snapshots.asObservable();

  ensureRuntime(input: EnsureRuntimeInput): ProductionRuntimeSnapshot {
    const state = new Map(this.snapshots.value);
    const lineKey = `BK${input.line}`;
    const existing = state.get(lineKey);

    const backend: ProductionLineRuntime = existing?.backend
      ? {
          ...existing.backend,
          kitId: input.kitId,
          model: input.model,
          workOrder: input.workOrder,
          shift: input.shift,
          targetQty: input.targetQty,
          hasIncident: input.hasIncident,
          visualAidId: input.visualAid?.id,
          completedQty: Math.max(existing.backend.completedQty, input.completedQty),
        }
      : {
          lineKey,
          line: input.line,
          kitId: input.kitId,
          model: input.model,
          workOrder: input.workOrder,
          shift: input.shift,
          targetQty: input.targetQty,
          completedQty: input.completedQty,
          hasIncident: input.hasIncident,
          visualAidId: input.visualAid?.id,
          status: this.mapSourceStatus(input.sourceStatus),
        };

    if (!backend.startedAt && backend.status === 'assembling') {
      backend.startedAt = new Date().toISOString();
    }

    if (backend.completedQty >= backend.targetQty && backend.targetQty > 0) {
      backend.status = 'completed';
      backend.completedAt = backend.completedAt ?? new Date().toISOString();
    }

    const bayMaterials = this.buildOrReuseBayMaterials(
      existing?.bayMaterials ?? [],
      lineKey,
      input.model,
      input.disposition,
    );

    const snapshot: ProductionRuntimeSnapshot = {
      backend,
      bayMaterials,
      events: existing?.events ?? [],
    };

    state.set(lineKey, snapshot);
    this.snapshots.next(state);
    return snapshot;
  }

  markReceivedLine(lineKey: string): void {
    this.patchLine(lineKey, (backend) => ({
      ...backend,
      status: backend.status === 'completed' ? 'completed' : 'received_line',
      receivedAt: backend.receivedAt ?? new Date().toISOString(),
    }));
  }

  startAssembly(lineKey: string): void {
    this.patchLine(lineKey, (backend) => ({
      ...backend,
      status: backend.status === 'completed' ? 'completed' : 'assembling',
      startedAt: backend.startedAt ?? new Date().toISOString(),
      receivedAt: backend.receivedAt ?? new Date().toISOString(),
    }));
  }

  registerBayAssembly(
    lineKey: string,
    bayId: number,
    quantity: number,
    operator?: string,
    notes?: string,
  ): ProductionRuntimeSnapshot | null {
    if (!Number.isFinite(quantity) || quantity <= 0) return null;

    const state = new Map(this.snapshots.value);
    const snapshot = state.get(lineKey);
    if (!snapshot) return null;

    const timestamp = new Date().toISOString();
    const event: ProductionBayEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      lineKey,
      kitId: snapshot.backend.kitId,
      model: snapshot.backend.model,
      bayId,
      quantity,
      timestamp,
      operator,
      notes,
    };

    const bayMaterials = snapshot.bayMaterials.map((item) => {
      if (item.bayId !== bayId) return item;
      const consume = quantity * item.usagePerAssembly;
      const nextAvailable = Math.max(0, item.availableQty - consume);
      return {
        ...item,
        consumedQty: item.consumedQty + consume,
        availableQty: nextAvailable,
      };
    });

    const backend = {
      ...snapshot.backend,
      status: (snapshot.backend.status === 'completed' ? 'completed' : 'assembling') as ProductionRuntimeStatus,
      receivedAt: snapshot.backend.receivedAt ?? timestamp,
      startedAt: snapshot.backend.startedAt ?? timestamp,
      completedQty: snapshot.backend.completedQty + quantity,
    };

    if (backend.targetQty > 0 && backend.completedQty >= backend.targetQty) {
      backend.status = 'completed';
      backend.completedAt = timestamp;
    }

    const nextSnapshot: ProductionRuntimeSnapshot = {
      backend,
      bayMaterials,
      events: [event, ...snapshot.events].slice(0, 600),
    };

    state.set(lineKey, nextSnapshot);
    this.snapshots.next(state);
    return nextSnapshot;
  }

  getSnapshot(lineKey: string): ProductionRuntimeSnapshot | null {
    return this.snapshots.value.get(lineKey) ?? null;
  }

  getHourlySeries(): HourlyProductionPoint[] {
    const rows: HourlyProductionPoint[] = [];

    this.snapshots.value.forEach((snapshot) => {
      const buckets = new Map<string, { units: number; events: number }>();
      snapshot.events.forEach((event) => {
        const hourBucket = event.timestamp.slice(0, 13) + ':00';
        const agg = buckets.get(hourBucket) ?? { units: 0, events: 0 };
        agg.units += event.quantity;
        agg.events += 1;
        buckets.set(hourBucket, agg);
      });

      [...buckets.entries()]
        .sort(([left], [right]) => right.localeCompare(left))
        .forEach(([hourBucket, agg]) => {
          rows.push({
            lineKey: snapshot.backend.lineKey,
            model: snapshot.backend.model,
            hourBucket,
            units: agg.units,
            events: agg.events,
          });
        });
    });

    return rows;
  }

  getCompletedSummaries(): CompletedKitSummary[] {
    return [...this.snapshots.value.values()]
      .filter((snapshot) => snapshot.backend.status === 'completed')
      .map((snapshot) => {
        const lowStockHits = snapshot.bayMaterials.filter((item) => item.availableQty <= item.lowStockThreshold).length;
        return {
          lineKey: snapshot.backend.lineKey,
          model: snapshot.backend.model,
          completedQty: snapshot.backend.completedQty,
          targetQty: snapshot.backend.targetQty,
          startedAt: snapshot.backend.startedAt,
          completedAt: snapshot.backend.completedAt,
          totalEvents: snapshot.events.length,
          lowStockHits,
        };
      })
      .sort((left, right) => (right.completedAt ?? '').localeCompare(left.completedAt ?? ''));
  }

  private mapSourceStatus(status: string): ProductionRuntimeStatus {
    if (status === 'preparing') return 'kit_preparing';
    if (['kitted', 'prepared', 'ready'].includes(status)) return 'kit_ready';
    if (['requested', 'sent', 'received', 'delivered'].includes(status)) return 'received_line';
    if (status === 'in_progress') return 'assembling';
    if (status === 'completed') return 'completed';
    return 'programmed';
  }

  private buildOrReuseBayMaterials(
    existing: BayMaterialState[],
    lineKey: string,
    model: string,
    disposition: DispositionItem[],
  ): BayMaterialState[] {
    const existingKey = new Map<string, BayMaterialState>(existing.map((item) => [`${item.bayId}-${item.partNumber}`, item]));

    return disposition.map((item) => {
      const key = `${item.bayId}-${item.partNumber}`;
      const found = existingKey.get(key);
      if (found) {
        return {
          ...found,
          description: item.description || found.description,
        };
      }

      const usagePerAssembly = Math.max(0.1, Math.round((item.picksPerCycle / Math.max(1, item.usageFrequency)) * 100) / 100);
      const assignedQty = Math.max(20, item.usageFrequency * 20);
      const lowStockThreshold = Math.max(5, Math.ceil(assignedQty * 0.2));

      return {
        lineKey,
        model,
        bayId: item.bayId,
        partNumber: item.partNumber,
        description: item.description,
        usagePerAssembly,
        assignedQty,
        availableQty: assignedQty,
        consumedQty: 0,
        lowStockThreshold,
      };
    });
  }

  private patchLine(
    lineKey: string,
    update: (backend: ProductionLineRuntime) => ProductionLineRuntime,
  ): void {
    const state = new Map(this.snapshots.value);
    const snapshot = state.get(lineKey);
    if (!snapshot) return;

    state.set(lineKey, { ...snapshot, backend: update(snapshot.backend) });
    this.snapshots.next(state);
  }
}
