import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { DispositionService } from '../../core/disposition.service';
import { ConfirmModalService } from '../../shared/confirm-modal/confirm-modal.service';

interface BomNpRow {
  partNumber: string;
  description: string;
  qtyPlanned: number;
  miniMost: number | null;
}
interface SavedDispositionRow {
  model: string;
  updatedAt: string | null;
  npCount: number;
}

@Component({
  selector: 'app-disposition',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './disposition.component.html',
  styleUrl: './disposition.component.css',
})
export class DispositionComponent implements OnInit {
  loading = false;
  saving = false;
  models: string[] = [];
  modelFilter = '';
  npRows: BomNpRow[] = [];
  layoutByPart = new Map<string, Set<number>>();
  baySelection: Record<number, string> = {};
  savedDispositions: SavedDispositionRow[] = [];
  saveNotice = '';

  readonly bayOptions = [1, 2, 3, 4, 5, 6];

  constructor(
    private readonly api: ApiService,
    private readonly disposition: DispositionService,
    private readonly confirmModal: ConfirmModalService,
  ) {}

  ngOnInit(): void {
    this.loadModels();
  }

  get totalAssignments(): number {
    return this.npRows.reduce((sum, row) => sum + this.assignedBaysForPart(row.partNumber).length, 0);
  }

  loadModels(): void {
    this.loading = true;
    this.api.getBom().subscribe({
      next: (bom) => {
        const models = [...new Set((bom ?? []).map((item) => String(item.model ?? '').trim()).filter(Boolean))]
          .sort((left, right) => left.localeCompare(right));
        this.models = models;
        this.modelFilter = this.modelFilter || models[0] || '';
        this.loadSavedDispositions(models);
        this.refresh();
      },
      error: () => {
        this.models = [];
        this.modelFilter = '';
        this.npRows = [];
        this.layoutByPart.clear();
        this.loading = false;
      },
    });
  }

  loadSavedDispositions(models: string[] = this.models): void {
    if (!models.length) {
      this.savedDispositions = [];
      return;
    }
    const requests = models.map((model) => this.api.getBayLayouts(model));
    forkJoin(requests).subscribe({
      next: (responses) => {
        this.savedDispositions = responses
          .map((layouts, index) => {
            const rows = layouts ?? [];
            if (!rows.length) return null;
            const latest = rows
              .map((item: any) => String(item.updatedAt ?? item.createdAt ?? ''))
              .filter(Boolean)
              .sort()
              .at(-1) ?? null;
            return {
              model: models[index],
              updatedAt: latest,
              npCount: new Set(rows.map((item: any) => String(item.partNumber ?? ''))).size,
            } as SavedDispositionRow;
          })
          .filter((item): item is SavedDispositionRow => !!item)
          .sort((a, b) => a.model.localeCompare(b.model));
      },
      error: () => {
        this.savedDispositions = [];
      },
    });
  }

  refresh(): void {
    if (!this.modelFilter) {
      this.npRows = [];
      this.layoutByPart.clear();
      this.baySelection = {};
      this.loading = false;
      return;
    }

    this.loading = true;
    forkJoin({
      bom: this.api.getBom(this.modelFilter),
      layouts: this.api.getBayLayouts(this.modelFilter),
      plans: this.api.getPlans(),
      currentDisposition: of(this.disposition.getDispositionByModel(this.modelFilter)),
    }).subscribe({
      next: ({ bom, layouts, plans, currentDisposition }) => {
        const miniMostByPart = new Map<string, number>();
        currentDisposition.forEach((item) => {
          miniMostByPart.set(item.partNumber, item.mostScore);
        });

        this.npRows = (bom ?? []).map((item) => ({
          partNumber: String(item.partNumber ?? ''),
          description: item.description || 'Sin descripción',
          qtyPlanned: Number(item.usageFactor ?? 0),
          miniMost: miniMostByPart.get(item.partNumber) ?? null,
        }));

        this.layoutByPart.clear();
        this.baySelection = {};
        (layouts ?? []).forEach((layout) => {
          const partNumber = String(layout.partNumber ?? '');
          const bayId = Number(layout.bahia ?? 0);
          if (!partNumber || !this.bayOptions.includes(bayId)) return;
          const current = this.layoutByPart.get(partNumber) ?? new Set<number>();
          current.add(bayId);
          this.layoutByPart.set(partNumber, current);
        });

        this.loading = false;
      },
      error: () => {
        this.npRows = [];
        this.layoutByPart.clear();
        this.baySelection = {};
        this.loading = false;
      },
    });
  }

  assignedBaysForPart(partNumber: string): number[] {
    return [...(this.layoutByPart.get(partNumber) ?? new Set<number>())].sort((a, b) => a - b);
  }

  itemsForBay(bay: number): BomNpRow[] {
    return this.npRows
      .filter((row) => this.layoutByPart.get(row.partNumber)?.has(bay))
      .sort((left, right) => left.partNumber.localeCompare(right.partNumber));
  }

  optionsForBay(bay: number): BomNpRow[] {
    return this.npRows
      .filter((row) => !(this.layoutByPart.get(row.partNumber)?.has(bay) ?? false))
      .sort((left, right) => left.partNumber.localeCompare(right.partNumber));
  }

  addPartToBay(partNumber: string, bay: number): void {
    if (!partNumber || !this.bayOptions.includes(bay)) return;
    const current = this.layoutByPart.get(partNumber) ?? new Set<number>();
    current.add(bay);
    this.layoutByPart.set(partNumber, current);
    this.baySelection[bay] = '';
  }

  async removePartFromBay(partNumber: string, bay: number): Promise<void> {
    const confirmed = await this.confirmModal.open({
      title: 'Remover asignación',
      message: `¿Deseas remover ${partNumber} de la bahía ${bay}?`,
      confirmText: 'Remover',
      type: 'destructive',
    });

    if (!confirmed) return;

    const current = this.layoutByPart.get(partNumber);
    if (!current) return;
    current.delete(bay);
    if (!current.size) {
      this.layoutByPart.delete(partNumber);
      return;
    }
    this.layoutByPart.set(partNumber, current);
  }

  save(): void {
    if (!this.modelFilter || this.saving) return;
    this.saveNotice = '';

    const payload: Array<{ model: string; partNumber: string; bahia: number }> = [];
    this.layoutByPart.forEach((bays, partNumber) => {
      bays.forEach((bahia) => {
        payload.push({ model: this.modelFilter, partNumber, bahia });
      });
    });

    this.saving = true;
    this.api.deleteBayLayoutsByModel(this.modelFilter).subscribe({
      next: () => {
        if (!payload.length) {
          this.saving = false;
          return;
        }

        this.api.createBayLayoutsBulk(payload).subscribe({
          next: () => {
            this.saving = false;
            this.saveNotice = 'Disposición guardada correctamente';
            this.loadSavedDispositions();
            this.refresh();
          },
          error: () => {
            this.saving = false;
          },
        });
      },
      error: () => {
        this.saving = false;
      },
    });
  }

  editSavedDisposition(model: string): void {
    this.modelFilter = model;
    this.refresh();
  }

  async deleteSavedDisposition(model: string): Promise<void> {
    // Explicit scope guard: keep `confirmed` and `model` in-method to avoid TS scope regressions in CI/CD builds.
    const confirmed = await this.confirmModal.open({
      title: 'Eliminar disposición',
      message: `¿Eliminar disposición guardada para ${model}?`,
      confirmText: 'Eliminar',
      type: 'destructive',
    });
    if (!confirmed) return;

    this.api.deleteBayLayoutsByModel(model).subscribe({
      next: () => {
        if (this.modelFilter === model) {
          this.layoutByPart.clear();
          this.refresh();
        }
        this.loadSavedDispositions();
      },
    });
  }

  trackByPart(_index: number, row: any): string {
    return row.partNumber;
  }
}
