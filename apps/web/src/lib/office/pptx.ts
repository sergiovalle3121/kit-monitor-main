/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Export a Fabric-based deck to .pptx using PptxGenJS (MIT). Each Fabric object
 * is mapped to a native PowerPoint shape/text/image/chart/table so the result
 * is editable in PowerPoint (not just an image). Loaded dynamically.
 *
 * Fase 2 (round-trip): fidelidad ampliada — hipervínculos, opacidad
 * (transparencia), sombra, viñetas/indentado en texto y la «mobiliaria» del
 * patrón compuesta como fondo. `buildPptx`/`pptxArrayBuffer` exponen los bytes
 * para el test de fidelidad (export → import → comparación).
 */

const IN_W = 10;       // ancho de diapositiva en pulgadas (960px @ 96dpi)
const DPI = 96;        // 960px/10in = 96; las posiciones de objeto son px@96dpi en ambas relaciones
const inHeight = (ratio?: string) => (ratio === '4:3' ? 7.5 : 5.625);

const safe = (s: string) => (s || 'presentacion').replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'presentacion';
const sx = (px: number) => +(px / DPI).toFixed(3);
const sy = (px: number) => +(px / DPI).toFixed(3);
const pxToPt = (px: number) => +(px * 0.75).toFixed(2); // 96dpi px → puntos
function hex(c?: any): string | undefined {
  if (!c) return undefined;
  // Gradient fill → approximate with its first color stop.
  if (typeof c === 'object' && Array.isArray(c.colorStops) && c.colorStops[0]) return hex(c.colorStops[0].color);
  if (typeof c !== 'string') return undefined;
  const s = c.trim();
  if (s.startsWith('#')) return s.slice(1, 7).toUpperCase();
  // rgb()/rgba() → hex (sombras de Fabric llegan como rgba()).
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(s);
  if (m) return [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
  return undefined;
}
// Opacidad (0..1) → transparencia PptxGenJS (0..100). Sólo si hay transparencia.
const transp = (op: any): number | undefined => (typeof op === 'number' && op >= 0 && op < 1 ? Math.round((1 - op) * 100) : undefined);

// Sombra de Fabric { color, blur, offsetX, offsetY } → sombra externa de PowerPoint.
function shadowOpt(sh: any): any {
  if (!sh || typeof sh !== 'object') return undefined;
  const color = hex(sh.color) || '000000';
  const offX = typeof sh.offsetX === 'number' ? sh.offsetX : 3;
  const offY = typeof sh.offsetY === 'number' ? sh.offsetY : 3;
  const offset = Math.max(1, Math.round(pxToPt(Math.hypot(offX, offY))));
  const angle = ((Math.round((Math.atan2(offY, offX) * 180) / Math.PI) % 360) + 360) % 360;
  const blur = Math.max(0, Math.round(pxToPt(typeof sh.blur === 'number' ? sh.blur : 8)));
  // La opacidad de la sombra de Fabric va embebida en el alfa del color rgba().
  let opacity = 0.5;
  const am = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/i.exec(String(sh.color || ''));
  if (am) opacity = Math.min(1, Math.max(0, parseFloat(am[1])));
  return { type: 'outer', color, blur, offset, angle, opacity };
}
// Hipervínculo de objeto { type:'url'|'slide', href|index } → opción de PptxGenJS.
function linkOpt(o: any): any {
  const L = o?.link;
  if (!L || typeof L !== 'object') return undefined;
  if (L.type === 'url' && typeof L.href === 'string') return { url: L.href };
  if (L.type === 'slide' && typeof L.index === 'number') return { slide: L.index + 1 };
  return undefined;
}

// Pista de forma (Fabric) → nombre de preset de PowerPoint (PptxGenJS ShapeType).
// Si el preset no existe en la versión de la lib, presetFor() devuelve undefined
// y el llamador cae a un rectángulo (formas) u omite (paths sueltos).
export const HINT_TO_PRESET: Record<string, string> = {
  star4: 'star4', star5: 'star5', star6: 'star6',
  rightArrow: 'rightArrow', leftArrow: 'leftArrow', upArrow: 'upArrow', downArrow: 'downArrow', leftRightArrow: 'leftRightArrow',
  diamond: 'diamond', pentagon: 'pentagon', hexagon: 'hexagon', octagon: 'octagon',
  trapezoid: 'trapezoid', parallelogram: 'parallelogram', chevron: 'chevron', homePlate: 'homePlate',
  plus: 'plus', lightningBolt: 'lightningBolt', ribbon: 'ribbon2',
  heart: 'heart', cloud: 'cloud', sun: 'sun', speech: 'wedgeRectCallout',
};
export function presetFor(hint: any, ST: any): any {
  const name = typeof hint === 'string' ? HINT_TO_PRESET[hint] : undefined;
  return name ? ST[name] : undefined;
}

export interface PptxOpts { footer?: string; showNumbers?: boolean; ratio?: string; masterImg?: string }

/** Construye la presentación PptxGenJS (sin escribirla). Reutilizable por el
 *  export (writeFile) y por el test de fidelidad (bytes en memoria). */
export async function buildPptx(slides: any[], notes: string[] = [], opts: PptxOpts = {}): Promise<any> {
  const mod: any = await import('pptxgenjs');
  const PptxGenJS = mod.default ?? mod;
  const pptx: any = new PptxGenJS();
  const IN_H = inHeight(opts.ratio);
  pptx.defineLayout({ name: 'AXOS', width: IN_W, height: IN_H });
  pptx.layout = 'AXOS';
  const ST = pptx.ShapeType;
  const total = (slides ?? []).length;

  (slides ?? []).forEach((json, i) => {
    const slide = pptx.addSlide();
    const bg = hex(json?.background);
    if (bg) slide.background = { color: bg };

    // Mobiliaria del patrón (logo/barras/marcos) compuesta detrás del contenido.
    if (opts.masterImg) {
      try { slide.addImage({ data: opts.masterImg, x: 0, y: 0, w: IN_W, h: IN_H }); } catch { /* ignore */ }
    }

    for (const o of json?.objects ?? []) {
      try {
        if (o && o.chartSpec) addChartObject(slide, o, pptx);
        else if (o && o.tableSpec) addTableObject(slide, o);
        else addObject(slide, o, ST);
      } catch { /* skip unsupported object */ }
    }
    if (opts.footer) { try { slide.addText(String(opts.footer), { x: 0.4, y: IN_H - 0.4, w: 6, h: 0.3, fontSize: 9, color: '888888', align: 'left' }); } catch { /* ignore */ } }
    if (opts.showNumbers) { try { slide.addText(`${i + 1} / ${total}`, { x: IN_W - 1.4, y: IN_H - 0.4, w: 1, h: 0.3, fontSize: 9, color: '888888', align: 'right' }); } catch { /* ignore */ } }
    const note = notes?.[i];
    if (note && note.trim()) { try { slide.addNotes(note); } catch { /* ignore */ } }
  });
  return pptx;
}

export async function exportPptx(slides: any[], title: string, notes: string[] = [], opts: PptxOpts = {}) {
  const pptx = await buildPptx(slides, notes, opts);
  await pptx.writeFile({ fileName: `${safe(title)}.pptx` });
}

/** Bytes .pptx en memoria (para el test de fidelidad round-trip). */
export async function pptxArrayBuffer(slides: any[], notes: string[] = [], opts: PptxOpts = {}): Promise<ArrayBuffer> {
  const pptx = await buildPptx(slides, notes, opts);
  return pptx.write({ outputType: 'arraybuffer' });
}

// Paleta por defecto (espejo de slides/chart.ts) para gráficos sin paleta propia.
const CHART_PAL = ['3B82F6', '10B981', 'F59E0B', 'EF4444', '7C3AED', 'EC4899', '14B8A6', 'F97316'];

/** Exporta un gráfico (Group con chartSpec) como gráfico NATIVO de PowerPoint. */
function addChartObject(slide: any, o: any, pptx: any) {
  const spec = o.chartSpec;
  if (!spec || !Array.isArray(spec.series) || !spec.series.length) return;
  const scaleX = o.scaleX ?? 1, scaleY = o.scaleY ?? 1;
  const w = (o.width ?? 480) * scaleX, h = (o.height ?? 300) * scaleY;
  const box = { x: sx(o.left ?? 0), y: sy(o.top ?? 0), w: Math.max(0.5, sx(w)), h: Math.max(0.5, sy(h)) };
  const colors = (Array.isArray(spec.palette) && spec.palette.length ? spec.palette : CHART_PAL)
    .map((c: any) => String(c).replace('#', '').toUpperCase());
  const labels: string[] = (spec.labels ?? []).map((x: any) => String(x));
  const T = pptx.ChartType;
  const legend = spec.legend !== false;
  const common = { ...box, chartColors: colors, showLegend: legend, legendPos: 'b', showTitle: !!(spec.title && spec.title.trim()), title: spec.title || '', showValue: !!spec.showValues };
  if (spec.type === 'pie' || spec.type === 'doughnut' || spec.type === 'gauge') {
    const s0 = spec.series[0];
    const chartData = spec.type === 'gauge'
      ? [{ name: s0?.name || 'Gauge', labels: ['Valor', 'Restante'], values: [Number(s0?.data?.[0]) || 0, Math.max(0, (Number(s0?.data?.[1]) || 100) - (Number(s0?.data?.[0]) || 0))] }]
      : [{ name: s0?.name || 'Datos', labels, values: (s0?.data ?? []).map((n: any) => Number(n) || 0) }];
    slide.addChart((spec.type === 'doughnut' || spec.type === 'gauge') ? (T.doughnut ?? T.pie) : T.pie,
      chartData,
      { ...common, showPercent: !!spec.showValues, ...(spec.type === 'doughnut' || spec.type === 'gauge' ? { holeSize: spec.type === 'gauge' ? 70 : 55 } : {}) });
    return;
  }
  let data = spec.series.map((s: any) => ({ name: String(s.name ?? ''), labels, values: (s.data ?? []).map((n: any) => Number(n) || 0) }));
  if (spec.type === 'pareto' || spec.type === 'waterfall') data = data.slice(0, 1);
  const type = spec.type === 'line' ? T.line : spec.type === 'area' ? T.area : T.bar;
  slide.addChart(type, data, { ...common, barDir: spec.type === 'hbar' ? 'bar' : 'col', ...(spec.stacked && (spec.type === 'bar' || spec.type === 'hbar') ? { barGrouping: 'stacked' } : {}) });
}

// Mezcla un color hex (RRGGBB) hacia el blanco — espejo de `tint()` del lienzo (slides/table.ts),
// para que las filas con banda exportadas usen el MISMO tinte del color de acento que se ve en pantalla.
function tintHex(h6: string, amount: number): string {
  const r = parseInt(h6.slice(0, 2), 16), g = parseInt(h6.slice(2, 4), 16), b = parseInt(h6.slice(4, 6), 16);
  const mix = (x: number) => Math.round(x * amount + 255 * (1 - amount));
  return [mix(r), mix(g), mix(b)].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** Exporta una tabla (Group con tableSpec) como TABLA NATIVA de PowerPoint. */
function addTableObject(slide: any, o: any) {
  const spec = o.tableSpec; if (!spec || !Array.isArray(spec.cells)) return;
  const accent = hex(spec.accent) || '2563EB';
  const bandFill = tintHex(accent, 0.10); // banda = acento atenuado al 10% (idéntico al lienzo)
  const scaleX = o.scaleX ?? 1, scaleY = o.scaleY ?? 1;
  const w = (o.width ?? 450) * scaleX, h = (o.height ?? 132) * scaleY;
  const rows = spec.cells.map((row: any[], r: number) => row.map((txt: any) => {
    const isHeader = spec.header && r === 0;
    const banded = spec.banded && !isHeader && r % 2 === 1;
    return {
      text: String(txt ?? ''),
      options: {
        bold: isHeader, color: isHeader ? 'FFFFFF' : '1F2937',
        fill: { color: isHeader ? accent : (banded ? bandFill : 'FFFFFF') },
        align: 'left', valign: 'middle', fontSize: 12,
      },
    };
  }));
  slide.addTable(rows, { x: sx(o.left ?? 0), y: sy(o.top ?? 0), w: sx(w), h: sy(h), border: { type: 'solid', color: 'CBD5E1', pt: 1 }, autoPage: false });
}

// Construye los párrafos de un texto con viñetas/indentado a partir de las
// líneas (• → bullet; sangría de 2 espacios = un nivel), como en el editor.
// El hipervínculo va en CADA tirada de texto (run), no en las opciones del shape:
// PptxGenJS sólo crea la relación r:id del enlace a nivel de run (a nivel de shape
// quedaba como `rIdundefined`, un enlace roto).
function textParagraphs(o: any, link?: any): any[] {
  const raw = String(o.text ?? '');
  return raw.split('\n').map((line) => {
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    const m = /^(\s*)•\s?(.*)$/.exec(line);
    const isBullet = !!m;
    const body = isBullet ? m![2] : line.replace(/^\s+/, '');
    const options: any = { breakLine: true };
    const level = Math.min(8, Math.floor(indent / 2));
    if (isBullet) { options.bullet = true; if (level) options.indentLevel = level; }
    else if (level) options.indentLevel = level;
    if (link) options.hyperlink = link;
    return { text: body, options };
  });
}

function addObject(slide: any, o: any, ST: any) {
  const scaleX = o.scaleX ?? 1;
  const scaleY = o.scaleY ?? 1;
  const type = String(o.type || '').toLowerCase();

  // Grupos (iconos/agrupaciones): exportar sus hijos con la transformación del grupo.
  if (type === 'group' && Array.isArray(o.objects)) {
    const gw = o.width ?? 0, gh = o.height ?? 0;
    for (const child of o.objects) {
      try {
        addObject(slide, {
          ...child,
          left: (o.left ?? 0) + ((child.left ?? 0) + gw / 2) * scaleX,
          top: (o.top ?? 0) + ((child.top ?? 0) + gh / 2) * scaleY,
          scaleX: (child.scaleX ?? 1) * scaleX,
          scaleY: (child.scaleY ?? 1) * scaleY,
        }, ST);
      } catch { /* skip */ }
    }
    return;
  }
  const w = (o.radius ? o.radius * 2 : (o.width ?? 0)) * scaleX;
  const h = (o.radius ? o.radius * 2 : (o.height ?? 0)) * scaleY;
  const box = { x: sx(o.left ?? 0), y: sy(o.top ?? 0), w: Math.max(0.05, sx(w)), h: Math.max(0.05, sy(h)), rotate: Math.round(o.angle ?? 0) };
  const link = linkOpt(o);
  const shadow = shadowOpt(o.shadow);
  const tr = transp(o.opacity);
  const fillOf = (c: any) => (hex(c) ? { color: hex(c), ...(tr !== undefined ? { transparency: tr } : {}) } : { type: 'none' });

  // Path: si lleva pista de forma (corazón, nube, bocadillo…), exporta como
  // preset nativo de PowerPoint; si no, es un trazo SVG suelto → se omite.
  if (type === 'path') {
    const preset = presetFor(o.shape, ST);
    if (preset) {
      slide.addShape(preset, {
        ...box, fill: fillOf(o.fill),
        line: hex(o.stroke) ? { color: hex(o.stroke), width: o.strokeWidth ?? 1 } : undefined,
        ...(shadow ? { shadow } : {}), ...(link ? { hyperlink: link } : {}),
      });
    }
    return;
  }

  if (type === 'textbox' || type === 'i-text' || type === 'text') {
    slide.addText(textParagraphs(o, link), {
      ...box,
      fontSize: Math.round((o.fontSize ?? 18) * scaleY * 0.75),
      color: hex(o.fill) ?? '111827',
      bold: o.fontWeight === 'bold' || o.fontWeight === 700,
      italic: o.fontStyle === 'italic',
      underline: o.underline ? { style: 'sng' } : undefined,
      align: (o.textAlign as any) ?? 'left',
      fontFace: String(o.fontFamily ?? 'Arial').split(',')[0].replace(/["']/g, '').trim() || 'Arial',
      valign: 'top',
      margin: 0,
      ...(typeof o.lineHeight === 'number' ? { lineSpacingMultiple: +o.lineHeight.toFixed(2) } : {}),
      ...(typeof o.charSpacing === 'number' && o.charSpacing ? { charSpacing: Math.round(o.charSpacing / 10) } : {}),
      ...(tr !== undefined ? { transparency: tr } : {}),
      ...(shadow ? { shadow } : {}),
    });
    return;
  }
  if (type === 'image' && o.src) {
    const isData = String(o.src).startsWith('data:');
    slide.addImage({ ...box, ...(isData ? { data: o.src } : { path: o.src }), ...(tr !== undefined ? { transparency: tr } : {}), ...(link ? { hyperlink: link } : {}) });
    return;
  }
  if (type === 'line') {
    slide.addShape(ST.line, { ...box, line: { color: hex(o.stroke) ?? '111827', width: o.strokeWidth ?? 2 }, ...(link ? { hyperlink: link } : {}) });
    return;
  }
  // Conector (polyline con extremos absolutos en `conn`) → línea con flecha opcional.
  if (type === 'polyline' && o.conn && typeof o.conn.x1 === 'number') {
    const { x1, y1, x2, y2, arrow } = o.conn;
    const lbox = { x: sx(Math.min(x1, x2)), y: sy(Math.min(y1, y2)), w: Math.max(0.02, sx(Math.abs(x2 - x1))), h: Math.max(0.02, sy(Math.abs(y2 - y1))) };
    slide.addShape(ST.line, {
      ...lbox, flipH: x2 < x1, flipV: y2 < y1,
      line: { color: hex(o.stroke) ?? '64748B', width: o.strokeWidth ?? 2, ...(arrow ? { endArrowType: 'triangle' } : {}) },
    });
    return;
  }
  if (type === 'polyline' || type === 'polygon') {
    // Polilíneas/polígonos sin pista de forma: aproximar con su caja (relleno/línea).
    if (!o.shape) {
      slide.addShape(ST.rect, { ...box, fill: fillOf(o.fill), line: hex(o.stroke) ? { color: hex(o.stroke), width: o.strokeWidth ?? 1 } : undefined, ...(shadow ? { shadow } : {}), ...(link ? { hyperlink: link } : {}) });
      return;
    }
  }
  // Custom shape hint (star/arrow/diamond/pentágono…) → preset nativo de PowerPoint.
  const hinted = presetFor(o.shape, ST);
  const shape = hinted
    ? hinted
    : type === 'circle' ? ST.ellipse
    : type === 'ellipse' ? ST.ellipse
    : type === 'triangle' ? ST.triangle
    : (o.rx || o.ry) ? ST.roundRect
    : ST.rect;
  slide.addShape(shape, {
    ...box, fill: fillOf(o.fill),
    line: hex(o.stroke) ? { color: hex(o.stroke), width: o.strokeWidth ?? 1 } : undefined,
    ...(shadow ? { shadow } : {}), ...(link ? { hyperlink: link } : {}),
  });
}
