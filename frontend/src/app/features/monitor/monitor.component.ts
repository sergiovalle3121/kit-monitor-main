import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-monitor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './monitor.component.html',
  styleUrls: ['./monitor.component.css'],
})
export class MonitorComponent implements OnInit {
  loading = false;
  error: string | null = null;
  backens = [1, 2, 3, 4, 5, 6, 7];
  slots: Record<number, any> = {};
  private readonly statusPriority: Record<string, number> = {
    requested: 1,
    ready: 2,
    kitted: 3,
    prepared: 3,
    preparing: 4,
    scheduled: 5,
    delivered: 6,
    sent: 6,
    received: 7,
    in_progress: 8,
    completed: 9,
  };

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
    in_progress: 'En proceso',
    completed: 'Completado',
    empty: 'Sin programar',
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loading = true;
    forkJoin({
      kits: this.api.getKits(),
      plans: this.api.getPlans(),
    }).subscribe({
      next: ({ kits, plans }) => {
        this.buildSlots(kits ?? [], plans ?? []);
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

  private compareCandidates(a: any, b: any): number {
    const priorityDiff = this.priorityFor(a.status) - this.priorityFor(b.status);
    if (priorityDiff !== 0) return priorityDiff;

    const scheduledDiff = this.dateSortValue(a.scheduledAt) - this.dateSortValue(b.scheduledAt);
    if (scheduledDiff !== 0) return scheduledDiff;

    const sequenceDiff = this.numberSortValue(a.sequence) - this.numberSortValue(b.sequence);
    if (sequenceDiff !== 0) return sequenceDiff;

    const createdDiff = this.dateSortValue(a.createdAt) - this.dateSortValue(b.createdAt);
    if (createdDiff !== 0) return createdDiff;

    return this.numberSortValue(a.id) - this.numberSortValue(b.id);
  }

  private dateSortValue(value: string | null | undefined): number {
    if (!value) return Number.MAX_SAFE_INTEGER;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
  }

  private numberSortValue(value: number | null | undefined): number {
    return typeof value === 'number' ? value : Number.MAX_SAFE_INTEGER;
  }

  private priorityFor(status: string): number {
    return this.statusPriority[status] ?? Number.MAX_SAFE_INTEGER;
  }

  private buildSlots(kits: any[], plans: any[]): void {
    const usedPlanIds = new Set<number>(
      kits
        .map(k => k.plan?.id)
        .filter((id): id is number => typeof id === 'number'),
    );

    for (const bk of this.backens) {
      const candidates = [
        ...kits
          .filter(k => k.plan?.backen === bk)
          .map(k => ({
            type: 'kit',
            item: k,
            id: k.id,
            status: k.status,
            scheduledAt: k.plan?.scheduledAt,
            sequence: k.plan?.sequence,
            createdAt: k.createdAt,
          })),
        ...plans
          .filter(
            p =>
              p.backen === bk &&
              (p.status === 'pending' || p.status === 'active') &&
              !usedPlanIds.has(p.id),
          )
          .map(p => ({
            type: 'plan',
            item: p,
            id: p.id,
            status: 'scheduled',
            scheduledAt: p.scheduledAt,
            sequence: p.sequence,
            createdAt: p.createdAt,
          })),
      ].sort((a, b) => this.compareCandidates(a, b));

      const selected = candidates[0];

      if (selected?.type === 'kit') {
        const kit = selected.item;
        const qty = kit.plan?.quantity ?? 0;
        const completed = kit.totalCompleted ?? 0;
        this.slots[bk] = {
          status: kit.status,
          model: kit.plan?.model,
          workOrder: kit.plan?.workOrder,
          shift: kit.plan?.shift,
          quantity: qty,
          completed,
          progressPct: qty > 0 ? Math.round((completed / qty) * 100) : 0,
          hasException: kit.hasOpenException ?? false,
        };
      } else if (selected?.type === 'plan') {
        const plan = selected.item;
        this.slots[bk] = {
          status: 'scheduled',
          model: plan.model,
          workOrder: plan.workOrder,
          shift: plan.shift,
          quantity: plan.quantity,
          completed: 0,
          progressPct: 0,
          hasException: false,
        };
      } else {
        this.slots[bk] = {
          status: 'empty',
          completed: 0,
          progressPct: 0,
          hasException: false,
        };
      }
    }
  }
}
