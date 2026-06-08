/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Conectores anclados: una `Polyline` que une dos formas por sus puntos de
 * conexión más cercanos y se recalcula cuando las formas se mueven/escalan.
 * Guarda `conn = { from, to, arrow, x1,y1,x2,y2 }` (ids + extremos absolutos
 * para el export .pptx). Sin dependencias nuevas.
 */
import { Polyline } from 'fabric';

let _seq = 1;
export function ensureConnId(o: any): string {
  if (!o.connId) o.connId = `s${Date.now().toString(36)}_${_seq++}`;
  return o.connId;
}
export function isConnector(o: any): boolean { return !!o && o.type === 'polyline' && !!o.conn; }
function connectable(o: any): boolean { return !!o && !isConnector(o) && o.selectable !== false; }

type P = { x: number; y: number };
const mid = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);

/** Puntos de conexión (medios de las aristas) de una forma, en coords absolutas. */
export function edgeAnchors(o: any): P[] {
  try { o.setCoords(); } catch { /* noop */ }
  const c = o.getCoords ? o.getCoords() : null;
  if (!c || c.length < 4) { const p = o.getCenterPoint?.() || { x: o.left, y: o.top }; return [p, p, p, p]; }
  const [tl, tr, br, bl] = c;
  return [mid(tl, tr), mid(tr, br), mid(br, bl), mid(bl, tl)]; // t, r, b, l
}

/** Par de anclas (una en cada forma) más cercano entre sí. */
export function nearestAnchors(a: any, b: any): { p1: P; p2: P } {
  const A = edgeAnchors(a), B = edgeAnchors(b);
  let best = { p1: A[0], p2: B[0] }, bd = Infinity;
  for (const pa of A) for (const pb of B) { const d = dist(pa, pb); if (d < bd) { bd = d; best = { p1: pa, p2: pb }; } }
  return best;
}

function arrowPoints(p1: P, p2: P, arrow: boolean): P[] {
  if (!arrow) return [p1, p2];
  const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  const L = 13, spread = 0.42;
  const bl = { x: p2.x - L * Math.cos(ang - spread), y: p2.y - L * Math.sin(ang - spread) };
  const br = { x: p2.x - L * Math.cos(ang + spread), y: p2.y - L * Math.sin(ang + spread) };
  return [p1, p2, bl, p2, br];
}

/** Fija la geometría de un conector a partir de dos puntos absolutos. */
export function setConnectorGeometry(poly: any, p1: P, p2: P) {
  const arrow = !!poly.conn?.arrow;
  poly.points = arrowPoints(p1, p2, arrow);
  poly.setDimensions();
  poly.left = poly.pathOffset.x;
  poly.top = poly.pathOffset.y;
  poly.setCoords();
  poly.conn = { ...poly.conn, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}

export function makeConnector(a: any, b: any, arrow: boolean, stroke: string): any {
  const idA = ensureConnId(a), idB = ensureConnId(b);
  const { p1, p2 } = nearestAnchors(a, b);
  const poly = new Polyline([p1, p2], {
    stroke, strokeWidth: 2.5, fill: '', strokeLineCap: 'round', strokeLineJoin: 'round',
    objectCaching: false, perPixelTargetFind: true, lockMovementX: true, lockMovementY: true, hasControls: false,
  } as any);
  (poly as any).conn = { from: idA, to: idB, arrow };
  setConnectorGeometry(poly, p1, p2);
  return poly;
}

function findById(canvas: any, id: string): any { return canvas.getObjects().find((o: any) => o.connId === id); }

/** Recalcula todos los conectores; elimina los que perdieron una forma. */
export function refreshConnectors(canvas: any) {
  for (const o of canvas.getObjects().slice()) {
    if (!isConnector(o)) continue;
    const a = findById(canvas, o.conn.from), b = findById(canvas, o.conn.to);
    if (!a || !b) { canvas.remove(o); continue; }
    const { p1, p2 } = nearestAnchors(a, b);
    setConnectorGeometry(o, p1, p2);
  }
}

/** ¿Hay al menos dos formas conectables seleccionadas? */
export function pickTwo(sel: any): [any, any] | null {
  const objs = sel?._objects || (sel ? [sel] : []);
  const shapes = objs.filter(connectable);
  if (shapes.length < 2) return null;
  return [shapes[0], shapes[1]];
}
