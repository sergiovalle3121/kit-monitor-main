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

  // Advance registration state per kit
  advanceDelta: Record<number, number> = {};
  advanceNotes: Record<number, string> = {};
  advancingKitId: number | null = null;
  advanceError: Record<number, string> = {};

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

  registerAdvance(kit: any): void {
    const delta = this.advanceDelta[kit.id];
    if (!delta || delta <= 0) return;
    this.advancingKitId = kit.id;
    this.advanceError[kit.id] = '';

    this.api.createAdvance(kit.id, delta, this.advanceNotes[kit.id]).subscribe({
      next: (result) => {
        // Update kit in-place with new totalCompleted and status
        const idx = this.kits.findIndex(k => k.id === kit.id);
        if (idx >= 0) {
          this.kits[idx].totalCompleted = result.totalCompleted;
          this.kits[idx].status = result.kitStatus;
          // Reload full kit to get updated material consumption
          this.api.getKits().subscribe({ next: (d) => { this.kits = d ?? []; } });
        }
        this.advanceDelta[kit.id] = 0;
        this.advanceNotes[kit.id] = '';
        this.advancingKitId = null;
      },
      error: (err) => {
        this.advanceError[kit.id] = err?.error?.message ?? 'Error al registrar avance';
        this.advancingKitId = null;
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

  maxAdvance(kit: any): number {
    return (kit.plan?.quantity ?? 0) - (kit.totalCompleted ?? 0);
  }
}
