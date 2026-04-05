import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';

interface BayDispositionRow {
  bayId: number;
  partNumber: string;
  description: string;
  usageFactor: number;
  quantityRequired: number;
}

interface BayDispositionView {
  bayId: number;
  rows: BayDispositionRow[];
  totalParts: number;
  totalRequired: number;
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
  error: string | null = null;

  models: string[] = [];
  modelFilter = '';
  bays: BayDispositionView[] = [];

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.loadModels();
  }

  loadModels(): void {
    this.loading = true;
    this.error = null;

    forkJoin({
      plans: this.api.getPlans(),
      kits: this.api.getKits(),
    }).subscribe({
      next: ({ plans, kits }) => {
        const planModels = (plans ?? []).map((plan: any) => (plan.model ?? '').trim()).filter((model: string) => !!model);
        const kitModels = (kits ?? []).map((kit: any) => (kit?.plan?.model ?? '').trim()).filter((model: string) => !!model);
        this.models = [...new Set([...planModels, ...kitModels])].sort();

        if (!this.modelFilter && this.models.length) {
          this.modelFilter = this.models[0];
        }

        if (!this.modelFilter) {
          this.bays = [];
          this.loading = false;
          return;
        }

        this.loadDisposition(this.modelFilter);
      },
      error: () => {
        this.loading = false;
        this.error = 'No se pudieron cargar los modelos disponibles';
      },
    });
  }

  onModelChange(model: string): void {
    this.modelFilter = model;
    this.loadDisposition(model);
  }

  private loadDisposition(model: string): void {
    this.loading = true;
    this.error = null;

    forkJoin({
      layout: this.api.getBayLayouts(model),
      bom: this.api.getBom(model),
      kits: this.api.getKits(),
    }).subscribe({
      next: ({ layout, bom, kits }) => {
        const bomByPart = new Map<string, any>((bom ?? []).map((item: any) => [item.partNumber, item]));
        const activeKit = (kits ?? []).find((item: any) => item?.plan?.model === model && ['preparing', 'kitted', 'ready', 'requested', 'delivered', 'in_progress', 'received', 'sent'].includes(item.status));
        const kitMaterials = new Map<string, any>((activeKit?.materials ?? []).map((mat: any) => [mat.partNumber, mat]));
        const lotQty = Number(activeKit?.plan?.quantity ?? 0);

        const rows: BayDispositionRow[] = (layout ?? []).map((item: any) => {
          const bomItem = bomByPart.get(item.partNumber);
          const material = kitMaterials.get(item.partNumber);
          const usageFactor = Number(bomItem?.usageFactor ?? 0);
          const quantityRequired = Number(material?.quantityRequired ?? (lotQty > 0 ? usageFactor * lotQty : 0));

          return {
            bayId: Number(item.bahia),
            partNumber: item.partNumber,
            description: bomItem?.description ?? material?.description ?? 'Sin descripción',
            usageFactor,
            quantityRequired,
          };
        });

        this.bays = [1, 2, 3, 4, 5, 6].map((bayId) => {
          const bayRows = rows
            .filter((row) => row.bayId === bayId)
            .sort((left, right) => left.partNumber.localeCompare(right.partNumber));
          const totalRequired = bayRows.reduce((sum, row) => sum + row.quantityRequired, 0);
          return {
            bayId,
            rows: bayRows,
            totalParts: bayRows.length,
            totalRequired,
          };
        });

        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'No se pudo cargar la disposición por bahías';
      },
    });
  }
}
