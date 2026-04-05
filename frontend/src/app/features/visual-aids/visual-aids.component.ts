import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';
import { ApiService } from '../../core/api.service';
import { VisualAid } from '../../core/ie-data.models';
import { VisualAidsService } from '../../core/visual-aids.service';
import { ConfirmModalService } from '../../shared/confirm-modal/confirm-modal.service';

interface VisualAidViewer {
  item: VisualAid;
  safePdfUrl: SafeResourceUrl;
}

@Component({
  selector: 'app-visual-aids',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './visual-aids.component.html',
  styleUrl: './visual-aids.component.css',
})
export class VisualAidsComponent implements OnInit {
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
  modelSuggestions: string[] = [];

  viewer: VisualAidViewer | null = null;

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
    private readonly sanitizer: DomSanitizer,
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

    if (file.type !== 'application/pdf') {
      this.formError = 'Solo se permite PDF.';
      input.value = '';
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      this.formError = 'PDF supera 12MB.';
      input.value = '';
      return;
    }

    this.formError = null;
    this.fileName = file.name;
    this.selectedPdfFile = file;
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

  openViewer(item: VisualAid): void {
    this.viewer = {
      item,
      safePdfUrl: this.sanitizer.bypassSecurityTrustResourceUrl(this.resolvePdfUrl(item.pdfUrl)),
    };
  }

  openInNewTab(item: VisualAid): void {
    window.open(this.resolvePdfUrl(item.pdfUrl), '_blank', 'noopener');
  }

  private resolvePdfUrl(rawUrl: string): string {
    const value = String(rawUrl ?? '').trim();
    if (!value) return '';

    if (/^https?:\/\//i.test(value) || /^data:application\/pdf/i.test(value)) {
      return value;
    }

    const apiBase = environment.apiUrl.replace(/\/$/, '');
    return `${apiBase}/visual-aids/file/${encodeURIComponent(value)}`;
  }
}
