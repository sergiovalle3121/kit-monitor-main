/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Exporta diapositivas a PNG (una imagen por diapositiva), rasterizando cada
 * una con un `StaticCanvas` de Fabric fuera de pantalla. Sin dependencias
 * nuevas: usa `fabric` (carga dinámica) y `file-saver` (ya presente).
 */
const CW = 960;

const safeName = (s: string) => (s || 'presentacion').replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'presentacion';

async function renderPng(json: any, multiplier: number, ch: number): Promise<string> {
  const { StaticCanvas } = await import('fabric');
  const sc = new StaticCanvas(document.createElement('canvas'), { width: CW, height: ch });
  try {
    await sc.loadFromJSON(json);
    sc.backgroundColor = (json?.background as string) || '#ffffff';
    sc.renderAll();
    return sc.toDataURL({ format: 'png', multiplier } as any);
  } finally {
    sc.dispose();
  }
}

export async function exportSlidePng(json: any, title: string, index: number, ratio?: string) {
  const { saveAs } = await import('file-saver');
  const url = await renderPng(json, 2, ratio === '4:3' ? 720 : 540);
  saveAs(url, `${safeName(title)}-${String(index + 1).padStart(2, '0')}.png`);
}

export async function exportAllPng(slides: any[], title: string, ratio?: string) {
  const list = Array.isArray(slides) ? slides : [];
  if (!list.length) return;
  const ch = ratio === '4:3' ? 720 : 540;
  const { saveAs } = await import('file-saver');
  for (let i = 0; i < list.length; i++) {
    try {
      const url = await renderPng(list[i], 2, ch);
      saveAs(url, `${safeName(title)}-${String(i + 1).padStart(2, '0')}.png`);
      // Pequeña pausa para que el navegador no agrupe/bloquee las descargas.
      await new Promise((r) => setTimeout(r, 180));
    } catch { /* salta la diapositiva con error */ }
  }
}

async function renderSvg(json: any, ch: number): Promise<string> {
  const { StaticCanvas } = await import('fabric');
  const sc = new StaticCanvas(document.createElement('canvas'), { width: CW, height: ch });
  try {
    await sc.loadFromJSON(json);
    sc.backgroundColor = (json?.background as string) || '#ffffff';
    sc.renderAll();
    return sc.toSVG({ width: CW, height: ch, viewBox: { x: 0, y: 0, width: CW, height: ch } } as any);
  } finally {
    sc.dispose();
  }
}

export async function exportSlideSvg(json: any, title: string, index: number, ratio?: string) {
  const { saveAs } = await import('file-saver');
  const svg = await renderSvg(json, ratio === '4:3' ? 720 : 540);
  saveAs(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${safeName(title)}-${String(index + 1).padStart(2, '0')}.svg`);
}

export async function exportAllSvg(slides: any[], title: string, ratio?: string) {
  const list = Array.isArray(slides) ? slides : [];
  if (!list.length) return;
  const ch = ratio === '4:3' ? 720 : 540;
  const { saveAs } = await import('file-saver');
  for (let i = 0; i < list.length; i++) {
    try {
      const svg = await renderSvg(list[i], ch);
      saveAs(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${safeName(title)}-${String(i + 1).padStart(2, '0')}.svg`);
      await new Promise((r) => setTimeout(r, 180));
    } catch { /* salta la diapositiva con error */ }
  }
}
