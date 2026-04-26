import * as fabric from 'fabric';
import { EditorTool } from '../models/engineering.models';

export class VisualCanvasAdapter {
  private canvas: fabric.Canvas;

  constructor(canvasElement: HTMLCanvasElement) {
    this.canvas = new fabric.Canvas(canvasElement, {
      width: 1200,
      height: 800,
      backgroundColor: '#f8f9fa',
      preserveObjectStacking: true,
      stopContextMenu: true,
      fireRightClick: true
    });
    
    this.setupGrid();
  }

  private setupGrid() {
    // Optional: Add a subtle grid
    const gridSize = 20;
    // Implementation of grid if needed
  }

  getFabricCanvas(): fabric.Canvas {
    return this.canvas;
  }

  setTool(tool: EditorTool) {
    this.canvas.isDrawingMode = (tool === 'PATH');
    this.canvas.selection = (tool === 'SELECT');
    
    this.canvas.forEachObject((obj) => {
      obj.selectable = (tool === 'SELECT');
      obj.evented = (tool === 'SELECT');
    });
    
    if (tool === 'PATH') {
      this.canvas.freeDrawingBrush = new fabric.PencilBrush(this.canvas);
      this.canvas.freeDrawingBrush.width = 3;
      this.canvas.freeDrawingBrush.color = '#000000';
    }
  }

  addRect() {
    const rect = new fabric.Rect({
      left: 100,
      top: 100,
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 2,
      width: 200,
      height: 150,
      rx: 8,
      ry: 8,
      shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.1)', blur: 10, offsetX: 5, offsetY: 5 })
    });
    this.canvas.add(rect);
    this.canvas.setActiveObject(rect);
    this.canvas.renderAll();
  }

  addCircle() {
    const circle = new fabric.Circle({
      left: 150,
      top: 150,
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 2,
      radius: 60,
      shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.1)', blur: 10, offsetX: 5, offsetY: 5 })
    });
    this.canvas.add(circle);
    this.canvas.setActiveObject(circle);
    this.canvas.renderAll();
  }

  addText(text: string = 'Nuevo Texto') {
    const iText = new fabric.IText(text, {
      left: 200,
      top: 200,
      fill: '#1a1a1a',
      fontSize: 24,
      fontFamily: 'Inter, system-ui, sans-serif',
      fontWeight: '500'
    });
    this.canvas.add(iText);
    this.canvas.setActiveObject(iText);
    this.canvas.renderAll();
  }

  addLine() {
    const line = new fabric.Line([50, 50, 250, 50], {
      stroke: '#1a1a1a',
      strokeWidth: 3,
      left: 100,
      top: 100
    });
    this.canvas.add(line);
    this.canvas.setActiveObject(line);
    this.canvas.renderAll();
  }

  async addImage(url: string) {
    const img = await fabric.FabricImage.fromURL(url);
    img.scaleToWidth(300);
    this.canvas.add(img);
    this.canvas.centerObject(img);
    this.canvas.setActiveObject(img);
    this.canvas.renderAll();
  }

  updateProperty(property: string, value: any) {
    const activeObject = this.canvas.getActiveObject();
    if (!activeObject) return;

    if (activeObject.type === 'activeSelection') {
      (activeObject as fabric.ActiveSelection).forEachObject((obj) => {
        obj.set(property as keyof fabric.Object, value);
      });
    } else {
      activeObject.set(property as keyof fabric.Object, value);
    }
    this.canvas.renderAll();
  }

  deleteSelected() {
    const activeObjects = this.canvas.getActiveObjects();
    this.canvas.discardActiveObject();
    activeObjects.forEach((obj) => {
      this.canvas.remove(obj);
    });
    this.canvas.renderAll();
  }

  bringToFront() {
    const activeObject = this.canvas.getActiveObject();
    if (activeObject) {
      this.canvas.bringObjectToFront(activeObject);
      this.canvas.renderAll();
    }
  }

  sendToBack() {
    const activeObject = this.canvas.getActiveObject();
    if (activeObject) {
      this.canvas.sendObjectToBack(activeObject);
      this.canvas.renderAll();
    }
  }

  serialize(): any {
    return this.canvas.toJSON();
  }

  async load(json: any) {
    await this.canvas.loadFromJSON(json);
    this.canvas.renderAll();
  }

  dispose() {
    this.canvas.dispose();
  }

  resize(width: number, height: number) {
    this.canvas.setDimensions({ width, height });
    this.canvas.renderAll();
  }

  getZoom(): number {
    return this.canvas.getZoom();
  }

  setZoom(value: number) {
    this.canvas.setZoom(value);
    this.canvas.renderAll();
  }
}

