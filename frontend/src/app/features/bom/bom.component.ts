import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

interface BomItemView {
  id?: number;
  model: string;
  partNumber: string;
  description?: string | null;
  location?: string | null;
  usageFactor: number;
  unit?: string | null;
}

interface BomModelGroup {
  model: string;
  materials: BomItemView[];
  materialCount: number;
  locatedCount: number;
}

@Component({
  selector: 'app-bom',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bom.component.html',
  styleUrls: ['./bom.component.css'],
})
export class BomComponent implements OnInit {
  items: BomItemView[] = [];
  allGroups: BomModelGroup[] = [];
  filteredGroups: BomModelGroup[] = [];
  expandedModels = new Set<string>();

  loading = false;
  error: string | null = null;

  filterModel = '';
  showForm = false;
  submitting = false;
  formError: string | null = null;

  importing = false;
  importResult: { imported: number; errors: any[] } | null = null;
  importError: string | null = null;

  catalogImporting = false;
  catalogResult: { updated: number; catalogRows: number; matchedPartNumbers: number } | null = null;
  catalogError: string | null = null;

  form = {
    model: '',
    partNumber: '',
    description: '',
    location: '',
    usageFactor: 1,
    unit: 'EA',
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;

    this.api.getBom().subscribe({
      next: (data) => {
        this.items = data ?? [];
        this.rebuildGroups();
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudo cargar el BOM';
        this.loading = false;
      },
    });
  }

  onFilterChange(): void {
    this.applyFilter();
  }

  submit(): void {
    this.submitting = true;
    this.formError = null;

    this.api.createBomItem({ ...this.form }).subscribe({
      next: (created) => {
        this.items = [...this.items, created];
        this.rebuildGroups();
        this.submitting = false;
        this.showForm = false;
        this.form = {
          model: '',
          partNumber: '',
          description: '',
          location: '',
          usageFactor: 1,
          unit: 'EA',
        };
      },
      error: (err) => {
        this.formError = err?.error?.message ?? 'Error al guardar el item';
        this.submitting = false;
      },
    });
  }

  onBomFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.importing = true;
    this.importResult = null;
    this.importError = null;

    this.api.importBom(file).subscribe({
      next: (result) => {
        this.importResult = result;
        this.importing = false;
        this.load();
        input.value = '';
      },
      error: (err) => {
        this.importError = err?.error?.message ?? 'Error al importar el archivo BOM';
        this.importing = false;
        input.value = '';
      },
    });
  }

  onCatalogFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.catalogImporting = true;
    this.catalogResult = null;
    this.catalogError = null;

    this.api.importBomCatalog(file).subscribe({
      next: (result) => {
        this.catalogResult = result;
        this.catalogImporting = false;
        this.load();
        input.value = '';
      },
      error: (err) => {
        this.catalogError = err?.error?.message ?? 'Error al actualizar el catalogo Kan-Ban';
        this.catalogImporting = false;
        input.value = '';
      },
    });
  }

  toggleModel(model: string): void {
    if (this.expandedModels.has(model)) {
      this.expandedModels.delete(model);
      return;
    }

    this.expandedModels.add(model);
  }

  isExpanded(model: string): boolean {
    return this.expandedModels.has(model);
  }

  descriptionLabel(item: BomItemView): string {
    return item.description?.trim() || 'Sin descripcion';
  }

  locationLabel(item: BomItemView): string {
    return item.location?.trim() || 'Sin ubicacion';
  }

  get visibleMaterialCount(): number {
    return this.filteredGroups.reduce((total, group) => total + group.materialCount, 0);
  }

  get missingLocationCount(): number {
    return this.items.filter(item => this.isEligibleItem(item) && !item.location?.trim()).length;
  }

  get missingDescriptionCount(): number {
    return this.items.filter(item => this.isEligibleItem(item) && !item.description?.trim()).length;
  }

  get missingCatalogCount(): number {
    return this.items.filter(
      item => this.isEligibleItem(item) && (!item.location?.trim() || !item.description?.trim()),
    ).length;
  }

  get hasCatalogGaps(): boolean {
    return this.missingCatalogCount > 0;
  }

  private rebuildGroups(): void {
    const groups = new Map<string, BomItemView[]>();

    for (const item of this.items) {
      if (!this.isEligibleItem(item)) continue;

      const model = item.model.trim();
      const current = groups.get(model) ?? [];
      current.push(item);
      groups.set(model, current);
    }

    this.allGroups = [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([model, materials]) => {
        const sortedMaterials = [...materials].sort((left, right) =>
          left.partNumber.localeCompare(right.partNumber),
        );

        return {
          model,
          materials: sortedMaterials,
          materialCount: sortedMaterials.length,
          locatedCount: sortedMaterials.filter(item => !!item.location?.trim()).length,
        };
      });

    this.applyFilter();
  }

  private applyFilter(): void {
    const query = this.filterModel.trim().toLowerCase();

    this.filteredGroups = query
      ? this.allGroups.filter(group => group.model.toLowerCase().includes(query))
      : [...this.allGroups];

    for (const model of [...this.expandedModels]) {
      if (!this.filteredGroups.some(group => group.model === model)) {
        this.expandedModels.delete(model);
      }
    }
  }

  private isEligibleItem(item: BomItemView): boolean {
    return this.isOpCode(item.model) && this.isOpCode(item.partNumber);
  }

  private isOpCode(value: string | null | undefined): boolean {
    return typeof value === 'string' && value.trim().toUpperCase().startsWith('OP-');
  }
}
