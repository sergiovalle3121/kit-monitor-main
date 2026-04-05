import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, interval, Subscription } from 'rxjs';
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
  timestamp: string;
  kind: 'complete' | 'partial';
  reason?: string;
  kitId?: number;
  expiresAt: string;
}

interface PartialForm {
  model: string;
  qty: number;
  reason: string;
}

@Component({
  selector: 'app-production-completed',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './production-completed.component.html',
  styleUrl: './production-completed.component.css',
})
export class ProductionCompletedComponent implements OnInit, OnDestroy {
  rows: CompletedRow[] = [];
  visibleRows: CompletedRow[] = [];
  activeModels: string[] = [];

  reasonCatalog = ['Falta de material', 'Paro de línea', 'Evento externo', 'Otro'];
  form: PartialForm = { model: '', qty: 1, reason: 'Falta de material' };

  private tickerSub: Subscription | null = null;

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.load();
    this.tickerSub = interval(60_000).subscribe(() => this.refreshVisibility());
  }

  ngOnDestroy(): void {
    this.tickerSub?.unsubscribe();
  }

  load(): void {
    forkJoin({
      completed: this.api.getProductionCompleted(),
      active: this.api.getProductionBackends(),
    }).subscribe({
      next: ({ completed, active }) => {
        const serverRows: CompletedRow[] = (completed ?? []).map((row: any) => {
          const timestamp = row.completedAt ?? row.startedAt ?? new Date().toISOString();
          return {
            backendCode: row.backendCode ?? `BK${row.backen ?? '-'}`,
            model: row.model ?? 'N/A',
            completedQty: Number(row.completedQty ?? 0),
            targetQty: Number(row.targetQty ?? 0),
            totalEvents: Number(row.totalEvents ?? row.completedQty ?? 0),
            lowStockHits: Number(row.lowStockHits ?? row.lowStockCount ?? 0),
            startedAt: row.startedAt ?? null,
            completedAt: row.completedAt ?? null,
            timestamp,
            kind: 'complete',
            kitId: row.kitId,
            expiresAt: this.expiresAt(timestamp),
          };
        });

        const partialRows = this.readPartialRows();
        this.rows = [...serverRows, ...partialRows].sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());

        this.activeModels = [...new Set((active ?? []).map((item: any) => String(item.model ?? '').trim()).filter(Boolean))];
        this.form.model = this.form.model || this.activeModels[0] || '';
        this.refreshVisibility();
      },
      error: () => {
        this.rows = this.readPartialRows();
        this.refreshVisibility();
      },
    });
  }

  registerPartial(): void {
    if (!this.form.model || this.form.qty <= 0) return;
    const timestamp = new Date().toISOString();
    const kitId = this.activeModels.indexOf(this.form.model) + 1;
    const newRow: CompletedRow = {
      backendCode: 'PARCIAL',
      model: this.form.model,
      completedQty: Number(this.form.qty),
      targetQty: Number(this.form.qty),
      totalEvents: 0,
      lowStockHits: 0,
      startedAt: timestamp,
      completedAt: null,
      timestamp,
      kind: 'partial',
      reason: this.form.reason,
      kitId,
      expiresAt: this.expiresAt(timestamp),
    };

    const partialRows = [newRow, ...this.readPartialRows()];
    localStorage.setItem('km_partial_assemblies', JSON.stringify(partialRows));
    this.pushNotification(`Ensamble parcial: ${newRow.model}. Material será retirado del kit ${newRow.kitId}.`);
    this.load();
  }

  expiresInLabel(row: CompletedRow): string | null {
    const remaining = new Date(row.expiresAt).getTime() - Date.now();
    if (remaining <= 0 || remaining > 4 * 60 * 60 * 1000) return null;
    const totalMinutes = Math.floor(remaining / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `Expira en ${hours}h ${mins}m`;
  }

  private refreshVisibility(): void {
    const now = Date.now();
    this.visibleRows = this.rows.filter((row) => new Date(row.expiresAt).getTime() > now);
    const partialRows = this.readPartialRows().filter((row) => new Date(row.expiresAt).getTime() > now);
    localStorage.setItem('km_partial_assemblies', JSON.stringify(partialRows));
  }

  private expiresAt(timestamp: string): string {
    const base = new Date(timestamp).getTime();
    return new Date(base + (24 * 60 * 60 * 1000)).toISOString();
  }

  private readPartialRows(): CompletedRow[] {
    try {
      const raw = localStorage.getItem('km_partial_assemblies');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private pushNotification(message: string): void {
    try {
      const raw = localStorage.getItem('km_shell_notifications');
      const current = raw ? JSON.parse(raw) : [];
      const next = [{
        id: `partial-${Date.now()}`,
        message,
        type: 'partial',
        createdAt: new Date().toISOString(),
      }, ...(Array.isArray(current) ? current : [])];
      localStorage.setItem('km_shell_notifications', JSON.stringify(next.slice(0, 50)));
    } catch {
      // no-op
    }
  }
}
