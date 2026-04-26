import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EnterpriseContextBannerComponent } from '../../shared/enterprise-context-banner/enterprise-context-banner.component';
import { ApiService } from '../../core/api.service';
import { BomVisualItem, MaterialImageViewerComponent } from './material-image-viewer.component';

interface BomItemView extends BomVisualItem {
  id?: number;
  model: string;
  partNumber: string;
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
  imports: [EnterpriseContextBannerComponent, CommonModule, FormsModule, MaterialImageViewerComponent],
  templateUrl: './bom.component.html',
  styleUrls: ['./bom.component.css'],
})
export class BomComponent implements OnInit, OnDestroy {
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

  imageValidationError: string | null = null;
  imagePreview: string | null = null;

  viewerOpen = false;
  viewerModel = '';
  viewerItems: BomItemView[] = [];
  viewerActiveIndex = 0;

  form = {
    model: '',
    partNumber: '',
    description: '',
    location: '',
    usageFactor: 1,
    unit: 'EA',
    imageUrl: '',
    specUrl: '',
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    if (this.imagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(this.imagePreview);
    }
  }

  load(): void {
    this.loading = true;
    this.error = null;

    this.api.getBom().subscribe({
      next: (data) => {
        this.items = (data ?? []).map(item => this.sanitizeItem(item));
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

    const payload = {
      ...this.form,
      imageUrl: this.form.imageUrl?.trim() || undefined,
      specUrl: this.form.specUrl?.trim() || undefined,
      hasImage: !!this.form.imageUrl?.trim(),
    };

    this.api.createBomItem(payload).subscribe({
      next: (created) => {
        this.items = [...this.items, this.sanitizeItem(created)];
        this.rebuildGroups();
        this.submitting = false;
        this.showForm = false;
        this.resetForm();
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

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.imageValidationError = null;
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024;

    if (!validTypes.includes(file.type)) {
      this.imageValidationError = 'Formato no valido. Usa JPG, PNG o WEBP.';
      input.value = '';
      return;
    }

    if (file.size > maxSize) {
      this.imageValidationError = 'La imagen supera 5MB. Usa una version mas ligera.';
      input.value = '';
      return;
    }

    if (this.imagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(this.imagePreview);
    }

    const previewUrl = URL.createObjectURL(file);
    this.imagePreview = previewUrl;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      this.form.imageUrl = result;
    };
    reader.readAsDataURL(file);
  }

  removeImage(): void {
    if (this.imagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(this.imagePreview);
    }

    this.imagePreview = null;
    this.imageValidationError = null;
    this.form.imageUrl = '';
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

  hasImage(item: BomItemView): boolean {
    return !!item.imageUrl;
  }

  openViewer(group: BomModelGroup, item: BomItemView): void {
    const visualItems = group.materials.filter(material => !!material.imageUrl);
    if (!visualItems.length || !item.imageUrl) return;

    this.viewerModel = group.model;
    this.viewerItems = visualItems;
    this.viewerActiveIndex = Math.max(
      0,
      visualItems.findIndex(material => material.partNumber === item.partNumber),
    );
    this.viewerOpen = true;
  }

  closeViewer(): void {
    this.viewerOpen = false;
  }

  setViewerIndex(index: number): void {
    this.viewerActiveIndex = index;
  }

  markThumbError(item: BomItemView, event: Event): void {
    item.imageUrl = null;
    item.hasImage = false;
    const target = event.target as HTMLImageElement;
    target.style.display = 'none';
  }

  get visibleMaterialCount(): number {
    return this.filteredGroups.reduce((total, group) => total + group.materialCount, 0);
  }

  get missingLocationCount(): number {
    return this.items.filter(item => !item.location?.trim()).length;
  }

  get missingDescriptionCount(): number {
    return this.items.filter(item => !item.description?.trim()).length;
  }

  get missingCatalogCount(): number {
    return this.items.filter(
      item => !item.location?.trim() || !item.description?.trim(),
    ).length;
  }

  get hasCatalogGaps(): boolean {
    return this.missingCatalogCount > 0;
  }

  private resetForm(): void {
    this.removeImage();
    this.form = {
      model: '',
      partNumber: '',
      description: '',
      location: '',
      usageFactor: 1,
      unit: 'EA',
      imageUrl: '',
      specUrl: '',
    };
  }

  private sanitizeItem(item: BomItemView): BomItemView {
    return {
      ...item,
      hasImage: !!item.imageUrl,
    };
  }

  private rebuildGroups(): void {
    const groups = new Map<string, BomItemView[]>();

    for (const item of this.items) {
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
}
