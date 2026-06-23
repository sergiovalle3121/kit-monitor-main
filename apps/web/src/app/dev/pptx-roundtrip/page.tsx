'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Arnés de test de fidelidad (Fase 2, round-trip .pptx). Construye un mazo con
 * un objeto de cada tipo soportado, lo exporta a .pptx en memoria y lo vuelve a
 * importar, comparando que sobreviva lo esencial. Lo consume el spec de
 * Playwright `e2e/golden/10-slides-pptx-roundtrip.spec.ts`. Solo desarrollo: en
 * producción no hace nada (no se envía como página útil).
 */
import React, { useEffect, useState } from 'react';

// PNG 1×1 (rojo) para probar el round-trip de imágenes embebidas.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export default function PptxRoundtripHarness() {
  const [result, setResult] = useState<any>(process.env.NODE_ENV === 'production' ? { pass: false, skipped: true } : null);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    let active = true;
    (async () => {
      try {
        const { pptxArrayBuffer } = await import('@/lib/office/pptx');
        const { importPptx } = await import('@/lib/office/pptxImport');
        const { buildTableGroup } = await import('@/components/office/slides/table');
        const { buildChartGroup } = await import('@/components/office/slides/chart');
        const { starPoints } = await import('@/components/office/slides/shapes');

        const table = buildTableGroup(
          { rows: 2, cols: 2, cells: [['A', 'B'], ['1', '2']], header: true, banded: true, accent: '#2563eb' },
          { left: 60, top: 330 },
        ).toObject(['tableSpec']);
        const chart = buildChartGroup(
          { type: 'bar', title: 'Demo', labels: ['Q1', 'Q2'], series: [{ name: 'S1', data: [3, 5] }] },
          { left: 540, top: 300, width: 360, height: 200 },
        ).toObject(['chartSpec']);

        const objects: any[] = [
          { type: 'textbox', version: '7', text: 'Título de prueba\n• punto uno\n• punto dos', left: 60, top: 50, width: 600, fontSize: 40, fontWeight: 'bold', fill: '#111827', fontFamily: 'Arial', textAlign: 'left' },
          { type: 'rect', version: '7', left: 60, top: 170, width: 200, height: 90, fill: '#3b82f6' },
          { type: 'ellipse', version: '7', left: 300, top: 170, rx: 90, ry: 50, fill: '#10b981' },
          { type: 'polygon', version: '7', left: 520, top: 150, fill: '#f59e0b', shape: 'star5', points: starPoints(5, 50, 20) },
          { type: 'image', version: '7', src: PNG, left: 800, top: 60, scaleX: 40, scaleY: 40 },
          table, chart,
        ];
        const deck = { version: 2, slides: [{ version: '7', objects, background: '#fef9c3' }], notes: ['Una nota del orador'], ratio: '16:9' };

        const buf = await pptxArrayBuffer(deck.slides, deck.notes, { ratio: deck.ratio });
        const back = await importPptx(buf);
        const s0 = back.slides[0] || { objects: [] };
        const find = (pred: (o: any) => boolean) => (s0.objects || []).find(pred);

        // El editor renderiza con Fabric loadFromJSON: comprobamos que el JSON
        // importado se cargue (mismo recuento de objetos) tal cual.
        let loadable = false;
        try {
          const { StaticCanvas } = await import('fabric');
          const c = new StaticCanvas(document.createElement('canvas'), { width: 960, height: 540 });
          await c.loadFromJSON({ version: '7', objects: s0.objects });
          loadable = c.getObjects().length === (s0.objects || []).length;
          c.dispose();
        } catch { loadable = false; }

        const checks: Record<string, boolean> = {
          oneSlide: back.slides.length === 1,
          title: !!find((o) => o.type === 'textbox' && /Título de prueba/.test(o.text || '')),
          bullets: !!find((o) => o.type === 'textbox' && /•\s*punto uno/.test(o.text || '')),
          rect: !!find((o) => o.type === 'rect'),
          ellipse: !!find((o) => o.type === 'ellipse' || o.type === 'circle'),
          star: !!find((o) => o.shape === 'star5'),
          image: !!find((o) => o.type === 'image'),
          table: !!find((o) => !!o.tableSpec),
          chart: !!find((o) => !!o.chartSpec),
          background: String(s0.background || '').toUpperCase().startsWith('#FEF9C3'),
          ratio: back.ratio === '16:9',
          notes: String(back.notes?.[0] || '').includes('Una nota'),
          loadable,
        };
        const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
        const types = (s0.objects || []).map((o: any) => `${o.type}${o.shape ? '/' + o.shape : ''}${o.tableSpec ? '/tbl' : ''}${o.chartSpec ? '/chart' : ''}`);
        if (active) setResult({ pass: failed.length === 0, failed, checks, objectCount: (s0.objects || []).length, types });
      } catch (e: any) {
        if (active) setResult({ pass: false, error: String(e?.message || e) });
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: 'monospace' }}>
      <h1>PPTX round-trip harness</h1>
      <div data-testid="rt-status">{result ? (result.pass ? 'PASS' : 'FAIL') : 'RUNNING'}</div>
      <pre data-testid="rt-result">{result ? JSON.stringify(result, null, 2) : ''}</pre>
    </div>
  );
}
