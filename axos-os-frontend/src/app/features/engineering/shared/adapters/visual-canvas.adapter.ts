import * as fabric from 'fabric';
import { EditorTool } from '../models/engineering.models';

export class VisualCanvasAdapter {
  private canvas: any;

  constructor(canvasElement: HTMLCanvasElement) {
    this.canvas = new fabric.Canvas(canvasElement, {
      width: 800,
      height: 600,
      backgroundColor: '#1a1a1a',
      preserveObjectStacking: true
    });
  }

  getFabricCanvas(): any {
    return this.canvas;
  }

  setTool(tool: EditorTool) {
    this.canvas.isDrawingMode = (tool === 'PATH');
    
    // Set selection based on tool
    this.canvas.selection = (tool === 'SELECT');
    this.canvas.forEachObject((obj: any) => {
      obj.selectable = (tool === 'SELECT');
    });
  }

  addRect() {
    const rect = new fabric.Rect({
      left: 100,
      top: 100,
      fill: 'transparent',
      stroke: '#00ffcc',
      strokeWidth: 2,
      width: 100,
      height: 100
    });
    this.canvas.add(rect);
    this.canvas.setActiveObject(rect);
  }

  addCircle() {
    const circle = new fabric.Circle({
      left: 150,
      top: 150,
      fill: 'transparent',
      stroke: '#ff00cc',
      strokeWidth: 2,
      radius: 50
    });
    this.canvas.add(circle);
    this.canvas.setActiveObject(circle);
  }

  addText(text: string = 'Double click to edit') {
    const iText = new fabric.IText(text, {
      left: 200,
      top: 200,
      fill: '#ffffff',
      fontSize: 20,
      fontFamily: 'Inter'
    });
    this.canvas.add(iText);
  }

  addLine() {
    const line = new fabric.Line([50, 50, 200, 200], {
      stroke: '#ffffff',
      strokeWidth: 2
    });
    this.canvas.add(line);
  }

  serialize(): any {
    return this.canvas.toJSON();
  }

  load(json: any) {
    this.canvas.loadFromJSON(json, () => {
      this.canvas.renderAll();
    });
  }

  dispose() {
    this.canvas.dispose();
  }

  resize(width: number, height: number) {
    this.canvas.setDimensions({ width, height });
    this.canvas.renderAll();
  }
}
