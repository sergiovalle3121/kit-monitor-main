import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiService } from '../../core/api.service';
import { VisualAid } from '../../core/ie-data.models';
import { VisualAidsService } from '../../core/visual-aids.service';

interface BayMaterialState {
  bayId: number;
  partNumber: string;
  description?: string;
  usagePerAssembly: number;
  availableQty: number;
  consumedQty: number;
  lowStockThreshold: number;
  theoreticalConsumed?: number;
  realConsumed?: number;
  deltaConsumed?: number;
  deltaState?: 'normal' | 'vigilar' | 'desviado';
  depletionEtaMinutes?: number | null;
  bayStatus?: string;
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

interface BayLayout {
  id?: number | string;
  model: string;
  partNumber: string;
  bahia: number | string;
}

interface DisplayBayMaterial {
  partNumber: string;
  descripcion: string;
  factor: number;
  disponible: number | string;
  runtime?: BayMaterialState;
}

interface PendingRefreshContext {
  openStationKey: string;
  openBahia: string;
  sessionCount: number;
  wasOpen: boolean;
}

interface LastRegisteredEvent {
  eventId: number;
  at: string;
  bahia: string;
  quantity: number;
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
  selectedBahiaByStation: Record<string, string> = {};
  bayLayoutsByStation: Record<string, BayLayout[]> = {};
  bayMapByStation: Record<string, Record<string, string[]>> = {};
  layoutLoadingByStation: Record<string, boolean> = {};
  layoutErrorByStation: Record<string, string | null> = {};
  registerPulseByStation: Record<string, boolean> = {};
  mesOpenByStation: Record<string, boolean> = {};
  registerSuccessByStation: Record<string, string> = {};
  sessionAssembledByStation: Record<string, number> = {};
  lastSuccessAtByStation: Record<string, string> = {};
  lastSuccessBahiaByStation: Record<string, string> = {};
  quickModeByStation: Record<string, boolean> = {};
  localIncidentsByStation: Record<string, { id?: number; bayId: number; type: string; note?: string; operator?: string; at: string }[]> = {};
  incidentTypeDraftByStation: Record<string, string> = {};
  incidentNoteDraftByStation: Record<string, string> = {};
  undoInProgressByStation: Record<string, boolean> = {};
  lastRegisteredEventByStation: Record<string, LastRegisteredEvent | null> = {};
  private stationModelByKey: Record<string, string | null> = {};
  private pendingRefreshContext: PendingRefreshContext | null = null;

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
  ) {}

  ngOnInit(): void {
    this.visualAids.loadVisualAids().subscribe({
      next: () => this.load(),
      error: () => this.load(),
    });
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
        this.syncStationLayouts();
        this.restorePendingRefreshContext();
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
      clientRequestId: this.generateClientRequestId(station, bayId),
    }).subscribe({
      next: (response) => {
        const openStationKey = this.getStationKey(station);
        const openBahia = this.selectedBahiaByStation[openStationKey] ?? '';
        const sessionCount = this.sessionAssembledByStation[openStationKey] ?? 0;
        const wasOpen = this.mesOpenByStation[openStationKey] === true;
        const duplicated = response?.duplicated === true || response?.code === 'DUPLICATE_REQUEST';
        this.sessionAssembledByStation[openStationKey] = duplicated ? sessionCount : sessionCount + qty;
        this.pendingRefreshContext = {
          openStationKey,
          openBahia,
          sessionCount: this.sessionAssembledByStation[openStationKey],
          wasOpen,
        };

        this.baySaving[key] = false;
        this.bayQty[key] = 1;
        this.bayNotes[key] = '';
        this.registerPulseByStation[openStationKey] = true;
        if (duplicated) {
          this.registerSuccessByStation[openStationKey] = 'Registro duplicado detectado: no se consumió material';
        } else {
          this.registerSuccessByStation[openStationKey] = `Unidad registrada en ${openBahia || `Bahía ${bayId}`}`;
          this.lastSuccessAtByStation[openStationKey] = new Date().toISOString();
          this.lastSuccessBahiaByStation[openStationKey] = openBahia || `Bahía ${bayId}`;
        }
        const createdEventId = Number(response?.lastEvent?.id);
        if (!duplicated && Number.isFinite(createdEventId) && createdEventId > 0) {
          this.lastRegisteredEventByStation[openStationKey] = {
            eventId: createdEventId,
            at: new Date().toISOString(),
            bahia: openBahia || `Bahía ${bayId}`,
            quantity: qty,
          };
        }
        setTimeout(() => { this.registerPulseByStation[openStationKey] = false; }, 300);
        if (this.quickModeByStation[openStationKey]) {
          this.bayQty[key] = 1;
        }
        this.load();
        this.focusQuantityInput(station);
      },
      error: (err) => {
        this.baySaving[key] = false;
        this.requestError[kitId] = this.toPanelErrorMessage(err, 'No se pudo registrar evento de bahía');
      },
    });
  }

  registerSelectedBayAssembly(station: ProductionStationView): void {
    const selected = this.selectedBahiaByStation[this.getStationKey(station)];
    const bayId = this.extractBayNumber(selected);
    if (bayId <= 0 || !this.canRegisterSelectedBay(station)) return;
    this.registerBayAssembly(station, bayId);
  }

  onSelectedBayEnter(station: ProductionStationView, event: Event): void {
    event.preventDefault();
    this.registerSelectedBayAssembly(station);
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

  getStationKey(station: ProductionStationView): string {
    return String(station.kit?.id ?? station.backendKey ?? station.backen);
  }

  getStationModel(station: ProductionStationView): string | null {
    const model = station.model?.trim();
    return model ? model : null;
  }

  normalizeBahiaLabel(value: string | number | null | undefined): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const numeric = raw.replace(/bah[ií]a/ig, '').trim();
    const parsed = Number(numeric);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 6) {
      return `Bahía ${parsed}`;
    }
    return raw;
  }

  extractBayNumber(bahia: string | null | undefined): number {
    const normalized = this.normalizeBahiaLabel(bahia ?? '');
    const match = normalized.match(/(\d+)/);
    return match ? Number(match[1]) : NaN;
  }

  buildBayMap(layoutRows: BayLayout[]): Record<string, string[]> {
    const mapByBay: Record<string, Set<string>> = {};
    layoutRows.forEach((row) => {
      const bayLabel = this.normalizeBahiaLabel(row.bahia);
      if (!bayLabel) return;
      mapByBay[bayLabel] = mapByBay[bayLabel] ?? new Set<string>();
      if (row.partNumber) mapByBay[bayLabel].add(row.partNumber);
    });

    return Object.entries(mapByBay)
      .sort(([left], [right]) => this.extractBayNumber(left) - this.extractBayNumber(right))
      .reduce<Record<string, string[]>>((acc, [bay, values]) => {
        acc[bay] = [...values].sort((a, b) => a.localeCompare(b));
        return acc;
      }, {});
  }

  selectBahia(station: ProductionStationView, bahia: string): void {
    const key = this.getStationKey(station);
    const normalized = this.normalizeBahiaLabel(bahia);
    if (!this.bayMapByStation[key]?.[normalized]) return;
    this.selectedBahiaByStation[key] = normalized;
  }

  getAvailableBahias(station: ProductionStationView): string[] {
    const key = this.getStationKey(station);
    return Object.keys(this.bayMapByStation[key] ?? {})
      .sort((a, b) => this.extractBayNumber(a) - this.extractBayNumber(b));
  }

  openBahiaMES(station: ProductionStationView, bahia: string): void {
    this.selectBahia(station, bahia);
    this.mesOpenByStation[this.getStationKey(station)] = true;
    this.loadBayIncidents(station);
  }

  closeBahiaMES(station: ProductionStationView): void {
    this.mesOpenByStation[this.getStationKey(station)] = false;
  }

  isBahiaMESOpen(station: ProductionStationView): boolean {
    return this.mesOpenByStation[this.getStationKey(station)] ?? false;
  }

  getDisplayedBayMaterials(station: ProductionStationView): DisplayBayMaterial[] {
    const stationKey = this.getStationKey(station);
    const selectedBahia = this.selectedBahiaByStation[stationKey];
    const npList = this.bayMapByStation[stationKey]?.[selectedBahia] ?? [];
    const materials = station.snapshot?.bayMaterials ?? [];

    return npList.map((np) => {
      const runtimeItem = materials.find((m: any) => m.partNumber === np || m.np === np);
      return {
        partNumber: np,
        descripcion: runtimeItem?.description ?? (runtimeItem as any)?.descripcion ?? 'Sin descripción',
        factor: Number(runtimeItem?.usagePerAssembly ?? (runtimeItem as any)?.factor ?? (runtimeItem as any)?.qty ?? 1),
        disponible: runtimeItem?.availableQty ?? (runtimeItem as any)?.remaining ?? (runtimeItem as any)?.available ?? (runtimeItem as any)?.disponible ?? 'N/D',
        runtime: runtimeItem,
      };
    });
  }

  getMaterialHealth(material: DisplayBayMaterial): 'ok' | 'risk' | 'empty' | 'unknown' {
    const raw = material.disponible;
    const available = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(available)) return 'unknown';
    if (available <= 0) return 'empty';
    if (available <= material.factor) return 'risk';
    return 'ok';
  }

  getRecentBayEvents(station: ProductionStationView): any[] {
    const selected = this.selectedBahiaByStation[this.getStationKey(station)];
    const selectedBay = this.extractBayNumber(selected);
    const events = station.snapshot?.events ?? [];

    return [...events]
      .filter((event: any) => {
        const eventBay = Number(event?.bayId ?? event?.bay);
        return Number.isFinite(selectedBay) && eventBay === selectedBay;
      })
      .sort((left: any, right: any) => {
        const leftDate = new Date(left?.timestamp ?? left?.createdAt ?? 0).getTime();
        const rightDate = new Date(right?.timestamp ?? right?.createdAt ?? 0).getTime();
        return rightDate - leftDate;
      })
      .slice(0, 5);
  }

  getLastSuccessfulBayEvent(station: ProductionStationView): string | null {
    const key = this.getStationKey(station);
    const at = this.lastSuccessAtByStation[key];
    if (!at) return null;
    return `${this.lastSuccessBahiaByStation[key] ?? ''} · ${new Date(at).toLocaleTimeString()}`.trim();
  }

  getBayRiskSummary(station: ProductionStationView): { total: number; risk: number; empty: number } {
    const materials = this.getDisplayedBayMaterials(station);
    const risk = materials.filter((m) => this.getMaterialHealth(m) === 'risk').length;
    const empty = materials.filter((m) => this.getMaterialHealth(m) === 'empty').length;
    return { total: materials.length, risk, empty };
  }

  getBayHealth(station: ProductionStationView): 'ok' | 'risk' | 'empty' | 'unknown' {
    const materials = this.getDisplayedBayMaterials(station);
    if (!materials.length) return 'unknown';
    if (materials.some((m) => this.getMaterialHealth(m) === 'empty')) return 'empty';
    if (materials.some((m) => this.getMaterialHealth(m) === 'risk')) return 'risk';
    return 'ok';
  }

  selectedBayOperationalState(station: ProductionStationView): string {
    const key = this.getStationKey(station);
    const selectedBay = this.selectedBahiaByStation[key];
    const bayId = this.extractBayNumber(selectedBay);
    const hasLayout = !!(this.bayMapByStation[key]?.[selectedBay ?? '']?.length);
    if (!hasLayout) return 'not_configured';
    if (!['requested', 'delivered', 'received', 'sent', 'in_progress', 'completed'].includes(station.status)) {
      return 'configured_pending_delivery';
    }

    const runtimeRows = this.materialsForBay(station, bayId);
    if (!runtimeRows.length) return 'configured_not_mounted';

    const nonMountable = runtimeRows.filter((row) => Number(row.usagePerAssembly ?? 0) <= 0).length;
    if (nonMountable === runtimeRows.length) return 'configured_not_mountable';

    const zeroStock = runtimeRows.filter((row) => Number(row.availableQty ?? 0) <= 0).length;
    if (zeroStock === runtimeRows.length) return 'mounted_without_stock';
    if (zeroStock > 0) return 'mounted_partial';

    const anyLowStock = runtimeRows.some((row) => Number(row.availableQty ?? 0) <= Number(row.lowStockThreshold ?? 0));
    if (anyLowStock) return 'at_risk';
    if (this.getRecentBayEvents(station).length) return 'in_production';
    return 'ready_to_produce';
  }

  selectedBayOperationalMessage(station: ProductionStationView): string {
    const key = this.getStationKey(station);
    const selectedBahia = this.selectedBahiaByStation[key] ?? 'Bahía';
    const status = this.selectedBayOperationalState(station);
    if (status === 'not_configured') return `${selectedBahia} no está configurada en la disposición de IE.`;
    if (status === 'configured_pending_delivery') return `${selectedBahia} está configurada por IE pero el backend aún no ha sido entregado a línea.`;
    if (status === 'configured_not_mounted') return `${selectedBahia} está configurada por IE, pero no quedó montada en runtime.`;
    if (status === 'configured_not_mountable') return `${selectedBahia} está configurada, pero faltan factores BOM/datos críticos para montarla.`;
    if (status === 'mounted_without_stock') return `${selectedBahia} fue montada, pero no tiene stock suficiente.`;
    if (status === 'mounted_partial') return `${selectedBahia} fue montada parcialmente; falta stock para algunos NPs.`;
    if (status === 'at_risk') return `${selectedBahia} está montada pero en riesgo por bajo stock.`;
    if (status === 'in_production') return `${selectedBahia} está en producción.`;
    return `${selectedBahia} está lista para producir.`;
  }

  selectedBayConsumptionSummary(station: ProductionStationView): { theoretical: number; real: number; delta: number } {
    const key = this.getStationKey(station);
    const bayId = this.extractBayNumber(this.selectedBahiaByStation[key]);
    const runtimeRows = this.materialsForBay(station, bayId);
    const theoretical = runtimeRows.reduce((sum, row) => sum + Number(row.theoreticalConsumed ?? 0), 0);
    const real = runtimeRows.reduce((sum, row) => sum + Number(row.realConsumed ?? row.consumedQty ?? 0), 0);
    return { theoretical, real, delta: real - theoretical };
  }

  canUndoLastRegister(station: ProductionStationView): boolean {
    const key = this.getStationKey(station);
    const last = this.lastRegisteredEventByStation[key];
    if (!last || this.undoInProgressByStation[key]) return false;
    const selected = this.selectedBahiaByStation[key];
    if (selected !== last.bahia) return false;
    return (Date.now() - new Date(last.at).getTime()) <= 10_000;
  }

  undoAvailabilityMessage(station: ProductionStationView): string {
    if (this.canUndoLastRegister(station)) return 'Deshacer disponible por 10 segundos';
    const key = this.getStationKey(station);
    if (this.lastRegisteredEventByStation[key]) return 'Ventana de deshacer expirada';
    return '';
  }

  undoLastRegister(station: ProductionStationView): void {
    const key = this.getStationKey(station);
    const last = this.lastRegisteredEventByStation[key];
    if (!last || !this.canUndoLastRegister(station)) return;
    this.undoInProgressByStation[key] = true;

    const openBahia = this.selectedBahiaByStation[key] ?? last.bahia;
    this.pendingRefreshContext = {
      openStationKey: key,
      openBahia,
      sessionCount: Math.max(0, (this.sessionAssembledByStation[key] ?? 0) - last.quantity),
      wasOpen: this.mesOpenByStation[key] === true,
    };

    this.api.revertProductionEvent(last.eventId).subscribe({
      next: () => {
        this.undoInProgressByStation[key] = false;
        this.lastRegisteredEventByStation[key] = null;
        this.registerSuccessByStation[key] = 'Último registro revertido';
        this.load();
      },
      error: (err) => {
        this.undoInProgressByStation[key] = false;
        this.requestError[station.kit?.id] = this.toPanelErrorMessage(err, 'No se pudo revertir el último registro');
      },
    });
  }

  reportLocalIncident(station: ProductionStationView): void {
    const key = this.getStationKey(station);
    const kitId = station.kit?.id;
    const bayId = this.extractBayNumber(this.selectedBahiaByStation[key]);
    if (!kitId || !Number.isFinite(bayId) || bayId <= 0) return;
    const type = this.incidentTypeDraftByStation[key] || 'Otro';
    const note = this.incidentNoteDraftByStation[key]?.trim();
    const operator = this.bayOperator[this.bayInputKey(station, bayId)]?.trim() || undefined;

    this.api.createProductionIncident(kitId, bayId, { type, note, operator }).subscribe({
      next: (saved) => {
        const mapped = {
          id: saved?.id,
          bayId: Number(saved?.bayId ?? bayId),
          type: saved?.type ?? type,
          note: saved?.note ?? note,
          operator: saved?.operator ?? operator,
          at: saved?.createdAt ?? new Date().toISOString(),
        };
        this.localIncidentsByStation[key] = [mapped, ...(this.localIncidentsByStation[key] ?? [])].slice(0, 20);
        this.incidentNoteDraftByStation[key] = '';
        this.registerSuccessByStation[key] = 'Incidencia guardada';
      },
      error: (err) => {
        this.requestError[kitId] = this.toPanelErrorMessage(err, 'No se pudo guardar la incidencia');
      },
    });
  }

  lastLocalIncident(station: ProductionStationView): { id?: number; bayId: number; type: string; note?: string; operator?: string; at: string } | null {
    const key = this.getStationKey(station);
    const bayId = this.extractBayNumber(this.selectedBahiaByStation[key]);
    return (this.localIncidentsByStation[key] ?? []).find((item) => item.bayId === bayId) ?? null;
  }

  getRecentBayIncidents(station: ProductionStationView): Array<{ id?: number; bayId: number; type: string; note?: string; operator?: string; at: string }> {
    const key = this.getStationKey(station);
    const bayId = this.extractBayNumber(this.selectedBahiaByStation[key]);
    return (this.localIncidentsByStation[key] ?? [])
      .filter((incident) => incident.bayId === bayId)
      .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
      .slice(0, 5);
  }

  focusQuantityInput(station: ProductionStationView): void {
    const key = this.getStationKey(station);
    requestAnimationFrame(() => {
      const element = document.getElementById(`mes-qty-${key}`) as HTMLInputElement | null;
      element?.focus();
      element?.select();
    });
  }

  canRegisterSelectedBay(station: ProductionStationView): boolean {
    if (!this.canCaptureByBay(station)) return false;
    const key = this.getStationKey(station);
    const selected = this.selectedBahiaByStation[key];
    if (!selected) return false;
    if (!this.bayMapByStation[key]?.[selected]?.length) return false;
    const bayId = this.extractBayNumber(selected);
    if (!Number.isFinite(bayId) || bayId <= 0) return false;
    const operationalState = this.selectedBayOperationalState(station);
    if (['not_configured', 'configured_pending_delivery', 'configured_not_mounted', 'configured_not_mountable', 'mounted_without_stock'].includes(operationalState)) {
      return false;
    }
    const qty = this.quickBayQty(station, bayId);
    const saving = this.baySaving[this.bayInputKey(station, bayId)] ?? false;
    return !saving && Number.isFinite(qty) && qty > 0;
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
    window.open(this.resolveVisualAidUrl(station.visualAid.pdfUrl), '_blank', 'noopener');
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

  private syncStationLayouts(): void {
    const activeKeys = new Set(this.stations.map((station) => this.getStationKey(station)));
    Object.keys(this.bayLayoutsByStation).forEach((key) => {
      if (activeKeys.has(key)) return;
      delete this.bayLayoutsByStation[key];
      delete this.bayMapByStation[key];
      delete this.selectedBahiaByStation[key];
      delete this.layoutLoadingByStation[key];
      delete this.layoutErrorByStation[key];
      delete this.registerPulseByStation[key];
      delete this.mesOpenByStation[key];
      delete this.registerSuccessByStation[key];
      delete this.sessionAssembledByStation[key];
      delete this.lastSuccessAtByStation[key];
      delete this.lastSuccessBahiaByStation[key];
      delete this.quickModeByStation[key];
      delete this.localIncidentsByStation[key];
      delete this.incidentTypeDraftByStation[key];
      delete this.incidentNoteDraftByStation[key];
      delete this.undoInProgressByStation[key];
      delete this.lastRegisteredEventByStation[key];
      delete this.stationModelByKey[key];
    });

    this.stations.forEach((station) => {
      const key = this.getStationKey(station);
      const model = this.getStationModel(station);
      if (!model) {
        this.layoutLoadingByStation[key] = false;
        this.layoutErrorByStation[key] = 'No hay disposición guardada para este modelo. Pide a IE guardar la disposición.';
        this.bayLayoutsByStation[key] = [];
        this.bayMapByStation[key] = {};
        this.selectedBahiaByStation[key] = '';
        this.stationModelByKey[key] = null;
        return;
      }

      if (this.stationModelByKey[key] === model && this.bayLayoutsByStation[key]) {
        return;
      }

      this.layoutLoadingByStation[key] = true;
      this.layoutErrorByStation[key] = null;
      this.stationModelByKey[key] = model;

      this.api.getBayLayouts(model).subscribe({
        next: (rows) => {
          const layoutRows = (rows ?? []) as BayLayout[];
          this.bayLayoutsByStation[key] = layoutRows;
          const bayMap = this.buildBayMap(layoutRows);
          this.bayMapByStation[key] = bayMap;
          const availableBahias = Object.keys(bayMap).sort((a, b) => this.extractBayNumber(a) - this.extractBayNumber(b));
          const current = this.selectedBahiaByStation[key];
          this.selectedBahiaByStation[key] = current && bayMap[current] ? current : (availableBahias[0] ?? '');
          this.layoutErrorByStation[key] = availableBahias.length
            ? null
            : 'No hay disposición guardada para este modelo. Pide a IE guardar la disposición.';
          this.layoutLoadingByStation[key] = false;
        },
        error: () => {
          this.layoutLoadingByStation[key] = false;
          this.layoutErrorByStation[key] = 'No hay disposición guardada para este modelo. Pide a IE guardar la disposición.';
          this.bayLayoutsByStation[key] = [];
          this.bayMapByStation[key] = {};
          this.selectedBahiaByStation[key] = '';
        },
      });

      this.loadBayIncidents(station);
    });
  }

  private restorePendingRefreshContext(): void {
    const context = this.pendingRefreshContext;
    if (!context) return;
    const { openStationKey, openBahia, sessionCount, wasOpen } = context;
    this.pendingRefreshContext = null;

    const found = this.stations.find((station) => this.getStationKey(station) === openStationKey);
    if (!found) {
      delete this.mesOpenByStation[openStationKey];
      delete this.selectedBahiaByStation[openStationKey];
      delete this.sessionAssembledByStation[openStationKey];
      return;
    }

    this.mesOpenByStation[openStationKey] = wasOpen;
    const availableBahias = Object.keys(this.bayMapByStation[openStationKey] ?? {});
    if (openBahia && availableBahias.includes(openBahia)) {
      this.selectedBahiaByStation[openStationKey] = openBahia;
    } else if (availableBahias.length) {
      this.selectedBahiaByStation[openStationKey] = availableBahias
        .sort((a, b) => this.extractBayNumber(a) - this.extractBayNumber(b))[0];
    }
    this.sessionAssembledByStation[openStationKey] = sessionCount;
  }

  private loadBayIncidents(station: ProductionStationView): void {
    const key = this.getStationKey(station);
    const kitId = station.kit?.id;
    const bayId = this.extractBayNumber(this.selectedBahiaByStation[key]);
    if (!kitId || !Number.isFinite(bayId) || bayId <= 0) return;
    this.api.getProductionIncidents(kitId, bayId).subscribe({
      next: (rows) => {
        this.localIncidentsByStation[key] = (rows ?? []).map((row: any) => ({
          id: row.id,
          bayId: Number(row.bayId ?? bayId),
          type: row.type,
          note: row.note,
          operator: row.operator,
          at: row.createdAt,
        }));
      },
      error: () => {
        this.localIncidentsByStation[key] = this.localIncidentsByStation[key] ?? [];
      },
    });
  }

  private generateClientRequestId(station: ProductionStationView, bayId: number): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return `req-${station.kit?.id ?? 'x'}-b${bayId}-${crypto.randomUUID()}`;
    }
    return `req-${station.kit?.id ?? 'x'}-b${bayId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private toPanelErrorMessage(error: any, fallback: string): string {
    const code = error?.error?.code;
    if (code === 'MATERIAL_INSUFFICIENT') return 'Material insuficiente para registrar';
    if (code === 'NO_LAYOUT_CONFIGURED') return 'No hay disposición IE guardada para este modelo';
    if (code === 'BAY_NOT_CONFIGURED_IN_LAYOUT') return 'La bahía seleccionada no está configurada en disposición IE';
    if (code === 'BAY_NOT_MOUNTED_RUNTIME') return 'Bahía configurada por IE pero aún no montada en backend';
    if (code === 'DUPLICATE_REQUEST') return 'Registro duplicado detectado';
    if (code === 'EVENT_ALREADY_REVERTED') return 'El evento ya fue revertido';
    if (code === 'EVENT_NOT_LAST_REVERSIBLE') return 'Solo se puede revertir el último evento de la bahía';
    if (code === 'UNDO_WINDOW_EXPIRED') return 'Ventana de deshacer expirada';
    if (code === 'INCIDENT_TYPE_INVALID') return 'Tipo de incidencia inválido';
    return error?.error?.message ?? fallback;
  }

  private resolveVisualAidUrl(rawUrl: string): string {
    const value = String(rawUrl ?? '').trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) {
      return value;
    }
    const apiBase = environment.apiUrl.replace(/\/$/, '');
    return `${apiBase}/visual-aids/file/${encodeURIComponent(value)}`;
  }
}
