/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Export a Fabric-based deck to .pptx using PptxGenJS (MIT). Each Fabric object
 * is mapped to a native PowerPoint shape/text/image so the result is editable
 * in PowerPoint (not just an image). Loaded dynamically.
 */

const CW = 960;
const CH = 540;
const IN_W = 10;       // 16:9 slide, inches
const IN_H = 5.625;

const safe = (s: string) => (s || 'presentacion').replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'presentacion';
const sx = (px: number) => +( (px / CW) * IN_W ).toFixed(3);
const sy = (px: number) => +( (px / CH) * IN_H ).toFixed(3);
function hex(c?: any): string | undefined {
  if (!c) return undefined;
  // Gradient fill → approximate with its first color stop.
  if (typeof c === 'object' && Array.isArray(c.colorStops) && c.colorStops[0]) return hex(c.colorStops[0].color);
  if (typeof c !== 'string') return undefined;
  if (c.startsWith('#')) return c.slice(1, 7).toUpperCase();
  return undefined;
}

export async function exportPptx(slides: any[], title: string, notes: string[] = [], opts: { footer?: string; showNumbers?: boolean } = {}) {
  const mod: any = await import('pptxgenjs');
  const PptxGenJS = mod.default ?? mod;
  const pptx: any = new PptxGenJS();
  pptx.defineLayout({ name: 'AXOS_16x9', width: IN_W, height: IN_H });
  pptx.layout = 'AXOS_16x9';
  const ST = pptx.ShapeType;
  const total = (slides ?? []).length;

  (slides ?? []).forEach((json, i) => {
    const slide = pptx.addSlide();
    const bg = hex(json?.background);
    if (bg) slide.background = { color: bg };

    for (const o of json?.objects ?? []) {
      try { addObject(slide, o, ST); } catch { /* skip unsupported object */ }
    }
    if (opts.footer) { try { slide.addText(String(opts.footer), { x: 0.4, y: IN_H - 0.4, w: 6, h: 0.3, fontSize: 9, color: '888888', align: 'left' }); } catch { /* ignore */ } }
    if (opts.showNumbers) { try { slide.addText(`${i + 1} / ${total}`, { x: IN_W - 1.4, y: IN_H - 0.4, w: 1, h: 0.3, fontSize: 9, color: '888888', align: 'right' }); } catch { /* ignore */ } }
    const note = notes?.[i];
    if (note && note.trim()) { try { slide.addNotes(note); } catch { /* ignore */ } }
  });

  await pptx.writeFile({ fileName: `${safe(title)}.pptx` });
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
  // Trazos SVG sueltos (iconos vectoriales): PowerPoint no los reproduce bien → omitir.
  if (type === 'path') return;
  const w = (o.radius ? o.radius * 2 : (o.width ?? 0)) * scaleX;
  const h = (o.radius ? o.radius * 2 : (o.height ?? 0)) * scaleY;
  const box = { x: sx(o.left ?? 0), y: sy(o.top ?? 0), w: Math.max(0.05, sx(w)), h: Math.max(0.05, sy(h)), rotate: Math.round(o.angle ?? 0) };

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
  // Custom shape hint (star/arrow/diamond) maps to a native PowerPoint preset.
  const presetByHint: Record<string, any> = { star5: ST.star5, rightArrow: ST.rightArrow, diamond: ST.diamond };
  const shape = (o.shape && presetByHint[o.shape]) ? presetByHint[o.shape]
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
