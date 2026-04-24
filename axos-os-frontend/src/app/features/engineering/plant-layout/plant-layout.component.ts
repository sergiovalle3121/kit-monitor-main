import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EngineeringStateService } from '../shared/services/engineering-state.service';
import { PlantGeometryAdapter } from '../shared/adapters/plant-geometry.adapter';
import { EditorTool } from '../shared/models/engineering.models';

@Component({
  selector: 'app-plant-layout-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './plant-layout.component.html',
  styleUrls: ['../visual-aids/visual-aids.component.css'] // Reuse styles for foundation
})
export class PlantLayoutComponent implements OnInit {
  private state = inject(EngineeringStateService);
  private adapter = new PlantGeometryAdapter();

  // Reactive State
  currentDoc = this.state.currentDocument;
  activeTool = this.state.activeTool;
  
  svgContent: string = '';

  ngOnInit() {
    this.state.setDocument({
      name: 'Nuevo Plant Layout',
      documentType: 'PLANT_LAYOUT',
      schemaVersion: 1,
      scope: {},
      viewport: { zoom: 1, x: 0, y: 0 },
      units: 'mm',
      content: { layers: [] }
    });
    this.updatePreview();
  }

  setTool(tool: EditorTool) {
    this.state.setTool(tool);
  }

  addFootprint() {
    const id = `footprint-${Date.now()}`;
    this.adapter.addFootprint(id, 200, 150, Math.random() * 500, Math.random() * 500);
    this.updatePreview();
    this.state.markModified();
  }

  updatePreview() {
    this.svgContent = this.adapter.renderToSvg();
  }

  save() {
    const doc = this.currentDoc();
    if (!doc) return;
    
    const updated = {
      ...doc,
      content: this.adapter.serialize()
    };
    console.log('Saving Plant Layout:', updated);
    this.state.setDocument(updated);
  }
}
