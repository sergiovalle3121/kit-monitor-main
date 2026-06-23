/* eslint-disable @typescript-eslint/no-explicit-any */
/** Geometría + fidelidad de export de formas. npx tsx src/components/office/slides/shapes.spec.ts */
import PptxGenJS from 'pptxgenjs';
import {
  starPoints, regularPolygon, POLY_SHAPES, SHAPE_LIBRARY, isPolyShape, isPathShape,
} from './shapes';
import { HINT_TO_PRESET, presetFor } from '@/lib/office/pptx';

let passed = 0; const fails: string[] = [];
const ok = (cond: boolean, m: string) => { if (cond) passed++; else fails.push(m); };
const near = (a: number, b: number, t = 1e-9) => Math.abs(a - b) < t;

// ── Geometría ──
{ const p = regularPolygon(4, 50); ok(p.length === 4, 'regularPolygon(4) → 4 vértices');
  ok(near(p[0].x, 50) && near(p[0].y, 0, 1e-6), 'primer vértice arriba (50,0)'); }
{ const p = regularPolygon(6, 50); ok(p.length === 6, 'regularPolygon(6) → 6 vértices'); }
{ const s = starPoints(5, 50, 20); ok(s.length === 10, 'starPoints(5) → 10 puntos (punta+valle)');
  // radios alternos: pares = externo (50), impares = interno (20), medidos desde el centro (50,50).
  const r0 = Math.hypot(s[0].x - 50, s[0].y - 50); const r1 = Math.hypot(s[1].x - 50, s[1].y - 50);
  ok(near(r0, 50, 1e-6), 'punta a radio externo'); ok(near(r1, 20, 1e-6), 'valle a radio interno'); }

// Todas las formas caben en su caja (poly ~100×100; path según w/h).
for (const [kind, pts] of Object.entries(POLY_SHAPES)) {
  const xs = pts.map((p) => p.x); const ys = pts.map((p) => p.y);
  ok(Math.min(...xs) >= -0.001 && Math.max(...xs) <= 100.001, `${kind}: x dentro de [0,100]`);
  ok(Math.min(...ys) >= -0.001 && Math.max(...ys) <= 100.001, `${kind}: y dentro de [0,100]`);
  ok(pts.length >= 3, `${kind}: ≥3 vértices`);
}

// ── GOLDEN: toda forma de la galería exporta a un preset NATIVO de PowerPoint ──
// (si presetFor() devolviera undefined, el export caería a un rectángulo → pérdida de fidelidad).
const pptx: any = new PptxGenJS(); const ST: any = pptx.ShapeType;
const galleryKinds = SHAPE_LIBRARY.flatMap((c) => c.shapes.map((s) => s.kind));
// Incluye también las formas de inserción rápida del editor.
const quickKinds = ['star5', 'rightArrow', 'diamond'];
for (const kind of new Set([...galleryKinds, ...quickKinds])) {
  ok(isPolyShape(kind) || isPathShape(kind), `${kind}: definido en POLY o PATH`);
  ok(HINT_TO_PRESET[kind] !== undefined, `${kind}: tiene mapeo a preset`);
  ok(presetFor(kind, ST) !== undefined, `${kind}: preset existe en PptxGenJS (sin caer a rectángulo)`);
}

// Las nuevas formas están en la galería.
ok(galleryKinds.includes('diamond'), 'galería incluye rombo');
ok(galleryKinds.includes('rightArrow'), 'galería incluye flecha derecha');
ok(galleryKinds.includes('star5'), 'galería incluye estrella 5');

// Sin duplicados de kind en la galería.
ok(new Set(galleryKinds).size === galleryKinds.length, 'sin kinds duplicados en la galería');

if (fails.length) { console.log(`❌ ${passed}/${passed + fails.length}`); for (const f of fails) console.log('  - ' + f); process.exit(1); }
else console.log(`✅ ${passed}/${passed}`);
