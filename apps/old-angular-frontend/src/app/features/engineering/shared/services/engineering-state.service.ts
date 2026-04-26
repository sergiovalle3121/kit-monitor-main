import { Injectable, signal, computed, inject } from '@angular/core';
import { EngineeringDocument, EditorTool } from '../models/engineering.models';
import { ApiService } from '../../../../core/api.service';

@Injectable({
  providedIn: 'root'
})
export class EngineeringStateService {
  private api = inject(ApiService);

  // Current active document
  currentDocument = signal<EngineeringDocument | null>(null);
  
  // Editor UI State
  activeTool = signal<EditorTool>('SELECT');
  isModified = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  selectionCount = signal<number>(0);
  
  // Viewport State
  zoom = signal<number>(1);
  panX = signal<number>(0);
  panY = signal<number>(0);

  // Computed
  canSave = computed(() => !!this.currentDocument() && this.isModified());

  setDocument(doc: EngineeringDocument) {
    this.currentDocument.set(doc);
    this.zoom.set(doc.viewport.zoom || 1);
    this.panX.set(doc.viewport.x || 0);
    this.panY.set(doc.viewport.y || 0);
    this.isModified.set(false);
  }

  setTool(tool: EditorTool) {
    this.activeTool.set(tool);
  }

  markModified() {
    this.isModified.set(true);
  }

  clearModified() {
    this.isModified.set(false);
  }

  updateViewport(zoom: number, x: number, y: number) {
    this.zoom.set(zoom);
    this.panX.set(x);
    this.panY.set(y);
  }
}
