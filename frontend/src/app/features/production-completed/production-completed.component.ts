import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../core/api.service';

interface CompletedRow {
  backendCode: string;
  model: string;
  completedQty: number;
  targetQty: number;
  totalEvents: number;
  lowStockHits: number;
  startedAt: string | null;
  completedAt: string | null;
  closurePct: number;
}

@Component({
  selector: 'app-production-completed',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './production-completed.component.html',
  styleUrl: './production-completed.component.css',
})
export class ProductionCompletedComponent implements OnInit {
  rows: CompletedRow[] = [];
  totalCompletedQty = 0;

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.api.getProductionCompleted().subscribe({
      next: (rows) => {
        this.rows = (rows ?? [])
          .map((row: any) => {
            const completedQty = Number(row.completedQty ?? 0);
            const targetQty = Number(row.targetQty ?? 0);
            return {
              backendCode: row.backendCode,
              model: row.model,
              completedQty,
              targetQty,
              totalEvents: Number(row.totalEvents ?? 0),
              lowStockHits: Number(row.lowStockHits ?? row.lowStockCount ?? 0),
              startedAt: row.startedAt ?? null,
              completedAt: row.completedAt ?? null,
              closurePct: targetQty > 0 ? Math.min(100, Math.round((completedQty / targetQty) * 100)) : 0,
            };
          })
          .sort((left, right) => {
            const leftDate = left.completedAt ? new Date(left.completedAt).getTime() : 0;
            const rightDate = right.completedAt ? new Date(right.completedAt).getTime() : 0;
            return rightDate - leftDate;
          });

        this.totalCompletedQty = this.rows.reduce((sum, row) => sum + row.completedQty, 0);
      },
      error: () => {
        this.rows = [];
        this.totalCompletedQty = 0;
      },
    });
  }
}
