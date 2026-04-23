import { CommonModule } from '@angular/common';
import { CdkDragEnd, DragDropModule } from '@angular/cdk/drag-drop';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import html2canvas from 'html2canvas';
import { environment } from '../../../environments/environment';
import { ApiService } from '../../core/api.service';
import { VisualAid } from '../../core/ie-data.models';
import { VisualAidsService } from '../../core/visual-aids.service';
import { ConfirmModalService } from '../../shared/confirm-modal/confirm-modal.service';
import { EnterpriseContextBannerComponent } from '../../shared/enterprise-context-banner/enterprise-context-banner.component';

type ElementType = 'text' | 'arrow' | 'image' | 'badge' | 'box';

interface SlideElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize?: number;
  color?: string;
  content?: string;
  background?: string;
  borderColor?: string;
  imageUrl?: string;
}

interface SlidePage {
  id: string;
  name: string;
  background: string;
  elements: SlideElement[];
}

interface TemplatePreset {
  id: string;
  name: string;
  description: string;
  background: string;
  elements: Omit<SlideElement, 'id'>[];
}

@Component({
  selector: 'app-visual-aids',
  standalone: true,
  imports: [EnterpriseContextBannerComponent, CommonModule, FormsModule, DragDropModule],
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
  creationMode: 'upload' | 'canvas' = 'upload';
  formError: string | null = null;
  fileName = '';
  selectedPdfFile: File | null = null;
  imagePreviewUrl: string | null = null;
  isImage = false;
  modelSuggestions: string[] = [];
  annotations: Array<{ x: number; y: number; text: string }> = [];

  editorOpen = false;
  zoom = 100;
  selectedTemplateId = 'assembly';
  selectedElementId: string | null = null;
  selectedPageId = '';
  pages: SlidePage[] = [];

  readonly templates: TemplatePreset[] = [
    {
      id: 'assembly',
      name: 'Guía de ensamble',
      description: 'Paso a paso con foto principal, lista de materiales y validación.',
      background: '#ffffff',
      elements: [
        { type: 'box', x: 16, y: 16, width: 1248, height: 96, background: '#e0ecff', borderColor: '#1d4ed8' },
        { type: 'text', x: 32, y: 36, fontSize: 36, color: '#0f172a', content: 'AYUDA VISUAL - ENSAMBLE' },
        { type: 'text', x: 34, y: 78, fontSize: 20, color: '#334155', content: 'Producto: ______  |  Estación: ______  |  Rev: ____' },
        { type: 'box', x: 32, y: 132, width: 780, height: 480, background: '#f8fafc', borderColor: '#94a3b8' },
        { type: 'text', x: 48, y: 148, fontSize: 22, color: '#0f172a', content: 'Foto / Diagrama principal' },
        { type: 'box', x: 836, y: 132, width: 412, height: 300, background: '#f8fafc', borderColor: '#94a3b8' },
        { type: 'text', x: 852, y: 150, fontSize: 22, color: '#0f172a', content: 'Materiales requeridos' },
        { type: 'text', x: 854, y: 194, fontSize: 18, color: '#334155', content: '1. Tornillo M4 x 12\n2. Arandela plana\n3. Bracket soporte' },
        { type: 'badge', x: 836, y: 450, width: 412, height: 162, background: '#ecfccb', borderColor: '#65a30d', content: 'Punto de control de calidad\n☐ Torque verificado\n☐ Polaridad OK' },
        { type: 'arrow', x: 770, y: 280, fontSize: 56, color: '#dc2626', content: '➡' },
      ],
    },
    {
      id: 'process',
      name: 'Flujo de proceso',
      description: 'Plantilla para secuencia operativa y tiempos objetivo.',
      background: '#f8fafc',
      elements: [
        { type: 'text', x: 36, y: 26, fontSize: 34, color: '#0f172a', content: 'SECUENCIA DE PROCESO' },
        { type: 'badge', x: 36, y: 88, width: 280, height: 84, background: '#e0f2fe', borderColor: '#0284c7', content: 'CT objetivo: ____ seg' },
        { type: 'badge', x: 352, y: 88, width: 280, height: 84, background: '#dcfce7', borderColor: '#16a34a', content: 'Operador: ______' },
        { type: 'badge', x: 668, y: 88, width: 280, height: 84, background: '#fef3c7', borderColor: '#d97706', content: 'Herramienta: ______' },
        { type: 'box', x: 38, y: 204, width: 1190, height: 460, background: '#ffffff', borderColor: '#cbd5e1' },
        { type: 'text', x: 68, y: 246, fontSize: 22, color: '#1e293b', content: 'Paso 1:' },
        { type: 'text', x: 68, y: 306, fontSize: 22, color: '#1e293b', content: 'Paso 2:' },
        { type: 'text', x: 68, y: 366, fontSize: 22, color: '#1e293b', content: 'Paso 3:' },
      ],
    },
  ];

  @ViewChild('slideCanvas') slideCanvas?: ElementRef<HTMLElement>;
  @ViewChild('exportCanvas') exportCanvas?: ElementRef<HTMLElement>;

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

  setCreationMode(mode: 'upload' | 'canvas'): void {
    this.creationMode = mode;
    if (mode === 'canvas' && !this.pages.length) {
      this.applyTemplate();
    }
  }

  openProfessionalEditor(): void {
    this.setCreationMode('canvas');
    this.editorOpen = true;
    if (!this.pages.length) this.applyTemplate();
  }

  closeProfessionalEditor(): void {
    this.editorOpen = false;
  }

  applyTemplate(): void {
    const template = this.templates.find((item) => item.id === this.selectedTemplateId) ?? this.templates[0];
    const firstPage: SlidePage = {
      id: this.uid('page'),
      name: 'Hoja 1',
      background: template.background,
      elements: template.elements.map((element) => ({ ...element, id: this.uid('el') })),
    };

    this.pages = [firstPage];
    this.selectedPageId = firstPage.id;
    this.selectedElementId = null;
  }

  addPage(blank = true): void {
    const basePage = this.currentPage();
    const page: SlidePage = {
      id: this.uid('page'),
      name: `Hoja ${this.pages.length + 1}`,
      background: blank ? '#ffffff' : (basePage?.background ?? '#ffffff'),
      elements: blank ? [] : (basePage?.elements ?? []).map((element) => ({ ...element, id: this.uid('el'), x: element.x + 24, y: element.y + 24 })),
    };
    this.pages.push(page);
    this.selectedPageId = page.id;
    this.selectedElementId = null;
  }

  removeCurrentPage(): void {
    if (this.pages.length <= 1) return;
    this.pages = this.pages.filter((page) => page.id !== this.selectedPageId);
    this.selectedPageId = this.pages[0]?.id ?? '';
    this.selectedElementId = null;
  }

  selectPage(pageId: string): void {
    this.selectedPageId = pageId;
    this.selectedElementId = null;
  }

  addElement(type: ElementType): void {
    const page = this.currentPage();
    if (!page) return;

    const base: SlideElement = {
      id: this.uid('el'),
      type,
      x: 90,
      y: 90,
      width: 280,
      height: 120,
      fontSize: 22,
      color: '#0f172a',
      content: 'Texto editable',
      background: '#ffffff',
      borderColor: '#94a3b8',
    };

    const mapByType: Record<ElementType, Partial<SlideElement>> = {
      text: { content: 'Nuevo texto', width: 320, height: 64, background: 'transparent', borderColor: 'transparent' },
      arrow: { content: '➡', fontSize: 56, color: '#dc2626', width: 80, height: 80, background: 'transparent', borderColor: 'transparent' },
      image: { imageUrl: '', content: 'Cargar imagen', width: 360, height: 240, background: '#f8fafc' },
      badge: { content: 'Etiqueta / Nota', width: 340, height: 120, background: '#fef3c7', borderColor: '#d97706' },
      box: { content: '', width: 420, height: 220, background: '#ffffff', borderColor: '#94a3b8' },
    };

    const item = { ...base, ...mapByType[type], type };
    page.elements.push(item);
    this.selectedElementId = item.id;
  }

  removeSelectedElement(): void {
    const page = this.currentPage();
    if (!page || !this.selectedElementId) return;
    page.elements = page.elements.filter((el) => el.id !== this.selectedElementId);
    this.selectedElementId = null;
  }

  selectElement(event: MouseEvent, elementId: string): void {
    event.stopPropagation();
    this.selectedElementId = elementId;
  }

  clearSelection(): void {
    this.selectedElementId = null;
  }

  onDragEnd(event: CdkDragEnd, element: SlideElement): void {
    const position = event.source.getFreeDragPosition();
    element.x = position.x;
    element.y = position.y;
  }

  updateElementContent(event: Event, element: SlideElement): void {
    element.content = (event.target as HTMLElement).innerText;
  }


  zoomOut(): void {
    this.zoom = Math.max(60, this.zoom - 10);
  }

  zoomIn(): void {
    this.zoom = Math.min(140, this.zoom + 10);
  }

  onEditorImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const element = this.selectedElement();
    if (!element || element.type !== 'image') return;

    const reader = new FileReader();
    reader.onload = (e) => {
      element.imageUrl = String(e.target?.result ?? '');
      element.content = '';
      input.value = '';
    };
    reader.readAsDataURL(file);
  }

  async save(): Promise<void> {
    if (!this.form.model || !this.form.title || !this.form.process) {
      this.formError = 'Modelo, título y proceso son obligatorios.';
      return;
    }

    let finalFile = this.selectedPdfFile;

    if (this.creationMode === 'canvas') {
      this.formError = 'Generando diseño en PNG...';
      const exportContainer = this.exportCanvas?.nativeElement;
      if (!exportContainer) {
        this.formError = 'No se pudo preparar la exportación del editor.';
        return;
      }

      try {
        const canvas = await html2canvas(exportContainer, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('No se generó imagen');
        finalFile = new File([blob], 'visual-aid-diseno.png', { type: 'image/png' });
      } catch {
        this.formError = 'Error al exportar el diseño.';
        return;
      }
    }

    if (!finalFile) {
      this.formError = 'Debes subir un archivo o diseñar algo en el editor.';
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
    }, finalFile).subscribe({
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
        this.pages = [];
        this.selectedElementId = null;
        this.selectedPageId = '';
        this.creationMode = 'upload';
        this.editorOpen = false;
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

  currentPage(): SlidePage | undefined {
    return this.pages.find((page) => page.id === this.selectedPageId) ?? this.pages[0];
  }

  selectedElement(): SlideElement | undefined {
    const page = this.currentPage();
    return page?.elements.find((el) => el.id === this.selectedElementId);
  }

  trackByPage(_: number, page: SlidePage): string {
    return page.id;
  }

  trackByElement(_: number, element: SlideElement): string {
    return element.id;
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

  private uid(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
