import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-monitor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './monitor.component.html',
  styleUrls: ['./monitor.component.css'],
})
export class MonitorComponent implements OnInit {
  loading = false;
  error: string | null = null;
  backens = [1, 2, 3, 4, 5, 6, 7];
  slots: Record<number, any> = {};
  expandedByBk: Record<number, boolean> = {};
  allExpanded = false;

  private readonly statusPriority: Record<string, number> = {
    requested: 1,
    ready: 2,
    kitted: 3,
    prepared: 3,
    preparing: 4,
    scheduled: 5,
    delivered: 6,
    sent: 6,
    received: 7,
    in_progress: 8,
    completed: 9,
  };

  private labels: Record<string, string> = {
    scheduled: 'Programado',
    preparing: 'Preparando',
    prepared: 'Armado',
    kitted: 'Armado',
    ready: 'Listo',
    requested: 'Solicitado',
    delivered: 'Entregado',
    sent: 'Enviado',
    received: 'Recibido',
    in_progress: 'Activo',
    completed: 'Completado',
    empty: 'Sin operación',
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loading = true;
    forkJoin({
      kits: this.api.getKits(),
      plans: this.api.getPlans(),
      backends: this.api.getProductionBackends(),
    }).pipe(
      switchMap(({ kits, plans, backends }) => {
        const backendList = backends ?? [];
        const detailRequest = backendList.length
          ? forkJoin(backendList.map((backend) =>
              forkJoin({
                materials: this.api.getProductionMaterials(backend.kitId),
                events: this.api.getProductionEvents(backend.kitId),
              }).pipe(map((payload) => ({ kitId: backend.kitId, ...payload }))),
            ))
          : of([]);
        return detailRequest.pipe(map((details) => ({ kits: kits ?? [], plans: plans ?? [], backends: backendList, details })));
      }),
    ).subscribe({
      next: ({ kits, plans, backends, details }) => {
        this.buildSlots(kits, plans, backends, details as any[]);
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudo cargar el monitor';
        this.loading = false;
      },
    });
  }

  labelFor(status: string): string {
    return this.labels[status] ?? status;
  }

  toggleAll(): void {
    this.allExpanded = !this.allExpanded;
    this.backens.forEach((bk) => {
      this.expandedByBk[bk] = this.allExpanded;
    });
  }

  toggleBk(bk: number): void {
    this.expandedByBk[bk] = !this.expandedByBk[bk];
    this.allExpanded = this.backens.every((value) => this.expandedByBk[value]);
  }

  isExpanded(bk: number): boolean {
    return !!this.expandedByBk[bk];
  }

  private compareCandidates(a: any, b: any): number {
    const priorityDiff = this.priorityFor(a.status) - this.priorityFor(b.status);
    if (priorityDiff !== 0) return priorityDiff;

    const scheduledDiff = this.dateSortValue(a.scheduledAt) - this.dateSortValue(b.scheduledAt);
    if (scheduledDiff !== 0) return scheduledDiff;

    const sequenceDiff = this.numberSortValue(a.sequence) - this.numberSortValue(b.sequence);
    if (sequenceDiff !== 0) return sequenceDiff;

    const createdDiff = this.dateSortValue(a.createdAt) - this.dateSortValue(b.createdAt);
    if (createdDiff !== 0) return createdDiff;

    return this.numberSortValue(a.id) - this.numberSortValue(b.id);
  }

  private dateSortValue(value: string | null | undefined): number {
    if (!value) return Number.MAX_SAFE_INTEGER;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
  }

  private numberSortValue(value: number | null | undefined): number {
    return typeof value === 'number' ? value : Number.MAX_SAFE_INTEGER;
  }

  private priorityFor(status: string): number {
    return this.statusPriority[status] ?? Number.MAX_SAFE_INTEGER;
  }

  private buildSlots(kits: any[], plans: any[], backends: any[], details: any[]): void {
    const backendByBk = new Map<number, any>(backends.map((backend) => [backend.backen, backend]));
    const detailsByKitId = new Map<number, any>(details.map((entry) => [entry.kitId, entry]));
    const usedPlanIds = new Set<number>(
      kits.map((kit) => kit.plan?.id).filter((id): id is number => typeof id === 'number'),
    );

    for (const bk of this.backens) {
      const runtimeBackend = backendByBk.get(bk);
      if (runtimeBackend) {
        const runtime = detailsByKitId.get(runtimeBackend.kitId);
        this.slots[bk] = {
          status: runtimeBackend.status,
          model: runtimeBackend.model,
          workOrder: runtimeBackend.workOrder,
          shift: runtimeBackend.shift,
          quantity: runtimeBackend.targetQty ?? 0,
          completed: runtimeBackend.completedQty ?? 0,
          progressPct: runtimeBackend.targetQty > 0 ? Math.round(((runtimeBackend.completedQty ?? 0) / runtimeBackend.targetQty) * 100) : 0,
          hasException: !!runtimeBackend.hasIncident,
          bays: this.buildBayRows(runtime?.materials ?? [], runtime?.events ?? []),
          hasRealOperation: true,
        };
        continue;
      }

      const candidates = [
        ...kits
          .filter((kit) => kit.plan?.backen === bk)
          .map((kit) => ({
            type: 'kit',
            item: kit,
            id: kit.id,
            status: kit.status,
            scheduledAt: kit.plan?.scheduledAt,
            sequence: kit.plan?.sequence,
            createdAt: kit.createdAt,
          })),
        ...plans
          .filter((plan) => plan.backen === bk && (plan.status === 'pending' || plan.status === 'active') && !usedPlanIds.has(plan.id))
          .map((plan) => ({
            type: 'plan',
            item: plan,
            id: plan.id,
            status: 'scheduled',
            scheduledAt: plan.scheduledAt,
            sequence: plan.sequence,
            createdAt: plan.createdAt,
          })),
      ].sort((a, b) => this.compareCandidates(a, b));

      const selected = candidates[0];

      if (selected?.type === 'kit') {
        const kit = selected.item;
        const qty = kit.plan?.quantity ?? 0;
        const completed = kit.totalCompleted ?? 0;
        this.slots[bk] = {
          status: kit.status,
          model: kit.plan?.model,
          workOrder: kit.plan?.workOrder,
          shift: kit.plan?.shift,
          quantity: qty,
          completed,
          progressPct: qty > 0 ? Math.round((completed / qty) * 100) : 0,
          hasException: kit.hasOpenException ?? false,
          bays: [],
          hasRealOperation: false,
        };
      } else if (selected?.type === 'plan') {
        const plan = selected.item;
        this.slots[bk] = {
          status: 'scheduled',
          model: plan.model,
          workOrder: plan.workOrder,
          shift: plan.shift,
          quantity: plan.quantity,
          completed: 0,
          progressPct: 0,
          hasException: false,
          bays: [],
          hasRealOperation: false,
        };
      } else {
        this.slots[bk] = {
          status: 'empty',
          completed: 0,
          progressPct: 0,
          hasException: false,
          bays: [],
          hasRealOperation: false,
        };
      }
    }
  }

  private buildBayRows(materials: any[], events: any[]): Array<{ bayId: number; npCount: number; consumed: number; assembled: number }> {
    const byBay = new Map<number, { npCount: number; consumed: number; assembled: number }>();
    materials.forEach((item) => {
      const current = byBay.get(item.bayId) ?? { npCount: 0, consumed: 0, assembled: 0 };
      current.npCount += 1;
      current.consumed += Number(item.consumedQty ?? 0);
      byBay.set(item.bayId, current);
    });

    events.forEach((event) => {
      const current = byBay.get(event.bayId) ?? { npCount: 0, consumed: 0, assembled: 0 };
      current.assembled += Number(event.quantity ?? 0);
      byBay.set(event.bayId, current);
    });

    return [...byBay.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([bayId, value]) => ({ bayId, ...value }));
  }
}
