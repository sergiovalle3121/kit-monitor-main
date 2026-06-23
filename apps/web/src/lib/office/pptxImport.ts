/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Import a .pptx (OOXML) into an AXOS deck (the Fabric-based JSON the slides
 * editor consumes). Round-trip de la Fase 2 + fidelidad de archivos FORÁNEOS
 * (Fase 5): resuelve el TEMA real (`theme1.xml` → schemeClr a hex, con
 * modificadores lum/tint/shade y el clrMap del patrón), HEREDA la geometría de
 * los marcadores desde el layout/patrón (antes se perdían los títulos/cuerpos
 * sin xfrm) y lee colores por REFERENCIA de estilo (fillRef/lnRef).
 *
 * Cobertura: tamaño/relación, fondo (sólido + heredado/bgRef), cuadros de texto
 * (viñetas e indentado), imágenes, autoformas (prstGeom → pista de forma),
 * líneas, tablas (a:tbl) y gráficos (c:chart) reconstruidos con los builders del
 * editor. SmartArt entra como formas sueltas. Solo navegador: usa DOMParser,
 * decodifica imágenes y reutiliza Fabric; se importa bajo demanda.
 */
import { Rect, Ellipse, Triangle, Polygon, Path, FabricImage } from 'fabric';
import { buildTableGroup, type TableSpec } from '@/components/office/slides/table';
import { buildChartGroup, type ChartSpec, type ChartType } from '@/components/office/slides/chart';
import { POLY_SHAPES, PATH_SHAPES, starPoints } from '@/components/office/slides/shapes';
import { slideHeight } from '@/components/office/slideAssets';

const EMU_PER_PX = 9525; // 914400 EMU/in ÷ 96 px/in
const px = (v: any): number => (Number(v) || 0) / EMU_PER_PX;

// Fabric v7 serializa `type` en PascalCase (Rect/Group/Image…), pero el editor
// y el export usan minúsculas (o.type === 'rect'/'group'/…). Normalizamos para
// que los objetos importados se comporten igual que los nativos.
function normType(o: any): any {
  if (o && typeof o === 'object') {
    if (typeof o.type === 'string') o.type = o.type.toLowerCase();
    if (Array.isArray(o.objects)) o.objects.forEach(normType);
  }
  return o;
}

// ── helpers de XML (sin depender de prefijos de namespace) ──────────────────
function parseXml(s: string): Document { return new DOMParser().parseFromString(s, 'application/xml'); }
function tags(el: Element | Document, local: string): Element[] {
  return Array.from((el as any).getElementsByTagNameNS('*', local)) as Element[];
}
function firstTag(el: Element | Document | null, local: string): Element | null {
  if (!el) return null;
  const r = (el as any).getElementsByTagNameNS('*', local);
  return r.length ? (r[0] as Element) : null;
}
function childTags(el: Element | null, local: string): Element[] {
  return el ? Array.from(el.children).filter((c) => c.localName === local) : [];
}
function firstChild(el: Element | null, local: string): Element | null {
  return el ? (Array.from(el.children).find((c) => c.localName === local) as Element) || null : null;
}
function attr(el: Element | null, name: string): string | null { return el ? el.getAttribute(name) : null; }
function attrNS(el: Element | null, local: string): string | null {
  if (!el) return null;
  for (const a of Array.from(el.attributes)) if (a.localName === local) return a.value;
  return null;
}

// prst de PowerPoint → pista de forma de AXOS (inverso de pptx.ts).
const PRESET_TO_HINT: Record<string, string> = {
  star4: 'star4', star5: 'star5', star6: 'star6',
  rightArrow: 'rightArrow', leftArrow: 'leftArrow', upArrow: 'upArrow', downArrow: 'downArrow', leftRightArrow: 'leftRightArrow',
  diamond: 'diamond', pentagon: 'pentagon', hexagon: 'hexagon', octagon: 'octagon',
  trapezoid: 'trapezoid', parallelogram: 'parallelogram', chevron: 'chevron', homePlate: 'homePlate',
  plus: 'plus', mathPlus: 'plus', lightningBolt: 'lightningBolt', ribbon2: 'ribbon', ribbon: 'ribbon',
  heart: 'heart', cloud: 'cloud', sun: 'sun', wedgeRectCallout: 'speech',
};
// Colores de esquema por defecto (fallback si NO se resuelve el tema real).
const SCHEME_FALLBACK: Record<string, string> = {
  tx1: '#111827', dk1: '#111827', dk2: '#1f2937', tx2: '#1f2937',
  bg1: '#ffffff', lt1: '#ffffff', bg2: '#f1f5f9', lt2: '#f1f5f9',
  accent1: '#2563eb', accent2: '#10b981', accent3: '#f59e0b', accent4: '#ef4444',
  accent5: '#7c3aed', accent6: '#ec4899', hlink: '#2563eb', folHlink: '#7c3aed',
};
const PRST_CLR: Record<string, string> = { white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00', gray: '#808080', grey: '#808080' };

// Puntos (caja 0..100) de las formas-polígono, incluidas las que el editor crea
// con puntos en línea (star5/diamond/rightArrow) y no viven en POLY_SHAPES.
function shapePoints(hint: string): { x: number; y: number }[] | null {
  if (POLY_SHAPES[hint]) return POLY_SHAPES[hint];
  if (hint === 'star5') return starPoints(5, 50, 20);
  if (hint === 'diamond') return [{ x: 50, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 100 }, { x: 0, y: 50 }];
  if (hint === 'rightArrow') return [{ x: 0, y: 30 }, { x: 62.5, y: 30 }, { x: 62.5, y: 0 }, { x: 100, y: 50 }, { x: 62.5, y: 100 }, { x: 62.5, y: 70 }, { x: 0, y: 70 }];
  return null;
}

// ── color: tema + modificadores (lumMod/lumOff/tint/shade) ───────────────────
type ThemeMap = Record<string, string>;
/** Contexto de importación de una diapositiva: tema, mapeo de colores y
 *  geometría de marcadores heredada del layout/patrón. */
interface ImportCtx { zip: any; rels: Record<string, string>; theme: ThemeMap; clrMap: Record<string, string>; ph: Map<string, Xfrm>; bg?: string }

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
function hexToRgb(h: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
const rgbToHex = (r: number, g: number, b: number) => `#${[r, g, b].map((c) => clamp(c).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b); let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0); else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const hue2rgb = (p: number, q: number, t: number) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
}
// Aplica los modificadores OOXML hijos del color (en orden) a un hex base.
function applyMods(hex: string, clrEl: Element): string {
  const rgb = hexToRgb(hex); if (!rgb) return hex;
  let { r, g, b } = rgb;
  let lumMod: number | null = null, lumOff: number | null = null;
  for (const ch of Array.from(clrEl.children)) {
    const v = Number(attr(ch, 'val') || 0) / 100000;
    if (ch.localName === 'shade') { r *= v; g *= v; b *= v; }
    else if (ch.localName === 'tint') { r = r * v + 255 * (1 - v); g = g * v + 255 * (1 - v); b = b * v + 255 * (1 - v); }
    else if (ch.localName === 'lumMod') lumMod = v;
    else if (ch.localName === 'lumOff') lumOff = v;
  }
  if (lumMod != null || lumOff != null) {
    const [h, s, l0] = rgbToHsl(r, g, b);
    let l = l0; if (lumMod != null) l *= lumMod; if (lumOff != null) l += lumOff;
    [r, g, b] = hslToRgb(h, s, Math.max(0, Math.min(1, l)));
  }
  return rgbToHex(r, g, b);
}
const CLR_TAGS = ['srgbClr', 'schemeClr', 'sysClr', 'prstClr', 'scrgbClr'];
function colorChild(container: Element | null): Element | null {
  if (!container) return null;
  return (Array.from(container.children).find((c) => CLR_TAGS.includes(c.localName || '')) as Element) || null;
}
/** Resuelve a hex el primer color de un contenedor (solidFill/ln/fillRef/bg),
 *  usando el tema y el clrMap del contexto; aplica modificadores. */
function resolveClr(container: Element | null, ctx?: ImportCtx, phClr?: string): string | undefined {
  const el = colorChild(container); if (!el) return undefined;
  let base: string | undefined;
  if (el.localName === 'srgbClr') base = `#${(attr(el, 'val') || '').toUpperCase()}`;
  else if (el.localName === 'sysClr') { const v = attr(el, 'lastClr'); base = v ? `#${v.toUpperCase()}` : undefined; }
  else if (el.localName === 'prstClr') base = PRST_CLR[(attr(el, 'val') || '').toLowerCase()];
  else if (el.localName === 'schemeClr') {
    const name = attr(el, 'val') || '';
    if (name === 'phClr') return phClr ? applyMods(phClr, el) : phClr;
    if (ctx) { const mapped = ctx.clrMap[name] || name; base = ctx.theme[mapped] || ctx.theme[name]; }
    if (!base) base = SCHEME_FALLBACK[name];
  }
  if (!base) return undefined;
  return applyMods(base, el);
}

// ── geometría ────────────────────────────────────────────────────────────────
interface Xfrm { left: number; top: number; w: number; h: number; rot: number; flipH: boolean; flipV: boolean }
function readXfrm(spPr: Element | null): Xfrm | null {
  const xfrm = firstTag(spPr, 'xfrm');
  if (!xfrm) return null;
  const off = firstChild(xfrm, 'off'), ext = firstChild(xfrm, 'ext');
  if (!off && !ext) return null;
  return {
    left: px(attr(off, 'x')), top: px(attr(off, 'y')),
    w: px(attr(ext, 'cx')), h: px(attr(ext, 'cy')),
    rot: (Number(attr(xfrm, 'rot') || 0) / 60000) || 0,
    flipH: attr(xfrm, 'flipH') === '1', flipV: attr(xfrm, 'flipV') === '1',
  };
}
// Marcador (placeholder) de un <p:sp> → clave type#idx para heredar geometría.
function phOf(sp: Element): { type: string; idx: string } | null {
  const phEl = firstTag(firstChild(sp, 'nvSpPr'), 'ph');
  if (!phEl) return null;
  return { type: attr(phEl, 'type') || 'body', idx: attr(phEl, 'idx') || '' };
}
function phXfrm(ph: { type: string; idx: string }, ctx?: ImportCtx): Xfrm | undefined {
  if (!ctx) return undefined;
  const titles = ['title', 'ctrTitle'];
  return ctx.ph.get(`${ph.type}#${ph.idx}`)
    || ctx.ph.get(ph.type)
    || (titles.includes(ph.type) ? (ctx.ph.get('title') || ctx.ph.get('ctrTitle')) : undefined)
    || (ph.type === 'subTitle' ? ctx.ph.get('body') : undefined)
    || (ph.type === 'body' ? ctx.ph.get('subTitle') : undefined);
}

const ALIGN: Record<string, string> = { l: 'left', ctr: 'center', r: 'right', just: 'justify' };
function readAlign(txBody: Element | null): string | undefined {
  const p = firstTag(txBody, 'p'); const pPr = firstChild(p, 'pPr');
  const a = pPr ? attr(pPr, 'algn') : null;
  return a ? ALIGN[a] : undefined;
}
function readRunProps(p: Element, ctx?: ImportCtx): any {
  // Usa el primer run con texto (los foráneos a veces abren con runs vacíos).
  const runs = childTags(p, 'r');
  const r = runs.find((x) => (firstChild(x, 't')?.textContent || '').length) || runs[0];
  const rPr = firstChild(r, 'rPr') || firstChild(p, 'endParaRPr');
  if (!rPr) return {};
  const sz = attr(rPr, 'sz');
  const latin = firstChild(rPr, 'latin');
  return {
    fontSize: sz ? +((Number(sz) / 100) * (4 / 3)).toFixed(1) : undefined, // pt → px (inverso de *0.75)
    bold: attr(rPr, 'b') === '1', italic: attr(rPr, 'i') === '1',
    underline: !!attr(rPr, 'u') && attr(rPr, 'u') !== 'none',
    fill: resolveClr(firstChild(rPr, 'solidFill'), ctx),
    fontFamily: latin ? attr(latin, 'typeface') || undefined : undefined,
  };
}
function readTxBody(txBody: Element | null, ctx?: ImportCtx): { text: string; props: any } {
  if (!txBody) return { text: '', props: {} };
  const paras = childTags(txBody, 'p');
  const lines: string[] = [];
  let props: any = {};
  for (const p of paras) {
    const pPr = firstChild(p, 'pPr');
    const lvl = pPr ? Number(attr(pPr, 'lvl') || 0) : 0;
    const bullet = !!pPr && (!!firstChild(pPr, 'buChar') || !!firstChild(pPr, 'buAutoNum'));
    const runText = childTags(p, 'r').map((r) => firstChild(r, 't')?.textContent || '').join('');
    if (!Object.keys(props).length && childTags(p, 'r').length) props = readRunProps(p, ctx);
    const indent = '  '.repeat(Math.max(0, lvl));
    lines.push(bullet ? `${indent}• ${runText}` : `${indent}${runText}`);
  }
  return { text: lines.join('\n').replace(/\s+$/, ''), props };
}

// ── conversión de un <p:sp> a objeto (texto o forma) ────────────────────────
function spToObject(sp: Element, ctx?: ImportCtx): any | null {
  const spPr = firstChild(sp, 'spPr');
  const ph = phOf(sp);
  // Geometría propia o, si falta, HEREDADA del marcador del layout/patrón.
  const xf = readXfrm(spPr) || (ph ? phXfrm(ph, ctx) : undefined);
  if (!xf) return null;
  const txBody = firstChild(sp, 'txBody');
  const { text, props } = readTxBody(txBody, ctx);
  const cNvSpPr = firstChild(firstChild(sp, 'nvSpPr'), 'cNvSpPr');
  const isTxBox = attr(cNvSpPr, 'txBox') === '1' || (ph && (ph.type === 'title' || ph.type === 'ctrTitle' || ph.type === 'subTitle' || ph.type === 'body'));
  const prst = attr(firstTag(spPr, 'prstGeom'), 'prst');
  const noFill = !!firstChild(spPr, 'noFill');
  const styleEl = firstChild(sp, 'style');
  let fill = resolveClr(firstChild(spPr, 'solidFill'), ctx);
  if (fill === undefined && !noFill && styleEl) fill = resolveClr(firstChild(styleEl, 'fillRef'), ctx);
  const lnEl = firstChild(spPr, 'ln');
  let stroke = lnEl ? resolveClr(firstChild(lnEl, 'solidFill'), ctx) : undefined;
  if (stroke === undefined && styleEl) stroke = resolveClr(firstChild(styleEl, 'lnRef'), ctx);
  const strokeW = lnEl && attr(lnEl, 'w') ? Math.max(1, Math.round(px(attr(lnEl, 'w')))) : undefined;
  const angle = Math.round(xf.rot);

  // Cuadro de texto: marcador de texto, txBox, o sin forma significativa.
  if (text.trim() && (isTxBox || !prst || prst === 'rect')) {
    const isTitle = !!ph && (ph.type === 'title' || ph.type === 'ctrTitle');
    return {
      type: 'textbox', version: '7', text,
      left: xf.left, top: xf.top, width: Math.max(8, xf.w || 200),
      fontSize: props.fontSize ?? (isTitle ? 40 : 24),
      fill: props.fill || (isTitle ? '#111827' : '#111827'),
      fontWeight: props.bold || isTitle ? 'bold' : 'normal',
      fontStyle: props.italic ? 'italic' : 'normal',
      underline: !!props.underline,
      textAlign: readAlign(txBody) || (ph && (ph.type === 'ctrTitle') ? 'center' : 'left'),
      fontFamily: props.fontFamily || 'sans-serif',
      angle,
    };
  }

  // Autoforma → instancia de Fabric (garantiza JSON válido) → toObject.
  const hint = prst ? PRESET_TO_HINT[prst] : undefined;
  const w = Math.max(1, xf.w), h = Math.max(1, xf.h);
  let obj: any;
  const poly = hint ? shapePoints(hint) : null;
  if (poly) {
    obj = new Polygon(poly.map((p) => ({ x: (p.x / 100) * w, y: (p.y / 100) * h })), { shape: hint } as any);
  } else if (hint && PATH_SHAPES[hint]) {
    obj = new Path(PATH_SHAPES[hint].d, { shape: hint } as any);
    if (typeof obj.scaleToWidth === 'function') obj.scaleToWidth(w);
  } else if (prst === 'ellipse') {
    obj = new Ellipse({ rx: w / 2, ry: h / 2 });
  } else if (prst === 'triangle') {
    obj = new Triangle({ width: w, height: h });
  } else if (prst === 'line') {
    return null; // las líneas reales llegan como <p:cxnSp>; aquí se ignora
  } else if (prst === 'roundRect') {
    const r = Math.min(w, h) * 0.12;
    obj = new Rect({ width: w, height: h, rx: r, ry: r });
  } else {
    obj = new Rect({ width: w, height: h });
  }
  obj.set({ left: xf.left, top: xf.top, angle });
  obj.set('fill', noFill ? '' : (fill || '#3b82f6'));
  if (stroke) obj.set({ stroke, strokeWidth: strokeW || 2 });
  const out = obj.toObject(['shape']);
  // El texto dentro de una forma se añade aparte como cuadro encima (best-effort).
  return text.trim() ? { __shape: out, __text: { text, xf, props, align: readAlign(txBody) } } : out;
}

// Conector / línea (<p:cxnSp>) → línea de Fabric.
function cxnToObject(cxn: Element, ctx?: ImportCtx): any | null {
  const spPr = firstChild(cxn, 'spPr');
  const xf = readXfrm(spPr);
  if (!xf) return null;
  const lnEl = firstChild(spPr, 'ln');
  const styleEl = firstChild(cxn, 'style');
  const stroke = (lnEl ? resolveClr(firstChild(lnEl, 'solidFill'), ctx) : undefined) || (styleEl ? resolveClr(firstChild(styleEl, 'lnRef'), ctx) : undefined) || '#111827';
  const strokeW = lnEl && attr(lnEl, 'w') ? Math.max(1, Math.round(px(attr(lnEl, 'w')))) : 2;
  let x1 = xf.left, y1 = xf.top, x2 = xf.left + xf.w, y2 = xf.top + xf.h;
  if (xf.flipH) { const t = x1; x1 = x2; x2 = t; }
  if (xf.flipV) { const t = y1; y1 = y2; y2 = t; }
  return { type: 'line', version: '7', x1, y1, x2, y2, left: Math.min(x1, x2), top: Math.min(y1, y2), stroke, strokeWidth: strokeW };
}

async function picToObject(pic: Element, ctx: ImportCtx): Promise<any | null> {
  const blip = firstTag(pic, 'blip');
  const embed = blip ? attrNS(blip, 'embed') : null;
  const target = embed ? ctx.rels[embed] : null;
  const file = target ? ctx.zip.file(target) : null;
  if (!file) return null;
  const xf = readXfrm(firstChild(pic, 'spPr'));
  const b64 = await file.async('base64');
  const mime = target!.endsWith('.png') ? 'image/png' : target!.endsWith('.gif') ? 'image/gif' : target!.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg';
  const dataUrl = `data:${mime};base64,${b64}`;
  try {
    const img: any = await FabricImage.fromURL(dataUrl, { crossOrigin: 'anonymous' });
    const natW = img.width || 1, natH = img.height || 1;
    img.set({
      left: xf?.left ?? 0, top: xf?.top ?? 0, angle: Math.round(xf?.rot ?? 0),
      scaleX: (xf?.w || natW) / natW, scaleY: (xf?.h || natH) / natH,
    });
    return img.toObject();
  } catch { return null; }
}

function tblToObject(gf: Element, ctx?: ImportCtx): any | null {
  const tbl = firstTag(gf, 'tbl'); if (!tbl) return null;
  const xf = readXfrm(gf);
  const trs = tags(tbl, 'tr');
  const cells: string[][] = trs.map((tr) => childTags(tr, 'tc').map((tc) => readTxBody(firstChild(tc, 'txBody'), ctx).text));
  const rows = cells.length; const cols = Math.max(1, ...cells.map((r) => r.length));
  if (!rows) return null;
  for (const r of cells) while (r.length < cols) r.push('');
  // Cabecera: respeta tblPr@firstRow; el acento, del relleno de la 1ª celda.
  const tblPr = firstTag(tbl, 'tblPr');
  const header = attr(tblPr, 'firstRow') !== '0';
  const banded = attr(tblPr, 'bandRow') !== '0';
  const firstTc = firstTag(tbl, 'tc');
  const firstFill = resolveClr(firstChild(firstChild(firstTc, 'tcPr'), 'solidFill'), ctx);
  const accent = firstFill && firstFill.toLowerCase() !== '#ffffff' ? firstFill : '#2563eb';
  const spec: TableSpec = { rows, cols, cells, header, banded, accent };
  const g: any = buildTableGroup(spec, { left: xf?.left ?? 90, top: xf?.top ?? 150 });
  const natW = g.width || 1, natH = g.height || 1;
  g.set({ left: xf?.left ?? 90, top: xf?.top ?? 150, scaleX: xf?.w ? xf.w / natW : 1, scaleY: xf?.h ? xf.h / natH : 1 });
  g.setCoords();
  return g.toObject(['tableSpec']);
}

function chartTitle(doc: Document): string {
  const title = firstTag(doc, 'title');
  if (!title) return '';
  return tags(title, 't').map((t) => t.textContent || '').join('') || '';
}
async function chartToObject(gf: Element, ctx: ImportCtx): Promise<any | null> {
  const ref = firstTag(gf, 'chart');
  const rid = ref ? attrNS(ref, 'id') : null;
  const target = rid ? ctx.rels[rid] : null;
  const xml = target ? await ctx.zip.file(target)?.async('string') : null;
  if (!xml) return null;
  const doc = parseXml(xml);
  let type: ChartType = 'bar';
  if (firstTag(doc, 'pieChart')) type = 'pie';
  else if (firstTag(doc, 'doughnutChart')) type = 'doughnut';
  else if (firstTag(doc, 'lineChart')) type = 'line';
  else if (firstTag(doc, 'areaChart')) type = 'area';
  else if (firstTag(doc, 'barChart')) { const dir = firstTag(doc, 'barDir'); type = dir && attr(dir, 'val') === 'bar' ? 'hbar' : 'bar'; }
  const labels: string[] = [];
  const series = tags(doc, 'ser').map((ser, si) => {
    const tx = firstChild(ser, 'tx');
    const name = (tx ? tags(tx, 'v').map((v) => v.textContent || '').join('') : '') || `Serie ${si + 1}`;
    if (!labels.length) { const cat = firstChild(ser, 'cat'); if (cat) tags(cat, 'pt').forEach((pt) => labels.push(firstTag(pt, 'v')?.textContent || '')); }
    const valEl = firstChild(ser, 'val'); const data: number[] = [];
    if (valEl) tags(valEl, 'pt').forEach((pt) => data.push(Number(firstTag(pt, 'v')?.textContent || 0)));
    return { name, data };
  });
  if (!series.length) return null;
  const spec: ChartSpec = { type, title: chartTitle(doc), labels, series };
  const xf = readXfrm(gf);
  const g: any = buildChartGroup(spec, { left: xf?.left ?? 120, top: xf?.top ?? 90, width: xf?.w || 480, height: xf?.h || 300 });
  return g.toObject(['chartSpec']);
}

// Resuelve un .rels en un mapa Id → ruta absoluta dentro del zip.
async function loadRels(zip: any, partPath: string): Promise<Record<string, string>> {
  const dir = partPath.slice(0, partPath.lastIndexOf('/'));
  const relsPath = `${dir}/_rels/${partPath.slice(partPath.lastIndexOf('/') + 1)}.rels`;
  const file = zip.file(relsPath);
  const out: Record<string, string> = {};
  if (!file) return out;
  const doc = parseXml(await file.async('string'));
  for (const rel of tags(doc, 'Relationship')) {
    const id = attr(rel, 'Id'); const tgt = attr(rel, 'Target'); const mode = attr(rel, 'TargetMode');
    if (!id || !tgt) continue;
    out[id] = mode === 'External' ? tgt : resolvePath(dir, tgt);
  }
  return out;
}
function resolvePath(baseDir: string, rel: string): string {
  if (rel.startsWith('/')) return rel.slice(1);
  const parts = `${baseDir}/${rel}`.split('/');
  const stack: string[] = [];
  for (const p of parts) { if (p === '..') stack.pop(); else if (p !== '.' && p !== '') stack.push(p); }
  return stack.join('/');
}

// Junta los marcadores (type#idx → xfrm) del árbol de un layout/patrón.
function collectPlaceholders(doc: Document, into: Map<string, Xfrm>) {
  const tree = firstTag(doc, 'spTree'); if (!tree) return;
  for (const sp of childTags(tree, 'sp')) {
    const ph = phOf(sp); if (!ph) continue;
    const xf = readXfrm(firstChild(sp, 'spPr')); if (!xf) continue;
    into.set(`${ph.type}#${ph.idx}`, xf);
    if (!into.has(ph.type)) into.set(ph.type, xf);
  }
}
function readBg(doc: Document | null, ctx?: ImportCtx): string | undefined {
  if (!doc) return undefined;
  const bg = firstTag(doc, 'bg'); if (!bg) return undefined;
  const bgPr = firstTag(bg, 'bgPr');
  return resolveClr(firstChild(bgPr, 'solidFill'), ctx) || resolveClr(firstChild(bgPr, 'bgRef') || firstChild(bg, 'bgRef'), ctx);
}

// Carga el TEMA, el clrMap, la geometría de marcadores y el fondo heredado
// (layout → patrón → tema) para una diapositiva.
async function loadSlideContext(zip: any, rels: Record<string, string>): Promise<ImportCtx> {
  const ctx: ImportCtx = { zip, rels, theme: {}, clrMap: {}, ph: new Map() };
  try {
    const layoutPath = Object.values(rels).find((t) => /slideLayout\d+\.xml$/.test(t));
    const layoutDoc = layoutPath && zip.file(layoutPath) ? parseXml(await zip.file(layoutPath).async('string')) : null;
    let masterDoc: Document | null = null;
    if (layoutPath) {
      const layoutRels = await loadRels(zip, layoutPath);
      const masterPath = Object.values(layoutRels).find((t) => /slideMaster\d+\.xml$/.test(t));
      if (masterPath && zip.file(masterPath)) {
        masterDoc = parseXml(await zip.file(masterPath).async('string'));
        const masterRels = await loadRels(zip, masterPath);
        const cm = firstTag(masterDoc, 'clrMap');
        if (cm) for (const a of Array.from(cm.attributes)) ctx.clrMap[a.name] = a.value;
        const themePath = Object.values(masterRels).find((t) => /theme\d+\.xml$/.test(t));
        if (themePath && zip.file(themePath)) {
          const scheme = firstTag(parseXml(await zip.file(themePath).async('string')), 'clrScheme');
          if (scheme) for (const child of Array.from(scheme.children)) { const hex = resolveClr(child); if (hex && child.localName) ctx.theme[child.localName] = hex; }
        }
        collectPlaceholders(masterDoc, ctx.ph);
      }
    }
    if (layoutDoc) collectPlaceholders(layoutDoc, ctx.ph); // el layout pisa al patrón
    ctx.bg = readBg(layoutDoc, ctx) || readBg(masterDoc, ctx);
  } catch { /* best-effort */ }
  return ctx;
}

async function importSlide(zip: any, path: string): Promise<{ objects: any[]; background?: string; note: string }> {
  const doc = parseXml(await zip.file(path).async('string'));
  const rels = await loadRels(zip, path);
  const ctx = await loadSlideContext(zip, rels);
  const objects: any[] = [];
  const background = readBg(doc, ctx) || ctx.bg;

  const spTree = firstTag(doc, 'spTree');
  if (spTree) {
    for (const node of Array.from(spTree.children)) {
      try {
        if (node.localName === 'sp') {
          const r = spToObject(node, ctx);
          if (r && r.__shape) { objects.push(r.__shape); objects.push(textOverlay(r.__text)); }
          else if (r) objects.push(r);
        } else if (node.localName === 'pic') {
          const r = await picToObject(node, ctx); if (r) objects.push(r);
        } else if (node.localName === 'cxnSp') {
          const r = cxnToObject(node, ctx); if (r) objects.push(r);
        } else if (node.localName === 'graphicFrame') {
          if (firstTag(node, 'tbl')) { const r = tblToObject(node, ctx); if (r) objects.push(r); }
          else if (firstTag(node, 'chart')) { const r = await chartToObject(node, ctx); if (r) objects.push(r); }
        } else if (node.localName === 'grpSp') {
          for (const o of await importGroup(node, ctx)) objects.push(o);
        }
      } catch { /* skip element */ }
    }
  }

  // Notas del orador.
  let note = '';
  const notesRel = Object.values(rels).find((t) => /notesSlide\d+\.xml$/.test(t));
  if (notesRel && zip.file(notesRel)) {
    try {
      const ndoc = parseXml(await zip.file(notesRel).async('string'));
      const bodies = tags(ndoc, 'sp').map((sp) => readTxBody(firstChild(sp, 'txBody')).text).filter(Boolean);
      note = bodies.join('\n').trim();
    } catch { /* ignore */ }
  }
  return { objects, background, note };
}

// Grupo (<p:grpSp>): transforma los hijos a coordenadas absolutas.
async function importGroup(grp: Element, ctx: ImportCtx): Promise<any[]> {
  const gSpPr = firstChild(grp, 'grpSpPr');
  const xfrm = firstTag(gSpPr, 'xfrm');
  const off = firstChild(xfrm, 'off'), ext = firstChild(xfrm, 'ext');
  const chOff = firstChild(xfrm, 'chOff'), chExt = firstChild(xfrm, 'chExt');
  const ox = px(attr(off, 'x')), oy = px(attr(off, 'y'));
  const cox = px(attr(chOff, 'x')), coy = px(attr(chOff, 'y'));
  const sxr = px(attr(chExt, 'cx')) ? px(attr(ext, 'cx')) / px(attr(chExt, 'cx')) : 1;
  const syr = px(attr(chExt, 'cy')) ? px(attr(ext, 'cy')) / px(attr(chExt, 'cy')) : 1;
  const map = (o: any) => {
    if (!o || typeof o.left !== 'number') return o;
    o.left = ox + (o.left - cox) * sxr;
    o.top = oy + (o.top - coy) * syr;
    if (typeof o.scaleX === 'number') o.scaleX *= sxr; if (typeof o.scaleY === 'number') o.scaleY *= syr;
    return o;
  };
  const out: any[] = [];
  for (const node of Array.from(grp.children)) {
    try {
      if (node.localName === 'sp') { const r = spToObject(node, ctx); if (r && r.__shape) { out.push(map(r.__shape)); out.push(map(textOverlay(r.__text))); } else if (r) out.push(map(r)); }
      else if (node.localName === 'pic') { const r = await picToObject(node, ctx); if (r) out.push(map(r)); }
      else if (node.localName === 'cxnSp') { const r = cxnToObject(node, ctx); if (r) out.push(map(r)); }
      else if (node.localName === 'grpSp') { for (const o of await importGroup(node, ctx)) out.push(map(o)); }
    } catch { /* skip */ }
  }
  return out;
}

function textOverlay(t: any): any {
  return {
    type: 'textbox', version: '7', text: t.text,
    left: t.xf.left, top: t.xf.top, width: Math.max(8, t.xf.w || 200),
    fontSize: t.props.fontSize ?? 20, fill: t.props.fill || '#111827',
    fontWeight: t.props.bold ? 'bold' : 'normal', fontStyle: t.props.italic ? 'italic' : 'normal',
    textAlign: t.align || 'center', fontFamily: t.props.fontFamily || 'sans-serif',
  };
}

/** Punto de entrada: bytes .pptx → deck JSON de AXOS (versión 2). */
export async function importPptx(buf: ArrayBuffer): Promise<any> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buf);

  // Tamaño / relación de aspecto.
  let ratio = '16:9';
  const presFile = zip.file('ppt/presentation.xml');
  let order: string[] = [];
  if (presFile) {
    const pres = parseXml(await presFile.async('string'));
    const sz = firstTag(pres, 'sldSz');
    if (sz) { const cx = Number(attr(sz, 'cx') || 0), cy = Number(attr(sz, 'cy') || 0); if (cx && cy && cy / cx > 0.7) ratio = '4:3'; }
    const presRels = await loadRels(zip, 'ppt/presentation.xml');
    for (const sid of tags(pres, 'sldId')) { const rid = attrNS(sid, 'id'); const tgt = rid ? presRels[rid] : null; if (tgt) order.push(tgt); }
  }
  // Fallback: ordenar por nombre si no hubo lista de ids.
  if (!order.length) {
    order = Object.keys(zip.files).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
      .sort((a, b) => (Number(a.match(/(\d+)\.xml$/)?.[1]) || 0) - (Number(b.match(/(\d+)\.xml$/)?.[1]) || 0));
  }

  const slides: any[] = []; const notes: string[] = [];
  for (const path of order) {
    if (!zip.file(path)) continue;
    try {
      const { objects, background, note } = await importSlide(zip, path);
      slides.push({ version: '7', objects, background: background || '#ffffff' });
      notes.push(note);
    } catch {
      slides.push({ version: '7', objects: [], background: '#ffffff' }); notes.push('');
    }
  }
  if (!slides.length) { slides.push({ version: '7', objects: [], background: '#ffffff' }); notes.push(''); }

  // Normaliza el casing de `type` y sanea posiciones al lienzo (los objetos
  // muy fuera de rango se recortan suavemente).
  const H = slideHeight(ratio);
  for (const s of slides) for (const o of s.objects) {
    normType(o);
    if (typeof o.left === 'number') o.left = Math.max(-50, Math.min(o.left, 960 + 50));
    if (typeof o.top === 'number') o.top = Math.max(-50, Math.min(o.top, H + 50));
  }

  return {
    version: 2, slides, notes, ratio,
    transition: 'fade', transitions: slides.map(() => 'fade'),
    transDurs: slides.map(() => 500), advanceAfters: slides.map(() => 0),
    loop: false, theme: 'light', footer: '', showNumbers: false,
    sections: slides.map(() => null),
  };
}
