import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, inject } from '@angular/core';
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
  
  ngOnInit() {
    // Initialize blank doc if none
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
    this.adapter.getFabricCanvas().on('object:modified', () => this.state.markModified());
    this.adapter.getFabricCanvas().on('object:added', () => this.state.markModified());
    
    // Initial Load if doc has content
    const doc = this.currentDoc();
    if (doc?.content?.objects) {
      this.adapter.load(doc.content);
    }
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

  save() {
    const doc = this.currentDoc();
    if (!doc || !this.adapter) return;

    const updatedDoc: EngineeringDocument = {
      ...doc,
      content: this.adapter.serialize(),
      viewport: {
        zoom: this.adapter.getFabricCanvas().getZoom(),
        x: 0,
        y: 0
      }
    };

    // Use existing Engineering backend endpoints (to be implemented/mapped in ApiService)
    console.log('Saving Visual Aid:', updatedDoc);
    this.state.setDocument(updatedDoc); // Mock success for foundation
  }
}
