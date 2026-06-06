/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Render a Fabric-based slide deck to a PDF. Each slide is rasterized off-screen
 * with a Fabric StaticCanvas and placed full-bleed on a 16:9 landscape page.
 * Both `fabric` and `jspdf` are imported dynamically (loaded on demand only).
 */

const CW = 960;
const CH = 540;

const safeName = (s: string) => (s || 'presentacion').replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'presentacion';

export async function exportSlidesPdf(slides: any[], title: string) {
  const list = Array.isArray(slides) ? slides : [];
  if (!list.length) return;

  const [{ StaticCanvas }, jspdf] = await Promise.all([import('fabric'), import('jspdf')]);
  const JsPDF: any = (jspdf as any).jsPDF ?? (jspdf as any).default;
  const pdf = new JsPDF({ orientation: 'landscape', unit: 'px', format: [CW, CH], compress: true });

  for (let i = 0; i < list.length; i++) {
    const json = list[i];
    let dataUrl = '';
    try {
      const sc = new StaticCanvas(document.createElement('canvas'), { width: CW, height: CH });
      await sc.loadFromJSON(json);
      sc.backgroundColor = (json?.background as string) || '#ffffff';
      sc.renderAll();
      dataUrl = sc.toDataURL({ format: 'png', multiplier: 2 } as any);
      sc.dispose();
    } catch { /* leave page blank */ }

    if (i > 0) pdf.addPage([CW, CH], 'landscape');
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, CW, CH, 'F');
    if (dataUrl) pdf.addImage(dataUrl, 'PNG', 0, 0, CW, CH);
  }

  pdf.save(`${safeName(title)}.pdf`);
}
