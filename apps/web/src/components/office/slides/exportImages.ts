/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Exporta diapositivas a PNG (una imagen por diapositiva), rasterizando cada
 * una con un `StaticCanvas` de Fabric fuera de pantalla. Sin dependencias
 * nuevas: usa `fabric` (carga dinámica) y `file-saver` (ya presente).
 */
const CW = 960;
const CH = 540;

const safeName = (s: string) => (s || 'presentacion').replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'presentacion';

async function renderPng(json: any, multiplier: number): Promise<string> {
  const { StaticCanvas } = await import('fabric');
  const sc = new StaticCanvas(document.createElement('canvas'), { width: CW, height: CH });
  try {
    await sc.loadFromJSON(json);
    sc.backgroundColor = (json?.background as string) || '#ffffff';
    sc.renderAll();
    return sc.toDataURL({ format: 'png', multiplier } as any);
  } finally {
    sc.dispose();
  }
}

export async function exportSlidePng(json: any, title: string, index: number) {
  const { saveAs } = await import('file-saver');
  const url = await renderPng(json, 2);
  saveAs(url, `${safeName(title)}-${String(index + 1).padStart(2, '0')}.png`);
}

export async function exportAllPng(slides: any[], title: string) {
  const list = Array.isArray(slides) ? slides : [];
  if (!list.length) return;
  const { saveAs } = await import('file-saver');
  for (let i = 0; i < list.length; i++) {
    try {
      const url = await renderPng(list[i], 2);
      saveAs(url, `${safeName(title)}-${String(i + 1).padStart(2, '0')}.png`);
      // Pequeña pausa para que el navegador no agrupe/bloquee las descargas.
      await new Promise((r) => setTimeout(r, 180));
    } catch { /* salta la diapositiva con error */ }
  }
}
