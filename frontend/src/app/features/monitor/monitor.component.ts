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
      backends: this.api.getProductionBackends(),
    }).pipe(
      switchMap(({ backends }) => {
        const backendList = backends ?? [];
        const detailRequest = backendList.length
          ? forkJoin(backendList.map((backend) =>
              forkJoin({
                materials: this.api.getProductionMaterials(backend.kitId),
                events: this.api.getProductionEvents(backend.kitId),
              }).pipe(map((payload) => ({ kitId: backend.kitId, ...payload }))),
            ))
          : of([]);
        return detailRequest.pipe(map((details) => ({ backends: backendList, details })));
      }),
    ).subscribe({
      next: ({ backends, details }) => {
        this.buildSlots(backends, details as any[]);
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

  private buildSlots(backends: any[], details: any[]): void {
    const backendByBk = new Map<number, any>(backends.map((backend) => [backend.backen, backend]));
    const detailsByKitId = new Map<number, any>(details.map((entry) => [entry.kitId, entry]));

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
