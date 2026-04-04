import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { DispositionItem, VisualAid } from '../../core/ie-data.models';
import { DispositionService } from '../../core/disposition.service';
import { VisualAidsService } from '../../core/visual-aids.service';

interface BayMaterialState {
  bayId: number;
  partNumber: string;
  description?: string;
  usagePerAssembly: number;
  availableQty: number;
  consumedQty: number;
  lowStockThreshold: number;
}

interface ProductionRuntimeSnapshot {
  backend: any;
  bayMaterials: BayMaterialState[];
  events: any[];
  shortageRisk?: any;
}

interface ProductionStationView {
  backen: number;
  backendKey: string;
  kit: any | null;
  status: string;
  model: string | null;
  workOrder: string | null;
  shift: string | null;
  quantity: number;
  completed: number;
  progressPct: number;
  hasOpenException: boolean;
  recentAdvances: any[];
  openResupplies: any[];
  disposition: DispositionItem[];
  visualAid: VisualAid | null;
  snapshot: ProductionRuntimeSnapshot | null;
}

@Component({
  selector: 'app-production',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './production.component.html',
  styleUrls: ['./production.component.css'],
})
export class ProductionComponent implements OnInit {
  loading = false;
  error: string | null = null;

  stations: ProductionStationView[] = [];
  readonly backens = [1, 2, 3, 4, 5, 6, 7];

  updatingStatusKitId: number | null = null;
  requestError: Record<number, string> = {};

  resupplyQty: Record<string, number | null> = {};
  requestingResupplyKey: string | null = null;
  resupplyError: Record<string, string> = {};
  expandedByBacken: Record<number, boolean> = {};

  bayQty: Record<string, number> = {};
  bayNotes: Record<string, string> = {};
  bayOperator: Record<string, string> = {};
  baySaving: Record<string, boolean> = {};

  private readonly stationPriority: Record<string, number> = {
    in_progress: 1,
    delivered: 2,
    received: 2,
    sent: 2,
    requested: 3,
    ready: 4,
    kitted: 5,
    prepared: 5,
    preparing: 6,
    completed: 99,
  };

  private readonly statusLabels: Record<string, string> = {
    preparing: 'Kit en preparación',
    prepared: 'Kit listo',
    kitted: 'Kit listo',
    ready: 'Kit listo',
    requested: 'Recibido en línea',
    delivered: 'Recibido en línea',
    sent: 'Recibido en línea',
    received: 'Recibido en línea',
    in_progress: 'En ensamblado',
    completed: 'Completado',
    empty: 'Programado',
  };

  constructor(
    private api: ApiService,
    private readonly visualAids: VisualAidsService,
    private readonly dispositionService: DispositionService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;

    this.api.getKits().pipe(
      switchMap((kits) => {
        const stationKits = this.selectStationKits(kits ?? []);

        const advancesRequest = stationKits.length
          ? forkJoin(stationKits.map((kit) => this.api.getAdvances(kit.id).pipe(map((advances) => ({ kitId: kit.id, advances: advances ?? [] })))))
          : of([]);

        const resuppliesRequest = stationKits.length
          ? forkJoin(stationKits.map((kit) => this.api.getResupplies(kit.id).pipe(map((resupplies) => ({ kitId: kit.id, resupplies: resupplies ?? [] })))))
          : of([]);

        const runtimeRequest = stationKits.length
          ? forkJoin(stationKits.map((kit) => forkJoin({
              backend: this.api.getProductionBackend(kit.id),
              events: this.api.getProductionEvents(kit.id),
              materials: this.api.getProductionMaterials(kit.id),
              risk: this.api.getProductionShortageRisk(kit.id),
            }).pipe(map((payload) => ({ kitId: kit.id, ...payload })))))
          : of([]);

        return forkJoin({
          kits: of(kits ?? []),
          advances: advancesRequest,
          resupplies: resuppliesRequest,
          runtime: runtimeRequest,
        });
      }),
    ).subscribe({
      next: ({ kits, advances, resupplies, runtime }) => {
        this.buildStations(kits, advances, resupplies, runtime as any[]);
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudo cargar Produccion';
        this.loading = false;
      },
    });
  }

  statusLabel(status: string): string {
    return this.statusLabels[status] ?? status;
  }

  canReceiveKit(station: ProductionStationView): boolean {
    return !!station.kit && ['ready', 'requested'].includes(station.status);
  }

  canStartAssembly(station: ProductionStationView): boolean {
    return !!station.kit && ['requested', 'delivered', 'received', 'sent', 'ready'].includes(station.status);
  }

  canCaptureByBay(station: ProductionStationView): boolean {
    return !!station.kit && !!station.snapshot && ['requested', 'delivered', 'received', 'sent', 'in_progress'].includes(station.status);
  }

  requestKit(station: ProductionStationView): void {
    const kitId = station.kit?.id;
    if (!kitId) return;
    this.updatingStatusKitId = kitId;
    this.api.receiveProductionBackend(kitId).subscribe({ next: () => { this.updatingStatusKitId = null; this.load(); }, error: (err) => { this.requestError[kitId] = err?.error?.message ?? 'No se pudo recibir el kit'; this.updatingStatusKitId = null; } });
  }

  startAssembly(station: ProductionStationView): void {
    const kitId = station.kit?.id;
    if (!kitId) return;
    this.updatingStatusKitId = kitId;
    this.api.startProductionBackend(kitId).subscribe({ next: () => { this.updatingStatusKitId = null; this.load(); }, error: (err) => { this.requestError[kitId] = err?.error?.message ?? 'No se pudo iniciar ensamble'; this.updatingStatusKitId = null; } });
  }

  bayInputKey(station: ProductionStationView, bayId: number): string {
    return `${station.backendKey}-B${bayId}`;
  }

  quickBayQty(station: ProductionStationView, bayId: number): number {
    return this.bayQty[this.bayInputKey(station, bayId)] ?? 1;
  }

  updateBayQty(station: ProductionStationView, bayId: number, value: number | string): void {
    const key = this.bayInputKey(station, bayId);
    const parsed = Number(value);
    this.bayQty[key] = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  onBayEnter(station: ProductionStationView, bayId: number, event: Event): void {
    event.preventDefault();
    this.registerBayAssembly(station, bayId);
  }

  registerBayAssembly(station: ProductionStationView, bayId: number): void {
    const kitId = station.kit?.id;
    if (!kitId) return;
    const key = this.bayInputKey(station, bayId);
    const qty = this.quickBayQty(station, bayId);
    this.baySaving[key] = true;

    this.api.createBayEvent(kitId, bayId, {
      quantity: qty,
      notes: this.bayNotes[key]?.trim() || undefined,
      operator: this.bayOperator[key]?.trim() || undefined,
    }).subscribe({
      next: () => {
        this.baySaving[key] = false;
        this.bayQty[key] = 1;
        this.bayNotes[key] = '';
        this.load();
      },
      error: (err) => {
        this.baySaving[key] = false;
        this.requestError[kitId] = err?.error?.message ?? 'No se pudo registrar evento de bahía';
      },
    });
  }

  materialsForBay(station: ProductionStationView, bayId: number): BayMaterialState[] {
    return station.snapshot?.bayMaterials.filter((item) => item.bayId === bayId) ?? [];
  }

  bayAssembled(station: ProductionStationView, bayId: number): number {
    return station.snapshot?.events.filter((event) => event.bayId === bayId).reduce((sum, event) => sum + event.quantity, 0) ?? 0;
  }

  bayLastEvent(station: ProductionStationView, bayId: number): string {
    const found = station.snapshot?.events.find((event) => event.bayId === bayId);
    return found?.timestamp ?? '';
  }

  bayLowStockCount(station: ProductionStationView, bayId: number): number {
    return this.materialsForBay(station, bayId).filter((item) => item.availableQty <= item.lowStockThreshold).length;
  }

  liveConsumptionTotals(station: ProductionStationView): { consumed: number; lowStock: number; topParts: BayMaterialState[] } {
    const materials = station.snapshot?.bayMaterials ?? [];
    const consumed = materials.reduce((sum, item) => sum + item.consumedQty, 0);
    const lowStock = materials.filter((item) => item.availableQty <= item.lowStockThreshold).length;
    const topParts = [...materials].sort((left, right) => right.consumedQty - left.consumedQty).slice(0, 3);
    return { consumed, lowStock, topParts };
  }

  resupplyKey(station: ProductionStationView, partNumber: string): string {
    return `${station.kit?.id ?? 'x'}-${partNumber}`;
  }

  requestResupply(station: ProductionStationView, partNumber: string, description?: string): void {
    const kitId = station.kit?.id;
    if (!kitId) return;
    const key = this.resupplyKey(station, partNumber);
    const qty = this.resupplyQty[key];
    if (!qty || qty <= 0) return;

    this.requestingResupplyKey = key;
    this.api.createResupply(kitId, partNumber, qty, description, 'production_low_stock').subscribe({
      next: () => {
        this.requestingResupplyKey = null;
        this.resupplyQty[key] = null;
        this.load();
      },
      error: (err) => {
        this.requestingResupplyKey = null;
        this.resupplyError[key] = err?.error?.message ?? 'No se pudo pedir el material';
      },
    });
  }

  onResupplyEnter(station: ProductionStationView, partNumber: string, event: Event, description?: string): void {
    event.preventDefault();
    this.requestResupply(station, partNumber, description);
  }

  toggleStationPanel(backen: number): void {
    this.expandedByBacken[backen] = !this.expandedByBacken[backen];
  }

  isStationExpanded(backen: number): boolean {
    return this.expandedByBacken[backen] ?? true;
  }

  openStationVisualAid(station: ProductionStationView): void {
    if (!station.visualAid) return;
    window.open(station.visualAid.pdfUrl, '_blank', 'noopener');
  }

  private buildStations(
    kits: any[],
    advances: Array<{ kitId: number; advances: any[] }>,
    resupplies: Array<{ kitId: number; resupplies: any[] }>,
    runtime: any[],
  ): void {
    const selectedByBacken = new Map<number, any>(this.selectStationKits(kits).map((kit) => [kit.plan.backen, kit] as const));
    const advancesByKitId = new Map(advances.map((entry) => [entry.kitId, entry.advances]));
    const resuppliesByKitId = new Map(resupplies.map((entry) => [entry.kitId, entry.resupplies]));
    const runtimeByKitId = new Map(runtime.map((entry) => [entry.kitId, entry]));

    this.stations = this.backens.map((backen) => {
      const kit = selectedByBacken.get(backen);
      const backendKey = `BK${backen}`;
      if (!kit?.plan) {
        return { backen, backendKey, kit: null, status: 'empty', model: null, workOrder: null, shift: null, quantity: 0, completed: 0, progressPct: 0, hasOpenException: false, recentAdvances: [], openResupplies: [], disposition: [], visualAid: null, snapshot: null };
      }

      const disposition = this.dispositionService.getDispositionByModel(kit.plan.model);
      const visualAid = this.visualAids.getActiveVisualAidByModel(kit.plan.model);
      const rt = runtimeByKitId.get(kit.id);
      const snapshot: ProductionRuntimeSnapshot = {
        backend: rt?.backend ?? null,
        events: rt?.events ?? [],
        bayMaterials: rt?.materials ?? [],
        shortageRisk: rt?.risk,
      };

      const completed = Number(rt?.backend?.completedQty ?? kit.totalCompleted ?? 0);
      return {
        backen,
        backendKey,
        kit,
        status: kit.status,
        model: kit.plan.model,
        workOrder: kit.plan.workOrder,
        shift: kit.plan.shift,
        quantity: kit.plan.quantity,
        completed,
        progressPct: kit.plan.quantity > 0 ? Math.min(100, Math.round((completed / kit.plan.quantity) * 100)) : 0,
        hasOpenException: kit.hasOpenException ?? false,
        recentAdvances: (advancesByKitId.get(kit.id) ?? []).slice(0, 6),
        openResupplies: (resuppliesByKitId.get(kit.id) ?? []).filter((item: any) => item.status !== 'delivered'),
        disposition,
        visualAid,
        snapshot,
      };
    });
  }

  private selectStationKits(kits: any[]): any[] {
    return this.backens
      .map((backen) => kits.filter((kit) => kit.plan?.backen === backen && kit.status !== 'completed').sort((left, right) => this.compareKits(left, right))[0])
      .filter((kit): kit is any => !!kit);
  }

  private compareKits(left: any, right: any): number {
    const statusDiff = this.priorityFor(left.status) - this.priorityFor(right.status);
    if (statusDiff !== 0) return statusDiff;
    return (left.id ?? 0) - (right.id ?? 0);
  }

  private priorityFor(status: string): number {
    return this.stationPriority[status] ?? Number.MAX_SAFE_INTEGER;
  }
}
