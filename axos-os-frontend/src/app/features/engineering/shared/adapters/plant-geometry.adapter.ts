import * as makerjs from 'makerjs';

export class PlantGeometryAdapter {
  // Maker.js uses a model structure: { paths: {}, models: {} }
  private model: makerjs.IModel;

  constructor() {
    this.model = {
      paths: {},
      models: {}
    };
  }

  addFootprint(id: string, width: number, height: number, x: number = 0, y: number = 0) {
    const rect = new makerjs.models.Rectangle(width, height);
    rect.origin = [x, y];
    this.model.models![id] = rect;
  }

  addLine(id: string, p1: [number, number], p2: [number, number]) {
    this.model.paths![id] = new makerjs.paths.Line(p1, p2);
  }

  serialize(): any {
    return this.model;
  }

  load(data: any) {
    this.model = data;
  }

  /**
   * Generates SVG path data for rendering in a light SVG-based view
   */
  renderToSvg(): string {
    return makerjs.exporter.toSVG(this.model);
  }

  /**
   * Helper to convert to a more interactive JSON format if needed
   */
  exportToObjects(): any[] {
    const objects: any[] = [];
    // Flatten logic could go here
    return objects;
  }
}
