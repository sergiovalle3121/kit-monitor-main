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
  bayPickerOpen: Record<number, boolean> = {};
  baySelection: Record<number, string> = {};

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

  refresh(): void {
    if (!this.modelFilter) {
      this.npRows = [];
      this.layoutByPart.clear();
      this.bayPickerOpen = {};
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
        this.bayPickerOpen = {};
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
        this.bayPickerOpen = {};
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
    this.bayPickerOpen[bay] = false;
  }

  showPicker(bay: number): void {
    this.bayPickerOpen[bay] = true;
  }

  cancelPicker(bay: number): void {
    this.baySelection[bay] = '';
    this.bayPickerOpen[bay] = false;
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

  trackByPart(_index: number, row: BomNpRow): string {
    return row.partNumber;
  }
}
