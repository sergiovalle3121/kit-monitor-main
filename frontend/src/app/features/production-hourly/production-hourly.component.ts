import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { forkJoin, of, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-production-hourly',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './production-hourly.component.html',
  styleUrl: './production-hourly.component.css',
})
export class ProductionHourlyComponent implements OnInit {
  loading = false;
  rows: any[] = [];

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.loading = true;
    this.api.getProductionBackends().pipe(
      switchMap((backends) => {
        const calls = (backends ?? []).map((item: any) => this.api.getProductionHourly(item.kitId));
        return calls.length ? forkJoin(calls) : of([]);
      }),
    ).subscribe({
      next: (data) => {
        this.rows = (data as any[]).flat();
        this.loading = false;
      },
      error: () => {
        this.rows = [];
        this.loading = false;
      },
    });
  }
}
