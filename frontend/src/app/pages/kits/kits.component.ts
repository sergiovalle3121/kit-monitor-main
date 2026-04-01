import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-kits',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './kits.html',
  styleUrls: ['./kits.css'],
})
export class KitsComponent implements OnInit {
  kits: any[] = [];
  plans: any[] = [];
  loading = false;
  error: string | null = null;

  showForm = false;
  selectedPlanId: number | null = null;
  creating = false;
  createError: string | null = null;

  expandedKitId: number | null = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadKits();
    this.api.getPlans().subscribe({ next: (d) => (this.plans = d ?? []) });
  }

  loadKits(): void {
    this.loading = true;
    this.api.getKits().subscribe({
      next: (d) => { this.kits = d ?? []; this.loading = false; },
      error: () => { this.error = 'No se pudieron cargar los kits'; this.loading = false; },
    });
  }

  createKit(): void {
    if (!this.selectedPlanId) return;
    this.creating = true;
    this.createError = null;
    this.api.createKit(this.selectedPlanId).subscribe({
      next: (kit) => {
        this.kits = [kit, ...this.kits];
        this.creating = false;
        this.showForm = false;
        this.selectedPlanId = null;
        this.expandedKitId = kit.id;
      },
      error: (err) => {
        this.createError = err?.error?.message ?? 'Error al crear el kit';
        this.creating = false;
      },
    });
  }

  toggleExpand(kitId: number): void {
    this.expandedKitId = this.expandedKitId === kitId ? null : kitId;
  }

  plansWithoutKit(): any[] {
    const usedPlanIds = new Set(this.kits.map(k => k.plan?.id));
    return this.plans.filter(p => !usedPlanIds.has(p.id));
  }
}
