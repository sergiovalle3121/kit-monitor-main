import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EngineeringStateService } from '../shared/services/engineering-state.service';
import { VisualCanvasAdapter } from '../shared/adapters/visual-canvas.adapter';
import { EditorTool } from '../shared/models/engineering.models';

@Component({
  selector: 'app-plant-layout-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './plant-layout.component.html',
  styleUrls: ['./plant-layout.component.css']
})
export class PlantLayoutComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

  private state = inject(EngineeringStateService);
  private adapter?: VisualCanvasAdapter;

  // Reactive State
  currentDoc = this.state.currentDocument;
  activeTool = this.state.activeTool;
  isModified = this.state.isModified;
  
  selectedObject = signal<any>(null);
  snapToGrid = signal<boolean>(true);
  showGrid = signal<boolean>(true);

  ngOnInit() {
    this.state.setDocument({
      name: 'Nuevo Plant Layout',
      documentType: 'PLANT_LAYOUT',
      schemaVersion: 1,
      scope: {},
      viewport: { zoom: 1, x: 0, y: 0 },
      units: 'mm',
      content: { layers: [
        { id: 'floor', name: 'Planta / Suelo', visible: true, locked: false, opacity: 1 },
        { id: 'machinery', name: 'Maquinaria', visible: true, locked: false, opacity: 1 },
        { id: 'utilities', name: 'Servicios', visible: true, locked: false, opacity: 1 }
      ] }
    });
  }

  ngAfterViewInit() {
    this.adapter = new VisualCanvasAdapter(this.canvasElement.nativeElement);
    const canvas = this.adapter.getFabricCanvas();
    
    // CAD Theme
    canvas.set({
      backgroundColor: '#1a1a1a',
      selectionColor: 'rgba(0, 255, 204, 0.1)',
      selectionBorderColor: '#00ffcc',
      selectionLineWidth: 1
    });

    canvas.on('object:moving', (options) => {
      if (this.snapToGrid()) {
        const gridSize = 20;
        options.target.set({
          left: Math.round(options.target.left / gridSize) * gridSize,
          top: Math.round(options.target.top / gridSize) * gridSize
        });
      }
      this.syncSelection();
    });

    canvas.on('selection:created', () => this.syncSelection());
    canvas.on('selection:updated', () => this.syncSelection());
    canvas.on('selection:cleared', () => this.syncSelection());
    
    this.drawGrid();
  }

  drawGrid() {
    // Grid rendering logic could be complex in Fabric, 
    // for now we'll use a pattern or just CSS background
  }

  syncSelection() {
    this.state.markModified();
    const active = this.adapter?.getFabricCanvas().getActiveObject();
    this.selectedObject.set(active ? {
      type: active.type,
      left: Math.round(active.left),
      top: Math.round(active.top),
      width: Math.round(active.width * active.scaleX),
      height: Math.round(active.height * active.scaleY),
      angle: Math.round(active.angle)
    } : null);
  }

  ngOnDestroy() {
    this.adapter?.dispose();
  }

  setTool(tool: EditorTool) {
    this.state.setTool(tool);
    this.adapter?.setTool(tool);
  }

  addMachine(type: string) {
    // Add specialized machine footprint
    this.adapter?.addRect(); // Placeholder for specific machinery symbols
    const obj = this.adapter?.getFabricCanvas().getActiveObject();
    if (obj) {
      obj.set({
        fill: 'rgba(0, 255, 204, 0.2)',
        stroke: '#00ffcc',
        strokeWidth: 2
      });
      this.adapter?.getFabricCanvas().renderAll();
    }
  }

  addBay() {
    this.adapter?.addRect();
    const obj = this.adapter?.getFabricCanvas().getActiveObject();
    if (obj) {
      obj.set({
        fill: 'rgba(255, 255, 255, 0.05)',
        stroke: '#ffffff',
        strokeWidth: 1,
        strokeDashArray: [5, 5]
      });
      this.adapter?.getFabricCanvas().renderAll();
    }
  }

  save() {
    const doc = this.currentDoc();
    if (!doc || !this.adapter) return;
    
    const updated = {
      ...doc,
      content: this.adapter.serialize()
    };
    console.log('Saving Plant Layout:', updated);
    this.state.setDocument(updated);
  }
}

