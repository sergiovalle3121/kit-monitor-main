import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';

interface HourPoint {
  label: string;
  real: number;
  planned: number;
}

interface BomConsumptionRow {
  partNumber: string;
  description: string;
  qtyPerUnit: number;
  totalConsumed: number;
  qtyDelivered: number;
  delta: number;
}

interface HourlyModelView {
  model: string;
  backendKey: string;
  expanded: boolean;
  chartPathReal: string;
  chartPathPlanned: string;
  points: HourPoint[];
  rows: BomConsumptionRow[];
}

@Component({
  selector: 'app-production-hourly',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './production-hourly.component.html',
  styleUrl: './production-hourly.component.css',
})
export class ProductionHourlyComponent implements OnInit {
  loading = false;
  models: HourlyModelView[] = [];

  readonly chartWidth = 680;
  readonly chartHeight = 220;
  readonly chartPadding = 26;

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.api.getProductionBackends().pipe(
      switchMap((backends) => {
        const calls = (backends ?? []).map((backend: any) => forkJoin({
          backend: of(backend),
          hourly: this.api.getProductionHourly(backend.kitId),
          materials: this.api.getProductionMaterials(backend.kitId),
          bom: this.api.getBom(backend.model),
        }));
        return calls.length ? forkJoin(calls) : of([]);
      }),
      map((payloads: any[]) => payloads.map((payload) => this.toModelView(payload))),
    ).subscribe({
      next: (rows) => {
        this.models = rows;
        this.loading = false;
      },
      error: () => {
        this.models = [];
        this.loading = false;
      },
    });
  }

  toggleModel(model: HourlyModelView): void {
    model.expanded = !model.expanded;
  }

  hasNegativeDelta(row: BomConsumptionRow): boolean {
    return row.totalConsumed > row.qtyDelivered;
  }

  private toModelView(payload: any): HourlyModelView {
    const backend = payload.backend;
    const hourly = payload.hourly ?? [];
    const materials = payload.materials ?? [];
    const bom = payload.bom ?? [];

    const byHour = new Map<string, number>();
    hourly.forEach((item: any) => {
      const key = String(item.hourBucket).slice(0, 13);
      byHour.set(key, (byHour.get(key) ?? 0) + Number(item.totalQty ?? item.units ?? 0));
    });

    const sortedHours = [...byHour.keys()].sort((left, right) => left.localeCompare(right));
    const totalTarget = Number(backend.targetQty ?? 0);
    const points: HourPoint[] = sortedHours.map((hour, index) => {
      const planned = sortedHours.length
        ? Math.round(((index + 1) / sortedHours.length) * totalTarget)
        : 0;
      return {
        label: hour.slice(11) + ':00',
        real: byHour.get(hour) ?? 0,
        planned,
      };
    });

    const maxY = Math.max(1, ...points.map((point) => Math.max(point.real, point.planned)));
    const buildPath = (key: 'real' | 'planned') => points.map((point, index) => {
      const x = points.length <= 1
        ? this.chartPadding
        : this.chartPadding + (((this.chartWidth - (this.chartPadding * 2)) / (points.length - 1)) * index);
      const y = this.chartHeight - this.chartPadding - ((point[key] / maxY) * (this.chartHeight - (this.chartPadding * 2)));
      return `${index === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');

    const bomByPart = new Map<string, any>();
    bom.forEach((item: any) => bomByPart.set(item.partNumber, item));

    const rows: BomConsumptionRow[] = materials.map((item: any) => {
      const delivered = Number(item.availableQty ?? 0) + Number(item.consumedQty ?? 0);
      const totalConsumed = Number(item.consumedQty ?? 0);
      return {
        partNumber: item.partNumber,
        description: item.description || bomByPart.get(item.partNumber)?.description || 'Sin descripción',
        qtyPerUnit: Number(item.usagePerAssembly ?? bomByPart.get(item.partNumber)?.usageFactor ?? 0),
        totalConsumed,
        qtyDelivered: delivered,
        delta: delivered - totalConsumed,
      };
    }).sort((left: BomConsumptionRow, right: BomConsumptionRow) => left.partNumber.localeCompare(right.partNumber));

    return {
      model: backend.model ?? 'N/A',
      backendKey: backend.backendCode ?? `BK${backend.backen ?? '-'}`,
      expanded: false,
      chartPathReal: buildPath('real'),
      chartPathPlanned: buildPath('planned'),
      points,
      rows,
    };
  }
}
