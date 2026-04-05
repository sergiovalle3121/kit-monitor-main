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
  bk: number | null;
  bay: number | null;
}

interface GridBayCell {
  bay: number;
  partNumber: string | null;
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
  models: string[] = [];
  modelFilter = '';
  npRows: BomNpRow[] = [];

  readonly bkOptions = [1, 2, 3, 4, 5, 6, 7];
  readonly bayOptions = [1, 2, 3, 4, 5, 6];

  private slotToPartNumber = new Map<string, string>();

  constructor(
    private readonly api: ApiService,
    private readonly disposition: DispositionService,
    private readonly confirmModal: ConfirmModalService,
  ) {}

  ngOnInit(): void {
    this.loadModels();
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
        this.loading = false;
      },
    });
  }

  refresh(): void {
    if (!this.modelFilter) {
      this.npRows = [];
      this.loading = false;
      return;
    }

    this.loading = true;
    forkJoin({
      bom: this.api.getBom(this.modelFilter),
      layouts: this.api.getBayLayouts(this.modelFilter),
      currentDisposition: of(this.disposition.getDispositionByModel(this.modelFilter)),
    }).subscribe({
      next: ({ bom, layouts, currentDisposition }) => {
        const miniMostByPart = new Map<string, number>();
        currentDisposition.forEach((item) => {
          miniMostByPart.set(item.partNumber, item.mostScore);
        });

        const assignmentByPart = new Map<string, { bk: number | null; bay: number | null }>();
        (layouts ?? []).forEach((layout) => {
          assignmentByPart.set(layout.partNumber, {
            bk: this.extractBkFromLocation(layout.location),
            bay: Number(layout.bahia ?? 0) || null,
          });
        });

        this.npRows = (bom ?? []).map((item) => {
          const assignment = assignmentByPart.get(item.partNumber);
          return {
            partNumber: item.partNumber,
            description: item.description || 'Sin descripción',
            qtyPlanned: Number(item.usageFactor ?? 0),
            miniMost: miniMostByPart.get(item.partNumber) ?? null,
            bk: assignment?.bk ?? null,
            bay: assignment?.bay ?? null,
          };
        });

        this.rebuildSlotIndex();
        this.loading = false;
      },
      error: () => {
        this.npRows = [];
        this.slotToPartNumber.clear();
        this.loading = false;
      },
    });
  }

  async onAssignmentChange(row: BomNpRow, nextBk: number | null, nextBay: number | null): Promise<void> {
    if (!nextBk || !nextBay) {
      row.bk = nextBk;
      row.bay = nextBay;
      this.rebuildSlotIndex();
      return;
    }

    const slotKey = this.slotKey(nextBk, nextBay);
    const occupiedBy = this.slotToPartNumber.get(slotKey);
    if (occupiedBy && occupiedBy !== row.partNumber) {
      const confirmed = await this.confirmModal.open({
        title: 'Reemplazar asignación',
        message: `Esta bahía ya tiene asignado ${occupiedBy}. ¿Deseas reemplazarlo?`,
        confirmText: 'Reemplazar',
        type: 'destructive',
      });
      if (!confirmed) return;
      const occupiedRow = this.npRows.find((candidate) => candidate.partNumber === occupiedBy);
      if (occupiedRow) {
        occupiedRow.bk = null;
        occupiedRow.bay = null;
      }
    }

    row.bk = nextBk;
    row.bay = nextBay;
    this.rebuildSlotIndex();
  }

  baysForBk(bk: number): GridBayCell[] {
    const partByBay = new Map<number, string>();
    this.npRows.forEach((row) => {
      if (row.bk === bk && row.bay) {
        partByBay.set(row.bay, row.partNumber);
      }
    });

    return this.bayOptions.map((bay) => ({ bay, partNumber: partByBay.get(bay) ?? null }));
  }

  trackByPart(_index: number, row: BomNpRow): string {
    return row.partNumber;
  }

  private rebuildSlotIndex(): void {
    this.slotToPartNumber.clear();
    this.npRows.forEach((row) => {
      if (row.bk && row.bay) {
        this.slotToPartNumber.set(this.slotKey(row.bk, row.bay), row.partNumber);
      }
    });
  }

  private slotKey(bk: number, bay: number): string {
    return `${bk}-${bay}`;
  }

  private extractBkFromLocation(location: string | null | undefined): number | null {
    if (!location) return null;
    const match = String(location).match(/BK\s*(\d+)/i);
    return match ? Number(match[1]) : null;
  }
}
