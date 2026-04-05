import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
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
  kitStatus: string | null;
  kitMaterialsCoveragePct: number | null;
  kitActualCaptured: number;
  kitRequiredTotal: number;
}

interface ProductionOverview {
  totalStations: number;
  readyKits: number;
  startedStations: number;
  avgProgress: number;
}

interface ReadyKitRow {
  model: string;
  backendKey: string;
  kitId: number;
  timestamp: string;
  status?: string;
}

interface DayPlanRow {
  model: string;
  qtyPlanned: number;
  status: 'Pendiente' | 'En proceso' | 'Completado';
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
  overview: ProductionOverview = { totalStations: 0, readyKits: 0, startedStations: 0, avgProgress: 0 };
  readyKits: ReadyKitRow[] = [];
  dayPlan: DayPlanRow[] = [];
  currentKitInProcess: ReadyKitRow | null = null;

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

    this.api.getProductionBackends().pipe(
      switchMap((backends) => {
        const realBackends = backends ?? [];

        const advancesRequest = realBackends.length
          ? forkJoin(realBackends.map((backend) => this.api.getAdvances(backend.kitId).pipe(map((advances) => ({ kitId: backend.kitId, advances: advances ?? [] })))))
          : of([]);

        const resuppliesRequest = realBackends.length
          ? forkJoin(realBackends.map((backend) => this.api.getResupplies(backend.kitId).pipe(map((resupplies) => ({ kitId: backend.kitId, resupplies: resupplies ?? [] })))))
          : of([]);

        const runtimeRequest = realBackends.length
          ? forkJoin(realBackends.map((backend) => forkJoin({
              backend: this.api.getProductionBackend(backend.kitId),
              events: this.api.getProductionEvents(backend.kitId),
              materials: this.api.getProductionMaterials(backend.kitId),
              risk: this.api.getProductionShortageRisk(backend.kitId),
            }).pipe(map((payload) => ({ kitId: backend.kitId, ...payload })))))
          : of([]);

        return forkJoin({
          backends: of(realBackends),
          kits: this.api.getKits(),
          advances: advancesRequest,
          resupplies: resuppliesRequest,
          runtime: runtimeRequest,
          publications: this.api.getPlanPublications().pipe(catchError(() => of([]))),
        });
      }),
    ).subscribe({
      next: ({ backends, kits, advances, resupplies, runtime, publications }) => {
        this.buildStations(backends, kits, advances, resupplies, runtime as any[]);
        this.buildOpsSections(publications as any[]);
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

  bayIdsForStation(station: ProductionStationView): number[] {
    const ids = new Set<number>();
    (station.snapshot?.bayMaterials ?? []).forEach((item) => ids.add(item.bayId));
    (station.snapshot?.events ?? []).forEach((event) => ids.add(event.bayId));
    return [...ids].sort((a, b) => a - b);
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

  requestReadyKit(row: ReadyKitRow): void {
    const station = this.stations.find((item) => item.kit?.id === row.kitId);
    if (!station) return;
    this.requestKit(station);
  }

  planStatusClass(status: DayPlanRow['status']): string {
    if (status === 'Completado') return 'status-ok';
    if (status === 'En proceso') return 'status-progress';
    return 'status-pending';
  }

  currentKitStatusLabel(): string {
    if (!this.currentKitInProcess?.status) return 'En tránsito';
    return ['delivered', 'received', 'sent', 'in_progress'].includes(this.currentKitInProcess.status)
      ? 'Entregado a línea'
      : 'En tránsito';
  }

  private buildStations(
    backends: any[],
    kits: any[],
    advances: Array<{ kitId: number; advances: any[] }>,
    resupplies: Array<{ kitId: number; resupplies: any[] }>,
    runtime: any[],
  ): void {
    const advancesByKitId = new Map(advances.map((entry) => [entry.kitId, entry.advances]));
    const resuppliesByKitId = new Map(resupplies.map((entry) => [entry.kitId, entry.resupplies]));
    const runtimeByKitId = new Map(runtime.map((entry) => [entry.kitId, entry]));

    const kitsById = new Map((kits ?? []).map((item: any) => [item.id, item]));

    this.stations = (backends ?? [])
      .sort((a, b) => (a.backen ?? Number.MAX_SAFE_INTEGER) - (b.backen ?? Number.MAX_SAFE_INTEGER))
      .map((backend) => {
        const kitId = backend.kitId;
        const backen = backend.backen;
        const backendKey = backend.backendCode ?? `BK${backen ?? '-'}`;

        const disposition = backend.model ? this.dispositionService.getDispositionByModel(backend.model) : [];
        const visualAid = backend.model ? this.visualAids.getActiveVisualAidByModel(backend.model) : null;
        const rt = runtimeByKitId.get(kitId);
        const kitRuntime = kitsById.get(kitId);
        const materialRows = kitRuntime?.materials ?? [];
        const requiredTotal = materialRows.reduce((sum: number, item: any) => sum + Number(item.quantityRequired ?? 0), 0);
        const actualCaptured = materialRows.reduce((sum: number, item: any) => {
          const actual = item.quantityActual;
          return sum + Number(actual ?? 0);
        }, 0);
        const materialsCoverage = requiredTotal > 0 ? Math.min(100, Math.round((actualCaptured / requiredTotal) * 100)) : null;
        const snapshot: ProductionRuntimeSnapshot = {
          backend: rt?.backend ?? backend,
          events: rt?.events ?? [],
          bayMaterials: rt?.materials ?? [],
          shortageRisk: rt?.risk,
        };

        const completed = Number(rt?.backend?.completedQty ?? backend.completedQty ?? 0);
        return {
          backen,
          backendKey,
          kit: { id: kitId },
          status: backend.status,
          model: backend.model,
          workOrder: backend.workOrder,
          shift: backend.shift,
          quantity: backend.targetQty ?? 0,
          completed,
          progressPct: (backend.targetQty ?? 0) > 0 ? Math.min(100, Math.round((completed / backend.targetQty) * 100)) : 0,
          hasOpenException: !!backend.hasIncident,
          recentAdvances: (advancesByKitId.get(kitId) ?? []).slice(0, 6),
          openResupplies: (resuppliesByKitId.get(kitId) ?? []).filter((item: any) => item.status !== 'delivered'),
          disposition,
          visualAid,
          snapshot,
          kitStatus: kitRuntime?.status ?? null,
          kitMaterialsCoveragePct: materialsCoverage,
          kitActualCaptured: actualCaptured,
          kitRequiredTotal: requiredTotal,
        };
      });

    const startedStations = this.stations.filter((item) => ['in_progress', 'completed'].includes(item.status)).length;
    const readyKits = this.stations.filter((item) => ['ready', 'requested', 'delivered', 'received', 'sent'].includes(item.status)).length;
    const avgProgress = this.stations.length
      ? Math.round(this.stations.reduce((sum, item) => sum + item.progressPct, 0) / this.stations.length)
      : 0;
    this.overview = {
      totalStations: this.stations.length,
      readyKits,
      startedStations,
      avgProgress,
    };
  }

  private buildOpsSections(publications: any[]): void {
    this.readyKits = this.stations
      .filter((station) => ['ready', 'kitted', 'prepared'].includes(station.status))
      .map((station) => ({
        model: station.model ?? 'N/A',
        backendKey: station.backendKey,
        kitId: station.kit?.id ?? 0,
          timestamp: station.snapshot?.backend?.receivedAt ?? new Date().toISOString(),
          status: station.status,
        }));

    const active = this.stations.find((station) => ['requested', 'delivered', 'received', 'sent', 'in_progress'].includes(station.status));
    this.currentKitInProcess = active
      ? {
          model: active.model ?? 'N/A',
          backendKey: active.backendKey,
          kitId: active.kit?.id ?? 0,
          timestamp: active.snapshot?.backend?.receivedAt ?? new Date().toISOString(),
          status: active.status,
        }
      : null;

    const publicationRows = (publications ?? [])
      .flatMap((publication) => publication.planSnapshot ?? publication.lines ?? [])
      .filter((line: any) => !!line?.model)
      .map((line: any) => ({ model: String(line.model), qtyPlanned: Number(line.quantity ?? line.qtyPlanned ?? 0) }));

    const statusByModel = new Map<string, DayPlanRow['status']>();

    this.stations.forEach((station) => {
      const model = station.model ?? 'N/A';
      if (station.status === 'completed') {
        statusByModel.set(model, 'Completado');
        return;
      }
      if (['in_progress', 'requested', 'delivered', 'received', 'sent'].includes(station.status) && statusByModel.get(model) !== 'Completado') {
        statusByModel.set(model, 'En proceso');
        return;
      }
      if (!statusByModel.has(model)) {
        statusByModel.set(model, 'Pendiente');
      }
    });

    this.dayPlan = publicationRows.map((row) => ({
      model: row.model,
      qtyPlanned: row.qtyPlanned,
      status: statusByModel.get(row.model) ?? 'Pendiente',
    }));
  }
}
