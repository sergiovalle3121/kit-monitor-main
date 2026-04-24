import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { EnterpriseContextService } from '../../core/enterprise-context.service';
import { EnterpriseContextBannerComponent } from '../../shared/enterprise-context-banner/enterprise-context-banner.component';

@Component({
  selector: 'app-monitor',
  standalone: true,
  imports: [EnterpriseContextBannerComponent, CommonModule],
  templateUrl: './monitor.component.html',
  styleUrls: ['./monitor.component.css'],
})
export class MonitorComponent implements OnInit {
  private readonly contextService = inject(EnterpriseContextService);
  loading = false;
  error: string | null = null;
  backens: number[] = [];
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
  private bayStatusLabels: Record<string, string> = {
    not_configured: 'No configurada',
    configured_not_mounted: 'Configurada IE, no montada',
    out_of_material: 'Sin material',
    at_risk: 'En riesgo',
    with_incident: 'Con incidencia',
    off_plan: 'Desfasada',
    in_production: 'En producción',
    ready_to_produce: 'Lista',
  };

  constructor(private api: ApiService) {
    // React to context changes
    effect(() => {
      const ctx = this.contextService.context();
      if (ctx.isConfigured) {
        this.refreshTopology();
        this.loadData();
      }
    });
  }

  ngOnInit(): void {
    // Initial load handled by effect
  }

  private refreshTopology(): void {
    const ctx = this.contextService.context();
    const allLines = this.contextService.lines();
    
    // Filter lines by current building
    const buildingLines = allLines.filter(l => l.buildingId === ctx.buildingId || l.building?.id === ctx.buildingId);
    
    // If no building selected, show all (or empty)
    this.backens = buildingLines.length 
      ? buildingLines.map(l => l.legacyLineNumber ?? parseInt(l.code)).filter(n => !isNaN(n))
      : [1, 2, 3, 4, 5, 6, 7]; // Fallback to demo lines if topology not loaded
    
    this.backens.sort((a, b) => a - b);
  }

  private loadData(): void {
    this.loading = true;
    this.api.getProductionBackends()
      .pipe(
        switchMap((backends) => {
          const backendList = backends ?? [];
          const detailRequest = backendList.length
            ? forkJoin(
                backendList.map((backend) =>
                  forkJoin({
                    materials: this.api.getProductionMaterials(backend.kitId),
                    events: this.api.getProductionEvents(backend.kitId),
                    risk: this.api.getProductionShortageRisk(backend.kitId),
                  }).pipe(map((payload) => ({ kitId: backend.kitId, ...payload }))),
                ),
              )
            : of([]);
          return detailRequest.pipe(map((details) => ({ backends: backendList, details })));
        }),
      )
      .subscribe({
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
      this.expandedByBk[bk] = this.allExpanded && this.isExpandable(bk);
    });
  }

  toggleBk(bk: number): void {
    if (!this.isExpandable(bk)) return;
    this.expandedByBk[bk] = !this.expandedByBk[bk];
    this.allExpanded = this.backens.every((value) => !this.isExpandable(value) || this.expandedByBk[value]);
  }

  isExpanded(bk: number): boolean {
    return !!this.expandedByBk[bk];
  }

  isExpandable(bk: number): boolean {
    return !!this.slots[bk]?.model;
  }

  bayStatusLabel(status: string): string {
    return this.bayStatusLabels[status] ?? status;
  }

  private buildSlots(backends: any[], details: any[]): void {
    const backendByBk = new Map<number, any>(backends.map((backend) => [backend.line, backend]));
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
          progressPct:
            runtimeBackend.targetQty > 0
              ? Math.round(((runtimeBackend.completedQty ?? 0) / runtimeBackend.targetQty) * 100)
              : 0,
          hasException: !!runtimeBackend.hasIncident,
          bays: this.buildBayRows(runtime?.materials ?? [], runtime?.events ?? [], runtime?.risk?.bays ?? []),
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

  private buildBayRows(
    materials: any[],
    events: any[],
    bayRisk: any[],
  ): Array<{ bayId: number; npCount: number; consumed: number; assembled: number; pace: number; etaMinutes: number | null; status: string }> {
    const byBay = new Map<number, { npCount: number; consumed: number; assembled: number; pace: number; etaMinutes: number | null; status: string }>();
    materials.forEach((item) => {
      const current = byBay.get(item.bayId) ?? { npCount: 0, consumed: 0, assembled: 0, pace: 0, etaMinutes: null, status: 'ready_to_produce' };
      current.npCount += 1;
      current.consumed += Number(item.consumedQty ?? 0);
      if (item.bayStatus) current.status = String(item.bayStatus);
      byBay.set(item.bayId, current);
    });

    events.forEach((event) => {
      const current = byBay.get(event.bayId) ?? { npCount: 0, consumed: 0, assembled: 0, pace: 0, etaMinutes: null, status: 'ready_to_produce' };
      current.assembled += Number(event.quantity ?? 0);
      byBay.set(event.bayId, current);
    });

    bayRisk.forEach((riskItem) => {
      const current = byBay.get(riskItem.bayId) ?? { npCount: 0, consumed: 0, assembled: 0, pace: 0, etaMinutes: null, status: 'ready_to_produce' };
      current.pace = Number(riskItem.assembliesPerHour ?? 0);
      current.etaMinutes = riskItem.avgMinutesToStockout ?? null;
      current.status = String(riskItem.status ?? current.status);
      byBay.set(riskItem.bayId, current);
    });

    return [...byBay.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([bayId, value]) => ({ bayId, ...value }));
  }
}
