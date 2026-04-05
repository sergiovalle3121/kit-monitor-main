import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { forkJoin, of, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';

interface HourlyRow {
  backendKey: string;
  model: string;
  bayId: number;
  hourBucket: string;
  units: number;
  events: number;
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
  rows: HourlyRow[] = [];

  totalUnits = 0;
  totalEvents = 0;
  lastHourUnits = 0;

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.api.getProductionBackends().pipe(
      switchMap((backends) => {
        const backendRows = backends ?? [];
        const calls = backendRows.map((item: any) => this.api.getProductionHourly(item.kitId));

        return calls.length
          ? forkJoin(calls).pipe(
            switchMap((hourlyPayload) => of({ backends: backendRows, hourlyPayload })),
          )
          : of({ backends: [], hourlyPayload: [] });
      }),
    ).subscribe({
      next: ({ backends, hourlyPayload }) => {
        const enriched = (hourlyPayload as any[]).flatMap((rows: any[], idx: number) => {
          const backend = (backends as any[])[idx];
          return (rows ?? []).map((row) => ({
            backendKey: backend?.backendCode ?? `BK${backend?.backen ?? '-'}`,
            model: backend?.model ?? 'N/A',
            bayId: Number(row.bayId),
            hourBucket: row.hourBucket,
            units: Number(row.totalQty ?? row.units ?? 0),
            events: Number(row.events ?? 0),
          }));
        });

        this.rows = enriched.sort((left, right) => {
          if (left.hourBucket !== right.hourBucket) {
            return right.hourBucket.localeCompare(left.hourBucket);
          }
          if (left.backendKey !== right.backendKey) {
            return left.backendKey.localeCompare(right.backendKey);
          }
          return left.bayId - right.bayId;
        });

        this.totalUnits = this.rows.reduce((sum, row) => sum + row.units, 0);
        this.totalEvents = this.rows.reduce((sum, row) => sum + row.events, 0);
        const mostRecentBucket = this.rows[0]?.hourBucket;
        this.lastHourUnits = mostRecentBucket
          ? this.rows.filter((row) => row.hourBucket === mostRecentBucket).reduce((sum, row) => sum + row.units, 0)
          : 0;

        this.loading = false;
      },
      error: () => {
        this.rows = [];
        this.totalUnits = 0;
        this.totalEvents = 0;
        this.lastHourUnits = 0;
        this.loading = false;
      },
    });
  }
}
