/**
 * Biblioteca ampliada de formas para las diapositivas. Datos puros (sin
 * dependencias): cada forma es una lista de puntos (para `Polygon`) o una
 * cadena `d` SVG (para `Path`), normalizada a una caja ~100×100. El editor
 * (Fabric) las instancia; el exportador .pptx usa la pista `shape` para mapear
 * a una forma nativa de PowerPoint. Reutilizable por SmartArt y conectores.
 */

export type Pt = { x: number; y: number };

/** Estrella de n puntas centrada en (cx,cy) con radios externo/interno. */
export function starPoints(n: number, outer: number, inner: number, cx = outer, cy = outer): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / n - Math.PI / 2;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

/** Polígono regular de n lados. */
export function regularPolygon(n: number, r: number, cx = r, cy = r, rot = -Math.PI / 2): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i * 2 * Math.PI) / n;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

/** Formas basadas en polígonos (clave = pista para el export .pptx). */
export const POLY_SHAPES: Record<string, Pt[]> = {
  diamond: [{ x: 50, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 100 }, { x: 0, y: 50 }],
  rightArrow: [{ x: 0, y: 28 }, { x: 55, y: 28 }, { x: 55, y: 0 }, { x: 100, y: 50 }, { x: 55, y: 100 }, { x: 55, y: 72 }, { x: 0, y: 72 }],
  star5: starPoints(5, 50, 20),
  pentagon: regularPolygon(5, 50),
  hexagon: [{ x: 25, y: 0 }, { x: 75, y: 0 }, { x: 100, y: 50 }, { x: 75, y: 100 }, { x: 25, y: 100 }, { x: 0, y: 50 }],
  octagon: [{ x: 30, y: 0 }, { x: 70, y: 0 }, { x: 100, y: 30 }, { x: 100, y: 70 }, { x: 70, y: 100 }, { x: 30, y: 100 }, { x: 0, y: 70 }, { x: 0, y: 30 }],
  trapezoid: [{ x: 20, y: 0 }, { x: 80, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
  parallelogram: [{ x: 25, y: 0 }, { x: 100, y: 0 }, { x: 75, y: 100 }, { x: 0, y: 100 }],
  chevron: [{ x: 0, y: 0 }, { x: 70, y: 0 }, { x: 100, y: 50 }, { x: 70, y: 100 }, { x: 0, y: 100 }, { x: 30, y: 50 }],
  homePlate: [{ x: 0, y: 0 }, { x: 70, y: 0 }, { x: 100, y: 50 }, { x: 70, y: 100 }, { x: 0, y: 100 }],
  plus: [
    { x: 33, y: 0 }, { x: 67, y: 0 }, { x: 67, y: 33 }, { x: 100, y: 33 }, { x: 100, y: 67 },
    { x: 67, y: 67 }, { x: 67, y: 100 }, { x: 33, y: 100 }, { x: 33, y: 67 }, { x: 0, y: 67 },
    { x: 0, y: 33 }, { x: 33, y: 33 },
  ],
  leftArrow: [{ x: 0, y: 50 }, { x: 45, y: 0 }, { x: 45, y: 28 }, { x: 100, y: 28 }, { x: 100, y: 72 }, { x: 45, y: 72 }, { x: 45, y: 100 }],
  upArrow: [{ x: 50, y: 0 }, { x: 100, y: 50 }, { x: 72, y: 50 }, { x: 72, y: 100 }, { x: 28, y: 100 }, { x: 28, y: 50 }, { x: 0, y: 50 }],
  downArrow: [{ x: 28, y: 0 }, { x: 72, y: 0 }, { x: 72, y: 50 }, { x: 100, y: 50 }, { x: 50, y: 100 }, { x: 0, y: 50 }, { x: 28, y: 50 }],
  leftRightArrow: [
    { x: 0, y: 50 }, { x: 28, y: 18 }, { x: 28, y: 36 }, { x: 72, y: 36 }, { x: 72, y: 18 },
    { x: 100, y: 50 }, { x: 72, y: 82 }, { x: 72, y: 64 }, { x: 28, y: 64 }, { x: 28, y: 82 },
  ],
  star4: starPoints(4, 50, 20),
  star6: starPoints(6, 50, 25),
  lightningBolt: [{ x: 56, y: 0 }, { x: 20, y: 58 }, { x: 44, y: 58 }, { x: 30, y: 100 }, { x: 82, y: 38 }, { x: 54, y: 38 }, { x: 72, y: 0 }],
  ribbon: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 72 }, { x: 80, y: 56 }, { x: 50, y: 72 }, { x: 20, y: 56 }, { x: 0, y: 72 }],
};

/** Formas con curvas (Path SVG). La caja objetivo es ~100×100/×88. */
export const PATH_SHAPES: Record<string, { d: string; w: number; h: number; pptx?: string }> = {
  heart: {
    d: 'M50 88 C 12 60 0 38 18 22 C 32 10 46 18 50 30 C 54 18 68 10 82 22 C 100 38 88 60 50 88 Z',
    w: 100, h: 88, pptx: 'heart',
  },
  cloud: {
    d: 'M27 82 A19 19 0 0 1 24 45 A24 24 0 0 1 69 34 A18 18 0 0 1 85 57 A16 16 0 0 1 76 82 Z',
    w: 100, h: 92, pptx: 'cloud',
  },
  speech: {
    d: 'M10 6 H90 Q98 6 98 14 V56 Q98 64 90 64 H42 L24 86 L29 64 H10 Q2 64 2 56 V14 Q2 6 10 6 Z',
    w: 100, h: 90, pptx: 'wedgeRectCallout',
  },
  sun: {
    d: 'M50 18 L57 4 L64 18 L78 12 L76 27 L92 28 L82 40 L96 48 L82 56 L92 68 L76 69 L78 84 L64 78 L57 92 L50 78 L43 92 L36 78 L22 84 L24 69 L8 68 L18 56 L4 48 L18 40 L8 28 L24 27 L22 12 L36 18 L43 4 Z M50 36 A14 14 0 1 0 50.01 36 Z',
    w: 100, h: 96, pptx: 'sun',
  },
};

export interface ShapeDef { kind: string; label: string }
export interface ShapeCategory { label: string; shapes: ShapeDef[] }

/** Catálogo para la galería de formas del ribbon (agrupado). */
export const SHAPE_LIBRARY: ShapeCategory[] = [
  {
    label: 'Básicas',
    shapes: [
      { kind: 'diamond', label: 'Rombo' },
      { kind: 'pentagon', label: 'Pentágono' },
      { kind: 'hexagon', label: 'Hexágono' },
      { kind: 'octagon', label: 'Octágono' },
      { kind: 'trapezoid', label: 'Trapecio' },
      { kind: 'parallelogram', label: 'Paralelogramo' },
      { kind: 'plus', label: 'Cruz' },
    ],
  },
  {
    label: 'Flechas',
    shapes: [
      { kind: 'rightArrow', label: 'Flecha derecha' },
      { kind: 'leftArrow', label: 'Flecha izquierda' },
      { kind: 'upArrow', label: 'Flecha arriba' },
      { kind: 'downArrow', label: 'Flecha abajo' },
      { kind: 'leftRightArrow', label: 'Flecha doble' },
      { kind: 'chevron', label: 'Galón' },
      { kind: 'homePlate', label: 'Etiqueta' },
    ],
  },
  {
    label: 'Símbolos',
    shapes: [
      { kind: 'star4', label: 'Estrella 4' },
      { kind: 'star5', label: 'Estrella 5' },
      { kind: 'star6', label: 'Estrella 6' },
      { kind: 'lightningBolt', label: 'Rayo' },
      { kind: 'heart', label: 'Corazón' },
      { kind: 'sun', label: 'Sol' },
      { kind: 'ribbon', label: 'Cinta' },
    ],
  },
  {
    label: 'Llamadas',
    shapes: [
      { kind: 'speech', label: 'Bocadillo' },
      { kind: 'cloud', label: 'Nube' },
    ],
  },
];

export function isPolyShape(kind: string): boolean { return kind in POLY_SHAPES; }
export function isPathShape(kind: string): boolean { return kind in PATH_SHAPES; }
