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

  private buildSlots(kits: any[], plans: any[]): void {
    for (const bk of this.backens) {
      // Prefer active (non-completed) kit; fallback to any kit for this backen
      const kit =
        kits.find(k => k.plan?.backen === bk && k.status !== 'completed') ??
        kits.find(k => k.plan?.backen === bk);

      if (kit) {
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
      } else {
        // Check for a pending/active plan without a kit yet (= scheduled)
        const plan = plans.find(
          p => p.backen === bk && (p.status === 'pending' || p.status === 'active'),
        );
        if (plan) {
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
}
