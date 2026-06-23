'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Arnés de test (Fase 5): construye un .pptx FORÁNEO mínimo a mano (con
 * construcciones que nuestro exportador NUNCA emite — geometría de marcador
 * heredada del layout, schemeClr contra un tema real, lumMod y clrMap) y
 * verifica que el importer las resuelva. Lo consume el spec
 * `e2e/golden/12-pptx-foreign-import.spec.ts`. Solo desarrollo.
 */
import React, { useEffect, useState } from 'react';

const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

const rels = (items: string) => `<?xml version="1.0"?><Relationships xmlns="${NS_REL}">${items}</Relationships>`;

export default function ForeignImportHarness() {
  const [result, setResult] = useState<any>(process.env.NODE_ENV === 'production' ? { pass: false, skipped: true } : null);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    let active = true;
    (async () => {
      try {
        const JSZip = (await import('jszip')).default;
        const { importPptx } = await import('@/lib/office/pptxImport');
        const zip = new JSZip();

        zip.file('ppt/presentation.xml', `<?xml version="1.0"?><p:presentation xmlns:p="${NS_P}" xmlns:r="${NS_R}"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`);
        zip.file('ppt/_rels/presentation.xml.rels', rels('<Relationship Id="rId1" Type="slide" Target="slides/slide1.xml"/>'));

        // Slide: título SIN xfrm (hereda del layout) + 2 rects con schemeClr
        // accent1 (uno con lumMod) + fondo schemeClr bg1 (→ clrMap → lt1).
        zip.file('ppt/slides/slide1.xml', `<?xml version="1.0"?><p:sld xmlns:p="${NS_P}" xmlns:a="${NS_A}" xmlns:r="${NS_R}"><p:cSld>` +
          `<p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg1"/></a:solidFill></p:bgPr></p:bg><p:spTree>` +
          `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="es"/><a:t>Titulo foraneo</a:t></a:r></a:p></p:txBody></p:sp>` +
          `<p:sp><p:nvSpPr><p:cNvPr id="3" name="R1"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="914400" y="3000000"/><a:ext cx="1828800" cy="914400"/></a:xfrm><a:prstGeom prst="rect"/><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></p:spPr></p:sp>` +
          `<p:sp><p:nvSpPr><p:cNvPr id="4" name="R2"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="3500000" y="3000000"/><a:ext cx="1828800" cy="914400"/></a:xfrm><a:prstGeom prst="rect"/><a:solidFill><a:schemeClr val="accent1"><a:lumMod val="60000"/></a:schemeClr></a:solidFill></p:spPr></p:sp>` +
          `</p:spTree></p:cSld></p:sld>`);
        zip.file('ppt/slides/_rels/slide1.xml.rels', rels('<Relationship Id="rId1" Type="slideLayout" Target="../slideLayouts/slideLayout1.xml"/>'));

        // Layout: el marcador de título lleva la geometría (off 914400,457200 = 96,48 px).
        zip.file('ppt/slideLayouts/slideLayout1.xml', `<?xml version="1.0"?><p:sldLayout xmlns:p="${NS_P}" xmlns:a="${NS_A}"><p:cSld><p:spTree>` +
          `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title PH"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="914400" y="457200"/><a:ext cx="7315200" cy="1143000"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:p/></p:txBody></p:sp>` +
          `</p:spTree></p:cSld></p:sldLayout>`);
        zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', rels('<Relationship Id="rId1" Type="slideMaster" Target="../slideMasters/slideMaster1.xml"/>'));

        // Master: clrMap (bg1→lt1, tx1→dk1, …).
        zip.file('ppt/slideMasters/slideMaster1.xml', `<?xml version="1.0"?><p:sldMaster xmlns:p="${NS_P}" xmlns:a="${NS_A}"><p:cSld><p:spTree/></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:sldMaster>`);
        zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', rels('<Relationship Id="rId1" Type="theme" Target="../theme/theme1.xml"/>'));

        // Tema: accent1=4472C4, lt1=F2F2F2 (distinto de blanco para ver el fondo).
        zip.file('ppt/theme/theme1.xml', `<?xml version="1.0"?><a:theme xmlns:a="${NS_A}"><a:themeElements><a:clrScheme name="X">` +
          `<a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="F2F2F2"/></a:lt1>` +
          `<a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>` +
          `<a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2>` +
          `<a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4>` +
          `<a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6>` +
          `<a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink>` +
          `</a:clrScheme></a:themeElements></a:theme>`);

        const buf = await zip.generateAsync({ type: 'arraybuffer' });
        const deck = await importPptx(buf);
        const s0 = deck.slides[0] || { objects: [] };
        const objs: any[] = s0.objects || [];
        const title = objs.find((o) => o.type === 'textbox' && /Titulo foraneo/.test(o.text || ''));
        const rects = objs.filter((o) => o.type === 'rect');
        const fills = rects.map((r) => String(r.fill || '').toUpperCase());

        const { StaticCanvas } = await import('fabric');
        let loadable = false;
        try { const c = new StaticCanvas(document.createElement('canvas'), { width: 960, height: 540 }); await c.loadFromJSON({ version: '7', objects: objs }); loadable = c.getObjects().length === objs.length; c.dispose(); } catch { loadable = false; }

        const checks: Record<string, boolean> = {
          oneSlide: deck.slides.length === 1,
          ratio169: deck.ratio === '16:9',
          titleText: !!title,
          // Geometría HEREDADA del layout (sin xfrm propio): 96,48 px.
          titleInheritsGeometry: !!title && Math.abs((title.left ?? -999) - 96) < 6 && Math.abs((title.top ?? -999) - 48) < 6,
          // schemeClr accent1 resuelto al TEMA real (no al fallback #2563EB).
          themeAccentResolved: fills.includes('#4472C4'),
          // lumMod aplicado → un tono distinto del base y de cualquier fallback.
          colorModifierApplied: fills.some((f) => /^#[0-9A-F]{6}$/.test(f) && !['#4472C4', '#2563EB', '#3B82F6'].includes(f)),
          // Fondo por schemeClr bg1 → clrMap → lt1 = #F2F2F2.
          backgroundFromTheme: String(s0.background || '').toUpperCase() === '#F2F2F2',
          loadable,
        };
        const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
        if (active) setResult({ pass: failed.length === 0, failed, checks, fills, titlePos: title ? { left: Math.round(title.left), top: Math.round(title.top) } : null });
      } catch (e: any) {
        if (active) setResult({ pass: false, error: String(e?.message || e) });
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: 'monospace' }}>
      <h1>PPTX foreign-import harness</h1>
      <div data-testid="fi-status">{result ? (result.pass ? 'PASS' : 'FAIL') : 'RUNNING'}</div>
      <pre data-testid="fi-result">{result ? JSON.stringify(result, null, 2) : ''}</pre>
    </div>
  );
}
