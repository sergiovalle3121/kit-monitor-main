'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Arnés de test (Fase 4, EMS-native): construye los mazos de revisión de línea y
 * de calidad con datos de muestra y verifica que tengan las diapositivas
 * esperadas, gráficos/tablas NATIVOS y que carguen en Fabric. Lo consume el spec
 * `e2e/golden/11-ems-deck-gen.spec.ts`. Solo desarrollo.
 */
import React, { useEffect, useState } from 'react';

export default function DeckGenHarness() {
  const [result, setResult] = useState<any>(process.env.NODE_ENV === 'production' ? { pass: false, skipped: true } : null);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    let active = true;
    (async () => {
      try {
        const { buildLineReviewDeck, buildQualityDeck } = await import('@/lib/office/deckGen');
        const { StaticCanvas } = await import('fabric');

        const line = buildLineReviewDeck({
          overall: 'Operación con alertas',
          kpis: { activeLines: 6, wip: 142, openAlerts: 2, materialRisk: 3, inventory: 88 },
          lines: [{ name: 'L1', model: 'MDL-A', status: 'activa' }, { name: 'L2', model: 'MDL-B', status: 'activa', bottleneck: true }],
          shortages: [{ partNumber: 'CMP-1', description: 'Resistor', severity: 'high' }],
          trend: [{ label: 'L', value: 3 }, { label: 'M', value: 5 }, { label: 'X', value: 4 }],
          alerts: [{ title: 'Riesgo de paro', severity: 'high', status: 'pending' }],
        });
        const qual = buildQualityDeck({
          period: 'Último año',
          kpis: { fpy: '96%', yieldPct: '98%', fails: 4, openNcr: 3, critical: 1, affected: 120 },
          pareto: [{ label: 'Soldadura', count: 8 }, { label: 'Ensamble', count: 5 }],
          trend: [{ label: 'ene', count: 2 }, { label: 'feb', count: 4 }],
          byModel: [{ label: 'MDL-A', count: 6 }, { label: 'MDL-B', count: 3 }],
          openNcrs: [{ ncrNumber: 'NCR-1', partNumber: 'P-1', model: 'MDL-A', severity: 'Crítica', affected: 10 }],
        });

        const hasType = (deck: any, pred: (o: any) => boolean) => deck.slides.some((s: any) => (s.objects || []).some(pred));
        async function loadable(deck: any): Promise<boolean> {
          for (const s of deck.slides) {
            const c = new StaticCanvas(document.createElement('canvas'), { width: 960, height: 540 });
            await c.loadFromJSON({ version: '7', objects: s.objects });
            const ok = c.getObjects().length === (s.objects || []).length;
            c.dispose();
            if (!ok) return false;
          }
          return true;
        }

        const checks: Record<string, boolean> = {
          lineVersion: line.version === 2,
          lineSlides: line.slides.length >= 5,
          lineTable: hasType(line, (o) => !!o.tableSpec),
          lineChart: hasType(line, (o) => !!o.chartSpec),
          lineText: hasType(line, (o) => o.type === 'textbox'),
          lineLoadable: await loadable(line),
          qualVersion: qual.version === 2,
          qualSlides: qual.slides.length >= 5,
          qualTable: hasType(qual, (o) => !!o.tableSpec),
          qualChart: hasType(qual, (o) => !!o.chartSpec),
          qualLoadable: await loadable(qual),
        };
        const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
        if (active) setResult({ pass: failed.length === 0, failed, checks, lineSlides: line.slides.length, qualSlides: qual.slides.length });
      } catch (e: any) {
        if (active) setResult({ pass: false, error: String(e?.message || e) });
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: 'monospace' }}>
      <h1>EMS deck-gen harness</h1>
      <div data-testid="dg-status">{result ? (result.pass ? 'PASS' : 'FAIL') : 'RUNNING'}</div>
      <pre data-testid="dg-result">{result ? JSON.stringify(result, null, 2) : ''}</pre>
    </div>
  );
}
