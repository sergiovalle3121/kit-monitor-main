import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { ApiService } from '../../core/api.service';
import { VisualAid } from '../../core/ie-data.models';
import { VisualAidsService } from '../../core/visual-aids.service';
import { ConfirmModalService } from '../../shared/confirm-modal/confirm-modal.service';

interface VisualAidViewer {
  item: VisualAid;
  pdfUrl: string;
  currentPage: number;
  totalPages: number;
  loading: boolean;
}

@Component({
  selector: 'app-visual-aids',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './visual-aids.component.html',
  styleUrl: './visual-aids.component.css',
})
export class VisualAidsComponent implements OnInit, AfterViewChecked {
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
  private pdfDocument: any | null = null;
  private pdfjsLib: any | null = null;

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

  ngAfterViewChecked(): void {
    if (this.viewer && this.pdfDocument && !this.viewer.loading) {
      this.renderCurrentPage();
    }
  }

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
      pdfUrl: this.resolvePdfUrl(item.pdfUrl),
      currentPage: 1,
      totalPages: 0,
      loading: true,
    };
    this.loadPdfInCanvas();
  }

  openInNewTab(item: VisualAid): void {
    window.open(this.resolvePdfUrl(item.pdfUrl), '_blank', 'noopener');
  }

  previousPage(): void {
    if (!this.viewer || this.viewer.currentPage <= 1) return;
    this.viewer.currentPage -= 1;
    this.renderCurrentPage();
  }

  nextPage(): void {
    if (!this.viewer || this.viewer.currentPage >= this.viewer.totalPages) return;
    this.viewer.currentPage += 1;
    this.renderCurrentPage();
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

  private async loadPdfInCanvas(): Promise<void> {
    if (!this.viewer) return;
    try {
      const pdfjs = await this.ensurePdfJs();
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const loadingTask = pdfjs.getDocument(this.viewer.pdfUrl);
      this.pdfDocument = await loadingTask.promise;
      this.viewer.totalPages = this.pdfDocument.numPages;
      this.viewer.currentPage = 1;
      this.viewer.loading = false;
      this.renderCurrentPage();
    } catch {
      if (this.viewer) this.viewer.loading = false;
    }
  }

  private async ensurePdfJs(): Promise<any> {
    if ((window as any).pdfjsLib) {
      this.pdfjsLib = (window as any).pdfjsLib;
      return this.pdfjsLib;
    }

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('No se pudo cargar PDF.js'));
      document.body.appendChild(script);
    });

    this.pdfjsLib = (window as any).pdfjsLib;
    return this.pdfjsLib;
  }

  private async renderCurrentPage(): Promise<void> {
    if (!this.viewer || !this.pdfDocument) return;
    const canvas = document.getElementById('visual-aid-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    const page = await this.pdfDocument.getPage(this.viewer.currentPage);
    const viewport = page.getViewport({ scale: 1.25 });
    const context = canvas.getContext('2d');
    if (!context) return;
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport }).promise;
  }
}
