import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { ApiService } from '../../core/api.service';
import { VisualAid } from '../../core/ie-data.models';
import { VisualAidsService } from '../../core/visual-aids.service';
import { ConfirmModalService } from '../../shared/confirm-modal/confirm-modal.service';

@Component({
  selector: 'app-visual-aids',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './visual-aids.component.html',
  styleUrl: './visual-aids.component.css',
})
export class VisualAidsComponent implements OnInit {
  // Nota: este componente solo implementa OnInit (no AfterViewChecked).
  aids: VisualAid[] = [];
  filtered: VisualAid[] = [];
  query = '';
  modelFilter = '';
  processFilter = '';
  activeFilter: 'all' | 'active' | 'inactive' = 'all';

  showForm = false;
  formError: string | null = null;
  fileName = '';
  selectedPdfFile: File | null = null;
  imagePreviewUrl: string | null = null;
  isImage = false;
  modelSuggestions: string[] = [];
  annotations: Array<{ x: number; y: number; text: string }> = [];

  form = {
    model: '',
    title: '',
    process: '',
    area: '',
    revision: '',
    isActive: true,
    notes: '',
  };

  constructor(
    private readonly visualAids: VisualAidsService,
    private readonly api: ApiService,
    private readonly confirmModal: ConfirmModalService,
  ) {}

  ngOnInit(): void {
    this.visualAids.getVisualAids().subscribe((items) => {
      this.aids = items;
      this.applyFilters();
    });

    this.visualAids.loadVisualAids().subscribe();

    this.api.getBom().subscribe((items) => {
      this.modelSuggestions = [...new Set((items ?? [])
        .map((item) => String(item?.model ?? '').trim())
        .filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));
    });
  }

  applyFilters(): void {
    const q = this.query.trim().toLowerCase();
    this.filtered = this.aids.filter((item) => {
      if (this.modelFilter && item.model !== this.modelFilter) return false;
      if (this.processFilter && item.process !== this.processFilter) return false;
      if (this.activeFilter === 'active' && !item.isActive) return false;
      if (this.activeFilter === 'inactive' && item.isActive) return false;
      if (!q) return true;
      return [item.model, item.title, item.process].some((value) => value.toLowerCase().includes(q));
    });
  }

  models(): string[] {
    return [...new Set(this.aids.map(item => item.model))].sort();
  }

  processes(): string[] {
    return [...new Set(this.aids.map(item => item.process))].sort();
  }

  onPdfSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf';
    this.isImage = file.type.startsWith('image/');

    if (!isPdf && !this.isImage) {
      this.formError = 'Solo se permiten PDF o imágenes.';
      input.value = '';
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      this.formError = 'El archivo supera 12MB.';
      input.value = '';
      return;
    }

    this.formError = null;
    this.fileName = file.name;
    this.selectedPdfFile = file;
    this.annotations = [];

    if (this.isImage) {
      const reader = new FileReader();
      reader.onload = (e) => this.imagePreviewUrl = e.target?.result as string;
      reader.readAsDataURL(file);
    } else {
      this.imagePreviewUrl = null;
    }
  }

  onImageClick(event: MouseEvent): void {
    if (!this.isImage) return;
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    
    const text = prompt('Añade un texto de anotación para este punto:');
    if (text?.trim()) {
      this.annotations.push({ x, y, text: text.trim() });
    }
  }

  removeAnnotation(index: number, event: Event): void {
    event.stopPropagation();
    this.annotations.splice(index, 1);
  }



  save(): void {
    if (!this.form.model || !this.form.title || !this.form.process || !this.selectedPdfFile) {
      this.formError = 'Modelo, título, proceso y PDF son obligatorios.';
      return;
    }

    this.visualAids.createVisualAid({
      model: this.form.model,
      title: this.form.title,
      process: this.form.process,
      area: this.form.area,
      revision: this.form.revision,
      notes: this.form.notes,
      isActive: this.form.isActive,
      uploadedBy: 'IE',
      annotations: JSON.stringify(this.annotations),
    }, this.selectedPdfFile).subscribe({
      next: () => {
        this.showForm = false;
        this.fileName = '';
        this.selectedPdfFile = null;
        this.formError = null;
        this.form = {
          model: '',
          title: '',
          process: '',
          area: '',
          revision: '',
          isActive: true,
          notes: '',
        };
        this.imagePreviewUrl = null;
        this.isImage = false;
        this.annotations = [];
      },
      error: () => {
        this.formError = 'No se pudo guardar la ayuda visual.';
      },
    });
  }

  toggleActive(item: VisualAid): void {
    this.visualAids.updateVisualAid(item.id, { isActive: !item.isActive }).subscribe();
  }

  async removeAid(item: VisualAid): Promise<void> {
    const confirmed = await this.confirmModal.open({
      title: '¿Eliminar ayuda visual?',
      message: 'Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      type: 'destructive',
    });
    if (!confirmed) return;
    this.visualAids.deleteVisualAid(item.id).subscribe();
  }

  openInNewTab(item: VisualAid): void {
    window.open(this.resolvePdfUrl(item.pdfUrl), '_blank', 'noopener');
  }

  private resolvePdfUrl(rawUrl: string): string {
    const value = String(rawUrl ?? '').trim();
    if (!value) return '';

    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    const apiBase = environment.apiUrl.replace(/\/$/, '');
    return `${apiBase}/visual-aids/file/${encodeURIComponent(value)}`;
  }
}
