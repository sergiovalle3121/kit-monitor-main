/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Export a Fabric-based deck to .pptx using PptxGenJS (MIT). Each Fabric object
 * is mapped to a native PowerPoint shape/text/image so the result is editable
 * in PowerPoint (not just an image). Loaded dynamically.
 */

const IN_W = 10;       // ancho de diapositiva en pulgadas (960px @ 96dpi)
const DPI = 96;        // 960px/10in = 96; las posiciones de objeto son px@96dpi en ambas relaciones
const inHeight = (ratio?: string) => (ratio === '4:3' ? 7.5 : 5.625);

const safe = (s: string) => (s || 'presentacion').replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'presentacion';
const sx = (px: number) => +(px / DPI).toFixed(3);
const sy = (px: number) => +(px / DPI).toFixed(3);
function hex(c?: any): string | undefined {
  if (!c) return undefined;
  // Gradient fill → approximate with its first color stop.
  if (typeof c === 'object' && Array.isArray(c.colorStops) && c.colorStops[0]) return hex(c.colorStops[0].color);
  if (typeof c !== 'string') return undefined;
  if (c.startsWith('#')) return c.slice(1, 7).toUpperCase();
  return undefined;
}

// Pista de forma (Fabric) → nombre de preset de PowerPoint (PptxGenJS ShapeType).
// Si el preset no existe en la versión de la lib, presetFor() devuelve undefined
// y el llamador cae a un rectángulo (formas) u omite (paths sueltos).
const HINT_TO_PRESET: Record<string, string> = {
  star4: 'star4', star5: 'star5', star6: 'star6',
  rightArrow: 'rightArrow', leftArrow: 'leftArrow', upArrow: 'upArrow', downArrow: 'downArrow', leftRightArrow: 'leftRightArrow',
  diamond: 'diamond', pentagon: 'pentagon', hexagon: 'hexagon', octagon: 'octagon',
  trapezoid: 'trapezoid', parallelogram: 'parallelogram', chevron: 'chevron', homePlate: 'homePlate',
  plus: 'plus', lightningBolt: 'lightningBolt', ribbon: 'ribbon2',
  heart: 'heart', cloud: 'cloud', sun: 'sun', speech: 'wedgeRectCallout',
};
function presetFor(hint: any, ST: any): any {
  const name = typeof hint === 'string' ? HINT_TO_PRESET[hint] : undefined;
  return name ? ST[name] : undefined;
}

export async function exportPptx(slides: any[], title: string, notes: string[] = [], opts: { footer?: string; showNumbers?: boolean; ratio?: string } = {}) {
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

  await pptx.writeFile({ fileName: `${safe(title)}.pptx` });
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
  if (spec.type === 'pie' || spec.type === 'doughnut') {
    const s0 = spec.series[0];
    slide.addChart(spec.type === 'doughnut' ? (T.doughnut ?? T.pie) : T.pie,
      [{ name: s0?.name || 'Datos', labels, values: (s0?.data ?? []).map((n: any) => Number(n) || 0) }],
      { ...common, showPercent: !!spec.showValues, ...(spec.type === 'doughnut' ? { holeSize: 55 } : {}) });
    return;
  }
  const data = spec.series.map((s: any) => ({ name: String(s.name ?? ''), labels, values: (s.data ?? []).map((n: any) => Number(n) || 0) }));
  const type = spec.type === 'line' ? T.line : spec.type === 'area' ? T.area : T.bar;
  slide.addChart(type, data, { ...common, barDir: spec.type === 'hbar' ? 'bar' : 'col', ...(spec.stacked && (spec.type === 'bar' || spec.type === 'hbar' || spec.type === 'area') ? { barGrouping: 'stacked' } : {}) });
}

/** Exporta una tabla (Group con tableSpec) como TABLA NATIVA de PowerPoint. */
function addTableObject(slide: any, o: any) {
  const spec = o.tableSpec; if (!spec || !Array.isArray(spec.cells)) return;
  const accent = hex(spec.accent) || '2563EB';
  const scaleX = o.scaleX ?? 1, scaleY = o.scaleY ?? 1;
  const w = (o.width ?? 450) * scaleX, h = (o.height ?? 132) * scaleY;
  const rows = spec.cells.map((row: any[], r: number) => row.map((txt: any) => {
    const isHeader = spec.header && r === 0;
    const banded = spec.banded && !isHeader && r % 2 === 1;
    return {
      text: String(txt ?? ''),
      options: {
        bold: isHeader, color: isHeader ? 'FFFFFF' : '1F2937',
        fill: { color: isHeader ? accent : (banded ? 'EEF2FF' : 'FFFFFF') },
        align: 'left', valign: 'middle', fontSize: 12,
      },
    };
  }));
  slide.addTable(rows, { x: sx(o.left ?? 0), y: sy(o.top ?? 0), w: sx(w), h: sy(h), border: { type: 'solid', color: 'CBD5E1', pt: 1 }, autoPage: false });
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

  // Path: si lleva pista de forma (corazón, nube, bocadillo…), exporta como
  // preset nativo de PowerPoint; si no, es un trazo SVG suelto → se omite.
  if (type === 'path') {
    const preset = presetFor(o.shape, ST);
    if (preset) {
      slide.addShape(preset, {
        ...box,
        fill: hex(o.fill) ? { color: hex(o.fill) } : { type: 'none' },
        line: hex(o.stroke) ? { color: hex(o.stroke), width: o.strokeWidth ?? 1 } : undefined,
      });
    }
    return;
  }

  if (type === 'textbox' || type === 'i-text' || type === 'text') {
    slide.addText(String(o.text ?? ''), {
      ...box,
      fontSize: Math.round((o.fontSize ?? 18) * scaleY * 0.75),
      color: hex(o.fill) ?? '111827',
      bold: o.fontWeight === 'bold' || o.fontWeight === 700,
      italic: o.fontStyle === 'italic',
      align: (o.textAlign as any) ?? 'left',
      fontFace: String(o.fontFamily ?? 'Arial').split(',')[0].replace(/["']/g, '').trim() || 'Arial',
      valign: 'top',
      margin: 0,
    });
    return;
  }
  if (type === 'image' && o.src) {
    const isData = String(o.src).startsWith('data:');
    slide.addImage({ ...box, ...(isData ? { data: o.src } : { path: o.src }) });
    return;
  }
  if (type === 'line') {
    slide.addShape(ST.line, { ...box, line: { color: hex(o.stroke) ?? '111827', width: o.strokeWidth ?? 2 } });
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
      slide.addShape(ST.rect, { ...box, fill: hex(o.fill) ? { color: hex(o.fill) } : { type: 'none' }, line: hex(o.stroke) ? { color: hex(o.stroke), width: o.strokeWidth ?? 1 } : undefined });
      return;
    }
  }
  // Custom shape hint (star/arrow/diamond/pentágono…) → preset nativo de PowerPoint.
  const hinted = presetFor(o.shape, ST);
  const shape = hinted
    ? hinted
    : type === 'circle' ? ST.ellipse
    : type === 'triangle' ? ST.triangle
    : (o.rx || o.ry) ? ST.roundRect
    : ST.rect;
  slide.addShape(shape, {
    ...box,
    fill: hex(o.fill) ? { color: hex(o.fill) } : { type: 'none' },
    line: hex(o.stroke) ? { color: hex(o.stroke), width: o.strokeWidth ?? 1 } : undefined,
  });
}
