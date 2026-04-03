import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';

interface ProductionCatalogItem {
  partNumber: string;
  description?: string | null;
  location?: string | null;
  usageFactor?: number | null;
  unit?: string | null;
}

interface ProductionMaterialView {
  id: number | null;
  partNumber: string;
  description: string;
  location: string;
  unit: string;
  quantityRequired: number;
  quantityConsumed: number;
  quantityRemaining: number;
  quantityResupplied: number;
  usagePerUnit: number;
  coverageUnits: number | null;
  isLowCoverage: boolean;
  isCriticalCoverage: boolean;
}

interface ProductionBayView {
  bahia: number;
  materials: ProductionMaterialView[];
}

interface ProductionStationView {
  backen: number;
  kit: any | null;
  status: string;
  model: string | null;
  workOrder: string | null;
  shift: string | null;
  quantity: number;
  completed: number;
  progressPct: number;
  hasOpenException: boolean;
  layoutBays: ProductionBayView[];
  unassignedMaterials: ProductionMaterialView[];
  recentAdvances: any[];
  openResupplies: any[];
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

  advanceQty: Record<number, number> = {};
  advanceNotes: Record<number, string> = {};
  advancingKitId: number | null = null;
  advanceError: Record<number, string> = {};

  updatingStatusKitId: number | null = null;
  requestError: Record<number, string> = {};

  resupplyQty: Record<string, number | null> = {};
  requestingResupplyKey: string | null = null;
  resupplyError: Record<string, string> = {};

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
    preparing: 'Preparando',
    prepared: 'Armado',
    kitted: 'Armado',
    ready: 'Listo',
    requested: 'Solicitado',
    delivered: 'Entregado',
    sent: 'Enviado',
    received: 'Recibido',
    in_progress: 'En produccion',
    completed: 'Completado',
    empty: 'Sin kit',
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;

    this.api.getKits().pipe(
      switchMap((kits) => {
        const stationKits = this.selectStationKits(kits ?? []);
        const models = [...new Set(
          stationKits.map((kit) => kit.plan?.model).filter((model): model is string => !!model),
        )];

        const advancesRequest = stationKits.length
          ? forkJoin(
              stationKits.map((kit) =>
                this.api.getAdvances(kit.id).pipe(
                  map((advances) => ({ kitId: kit.id, advances: advances ?? [] })),
                ),
              ),
            )
          : of([]);

        const resuppliesRequest = stationKits.length
          ? forkJoin(
              stationKits.map((kit) =>
                this.api.getResupplies(kit.id).pipe(
                  map((resupplies) => ({ kitId: kit.id, resupplies: resupplies ?? [] })),
                ),
              ),
            )
          : of([]);

        const layoutsRequest = models.length
          ? forkJoin(
              models.map((modelName) =>
                this.api.getBayLayouts(modelName).pipe(
                  map((rows) => ({ model: modelName, rows: rows ?? [] })),
                ),
              ),
            )
          : of([]);

        const bomRequest = models.length
          ? forkJoin(
              models.map((modelName) =>
                this.api.getBom(modelName).pipe(
                  map((rows) => ({ model: modelName, rows: rows ?? [] })),
                ),
              ),
            )
          : of([]);

        return forkJoin({
          kits: of(kits ?? []),
          advances: advancesRequest,
          resupplies: resuppliesRequest,
          layouts: layoutsRequest,
          bom: bomRequest,
        });
      }),
    ).subscribe({
      next: ({ kits, advances, resupplies, layouts, bom }) => {
        this.buildStations(kits, advances, resupplies, layouts, bom);
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

  canCapture(station: ProductionStationView): boolean {
    return ['delivered', 'received', 'sent', 'in_progress'].includes(station.status);
  }

  canRequestKit(station: ProductionStationView): boolean {
    return station.status === 'ready';
  }

  quickQtyFor(station: ProductionStationView): number {
    const kitId = station.kit?.id;
    return kitId ? this.advanceQty[kitId] ?? 1 : 1;
  }

  updateQuickQty(station: ProductionStationView, value: number | string): void {
    const kitId = station.kit?.id;
    if (!kitId) return;
    const parsed = Number(value);
    this.advanceQty[kitId] = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  onAdvanceEnter(station: ProductionStationView, event: Event): void {
    event.preventDefault();
    this.registerAdvance(station);
  }

  registerAdvance(station: ProductionStationView): void {
    const kitId = station.kit?.id;
    if (!kitId) return;

    const qty = this.quickQtyFor(station);
    if (!qty || qty <= 0) return;

    this.advancingKitId = kitId;
    this.advanceError[kitId] = '';

    this.api.createAdvance(kitId, qty, this.advanceNotes[kitId]?.trim() || undefined).subscribe({
      next: () => {
        this.advanceQty[kitId] = 1;
        this.advanceNotes[kitId] = '';
        this.advancingKitId = null;
        this.load();
      },
      error: (err) => {
        this.advanceError[kitId] = err?.error?.message ?? 'No se pudo registrar el avance';
        this.advancingKitId = null;
      },
    });
  }

  requestKit(station: ProductionStationView): void {
    const kitId = station.kit?.id;
    if (!kitId) return;

    this.updatingStatusKitId = kitId;
    this.requestError[kitId] = '';

    this.api.updateKitStatus(kitId, 'requested').subscribe({
      next: () => {
        this.updatingStatusKitId = null;
        this.load();
      },
      error: (err) => {
        this.requestError[kitId] = err?.error?.message ?? 'No se pudo solicitar el kit';
        this.updatingStatusKitId = null;
      },
    });
  }

  resupplyKey(station: ProductionStationView, material: ProductionMaterialView): string {
    return `${station.kit?.id ?? 'x'}-${material.partNumber}`;
  }

  requestResupply(station: ProductionStationView, material: ProductionMaterialView): void {
    const kitId = station.kit?.id;
    if (!kitId) return;

    const key = this.resupplyKey(station, material);
    const qty = this.resupplyQty[key];
    if (!qty || qty <= 0) return;

    this.requestingResupplyKey = key;
    this.resupplyError[key] = '';

    this.api.createResupply(
      kitId,
      material.partNumber,
      qty,
      material.description,
      'production_request',
    ).subscribe({
      next: () => {
        this.resupplyQty[key] = null;
        this.requestingResupplyKey = null;
        this.load();
      },
      error: (err) => {
        this.resupplyError[key] = err?.error?.message ?? 'No se pudo pedir el material';
        this.requestingResupplyKey = null;
      },
    });
  }

  onResupplyEnter(station: ProductionStationView, material: ProductionMaterialView, event: Event): void {
    event.preventDefault();
    this.requestResupply(station, material);
  }

  coverageLabel(material: ProductionMaterialView): string {
    if (material.coverageUnits === null) return 'Sin calculo';
    return `${Math.max(0, Math.floor(material.coverageUnits))} uds`;
  }

  private buildStations(
    kits: any[],
    advances: Array<{ kitId: number; advances: any[] }>,
    resupplies: Array<{ kitId: number; resupplies: any[] }>,
    layouts: Array<{ model: string; rows: any[] }>,
    bom: Array<{ model: string; rows: any[] }>,
  ): void {
    const selectedByBacken = new Map<number, any>(
      this.selectStationKits(kits).map((kit) => [kit.plan.backen, kit] as const),
    );
    const advancesByKitId = new Map(advances.map((entry) => [entry.kitId, entry.advances]));
    const resuppliesByKitId = new Map(resupplies.map((entry) => [entry.kitId, entry.resupplies]));
    const layoutsByModel = new Map(layouts.map((entry) => [entry.model, entry.rows]));
    const bomByModel = new Map(
      bom.map((entry) => [
        entry.model,
        new Map<string, ProductionCatalogItem>(
          entry.rows.map((item) => [item.partNumber, item] as const),
        ),
      ]),
    );

    this.stations = this.backens.map((backen) => {
      const kit = selectedByBacken.get(backen);
      if (!kit?.plan) {
        return {
          backen,
          kit: null,
          status: 'empty',
          model: null,
          workOrder: null,
          shift: null,
          quantity: 0,
          completed: 0,
          progressPct: 0,
          hasOpenException: false,
          layoutBays: [],
          unassignedMaterials: [],
          recentAdvances: [],
          openResupplies: [],
        };
      }

      const catalog = bomByModel.get(kit.plan.model) ?? new Map<string, ProductionCatalogItem>();
      const materialsByPart = new Map<string, ProductionMaterialView>(
        (kit.materials ?? []).map((material: any) => [
          material.partNumber,
          this.toMaterialView(material, catalog.get(material.partNumber), kit.plan.quantity),
        ] as const),
      );

      const layoutRows = layoutsByModel.get(kit.plan.model) ?? [];
      const assignedPartNumbers = new Set<string>();
      const layoutBays: ProductionBayView[] = [1, 2, 3, 4, 5, 6]
        .map((bahia) => {
          const materials: ProductionMaterialView[] = layoutRows
            .filter((row: any) => row.bahia === bahia)
            .map((row: any) => {
              assignedPartNumbers.add(row.partNumber);
              return materialsByPart.get(row.partNumber)
                ?? this.toMaterialView(null, catalog.get(row.partNumber), kit.plan.quantity, row.partNumber);
            })
            .sort((left, right) => left.partNumber.localeCompare(right.partNumber));

          return { bahia, materials };
        })
        .filter((bay) => bay.materials.length > 0);

      const unassignedMaterials: ProductionMaterialView[] = [...materialsByPart.values()]
        .filter((material) => !assignedPartNumbers.has(material.partNumber))
        .sort((left, right) => left.partNumber.localeCompare(right.partNumber));

      return {
        backen,
        kit,
        status: kit.status,
        model: kit.plan.model,
        workOrder: kit.plan.workOrder,
        shift: kit.plan.shift,
        quantity: kit.plan.quantity,
        completed: kit.totalCompleted ?? 0,
        progressPct: kit.plan.quantity > 0
          ? Math.round(((kit.totalCompleted ?? 0) / kit.plan.quantity) * 100)
          : 0,
        hasOpenException: kit.hasOpenException ?? false,
        layoutBays,
        unassignedMaterials,
        recentAdvances: (advancesByKitId.get(kit.id) ?? []).slice(0, 6),
        openResupplies: (resuppliesByKitId.get(kit.id) ?? []).filter((item: any) => item.status !== 'delivered'),
      };
    });
  }

  private toMaterialView(
    material: any | null,
    catalogItem?: ProductionCatalogItem,
    planQuantity = 0,
    forcedPartNumber?: string,
  ): ProductionMaterialView {
    const quantityRequired = material?.quantityRequired ?? ((catalogItem?.usageFactor ?? 0) * planQuantity);
    const quantityConsumed = material?.quantityConsumed ?? 0;
    const quantityRemaining = material?.quantityRemaining ?? quantityRequired;
    const usagePerUnit = planQuantity > 0 ? quantityRequired / planQuantity : (catalogItem?.usageFactor ?? 0);
    const coverageUnits = usagePerUnit > 0 ? quantityRemaining / usagePerUnit : null;

    return {
      id: material?.id ?? null,
      partNumber: forcedPartNumber ?? material?.partNumber ?? catalogItem?.partNumber ?? '',
      description: catalogItem?.description?.trim() || material?.description?.trim() || 'Sin descripcion',
      location: catalogItem?.location?.trim() || 'Sin ubicacion',
      unit: material?.unit || catalogItem?.unit || 'EA',
      quantityRequired,
      quantityConsumed,
      quantityRemaining,
      quantityResupplied: material?.quantityResupplied ?? 0,
      usagePerUnit,
      coverageUnits,
      isLowCoverage: coverageUnits !== null && coverageUnits <= 12,
      isCriticalCoverage: coverageUnits !== null && coverageUnits <= 5,
    };
  }

  private selectStationKits(kits: any[]): any[] {
    return this.backens
      .map((backen) =>
        kits
          .filter((kit) => kit.plan?.backen === backen && kit.status !== 'completed')
          .sort((left, right) => this.compareKits(left, right))[0],
      )
      .filter((kit): kit is any => !!kit);
  }

  private compareKits(left: any, right: any): number {
    const statusDiff = this.priorityFor(left.status) - this.priorityFor(right.status);
    if (statusDiff !== 0) return statusDiff;

    const scheduledDiff = this.dateSortValue(left.plan?.scheduledAt) - this.dateSortValue(right.plan?.scheduledAt);
    if (scheduledDiff !== 0) return scheduledDiff;

    const sequenceDiff = this.numberSortValue(left.plan?.sequence) - this.numberSortValue(right.plan?.sequence);
    if (sequenceDiff !== 0) return sequenceDiff;

    const createdDiff = this.dateSortValue(left.createdAt) - this.dateSortValue(right.createdAt);
    if (createdDiff !== 0) return createdDiff;

    return this.numberSortValue(left.id) - this.numberSortValue(right.id);
  }

  private priorityFor(status: string): number {
    return this.stationPriority[status] ?? Number.MAX_SAFE_INTEGER;
  }

  private dateSortValue(value: string | null | undefined): number {
    if (!value) return Number.MAX_SAFE_INTEGER;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
  }

  private numberSortValue(value: number | null | undefined): number {
    return typeof value === 'number' ? value : Number.MAX_SAFE_INTEGER;
  }
}
