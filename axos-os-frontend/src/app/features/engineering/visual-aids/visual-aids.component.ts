import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EngineeringStateService } from '../shared/services/engineering-state.service';
import { VisualCanvasAdapter } from '../shared/adapters/visual-canvas.adapter';
import { EngineeringDocument, EditorTool } from '../shared/models/engineering.models';
import { ApiService } from '../../../core/api.service';

@Component({
  selector: 'app-visual-aids-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './visual-aids.component.html',
  styleUrls: ['./visual-aids.component.css']
})
export class VisualAidsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;
  
  private state = inject(EngineeringStateService);
  private api = inject(ApiService);
  private adapter?: VisualCanvasAdapter;

  // Reactive State for Template
  currentDoc = this.state.currentDocument;
  activeTool = this.state.activeTool;
  isModified = this.state.isModified;
  
  selectedObject = signal<any>(null);
  
  ngOnInit() {
    if (!this.currentDoc()) {
      this.state.setDocument({
        name: 'Nuevo Visual Aid',
        documentType: 'VISUAL_AID',
        schemaVersion: 1,
        scope: {},
        viewport: { zoom: 1, x: 0, y: 0 },
        units: 'px',
        content: { layers: [{ id: 'main', name: 'Base Layer', visible: true, locked: false, opacity: 1 }] }
      });
    }
  }

  ngAfterViewInit() {
    this.adapter = new VisualCanvasAdapter(this.canvasElement.nativeElement);
    
    const canvas = this.adapter.getFabricCanvas();
    
    canvas.on('object:modified', () => this.syncSelection());
    canvas.on('object:added', () => this.syncSelection());
    canvas.on('selection:created', () => this.syncSelection());
    canvas.on('selection:updated', () => this.syncSelection());
    canvas.on('selection:cleared', () => this.syncSelection());
    
    // Initial Load
    const doc = this.currentDoc();
    if (doc?.content?.objects) {
      this.adapter.load(doc.content);
    }
  }

  syncSelection() {
    this.state.markModified();
    const active = this.adapter?.getFabricCanvas().getActiveObject();
    this.selectedObject.set(active ? {
      type: active.type,
      fill: active.get('fill'),
      stroke: active.get('stroke'),
      strokeWidth: active.get('strokeWidth'),
      opacity: active.get('opacity'),
      fontSize: active.get('fontSize'),
      fontFamily: active.get('fontFamily'),
    } : null);
  }

  ngOnDestroy() {
    this.adapter?.dispose();
  }

  setTool(tool: EditorTool) {
    this.state.setTool(tool);
    this.adapter?.setTool(tool);
  }

  addRect() { this.adapter?.addRect(); }
  addCircle() { this.adapter?.addCircle(); }
  addText() { this.adapter?.addText(); }
  addLine() { this.adapter?.addLine(); }

  onImageUpload(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.adapter?.addImage(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  }

  updateProperty(prop: string, value: any) {
    this.adapter?.updateProperty(prop, value);
    this.syncSelection();
  }

  deleteSelected() {
    this.adapter?.deleteSelected();
  }

  save() {
    const doc = this.currentDoc();
    if (!doc || !this.adapter) return;

    const updatedDoc: EngineeringDocument = {
      ...doc,
      content: this.adapter.serialize(),
      viewport: {
        zoom: this.adapter.getZoom(),
        x: 0,
        y: 0
      }
    };

    const saveObs = doc.id 
      ? this.api.updateEngineeringDocument(doc.id, updatedDoc)
      : this.api.createEngineeringDocument(updatedDoc);

    saveObs.subscribe({
      next: (saved) => {
        console.log('Document saved successfully:', saved);
        this.state.setDocument(saved);
        this.state.clearModified();
        alert('Visual Aid guardado correctamente.');
      },
      error: (err) => {
        console.error('Error saving document:', err);
        alert('Error al guardar el Visual Aid. Verifica la conexión con el servidor.');
      }
    });
  }
}

