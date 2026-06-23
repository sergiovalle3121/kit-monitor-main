import { lossBreakdown } from './oee-losses';

describe('lossBreakdown (F-Q1 · desglose de pérdidas de OEE)', () => {
  it('hace que OEE + las pérdidas sumen 100 puntos', () => {
    const r = lossBreakdown({ availability: 0.9, performance: 0.95, quality: 0.99 });
    const sum = r.oeePct + r.losses.reduce((s, l) => s + l.oeePoints, 0);
    expect(Math.round(sum)).toBe(100);
    expect(Math.round(r.oeePct + r.totalLossPct)).toBe(100);
  });

  it('ordena las pérdidas de mayor a menor (Pareto) con % acumulado hasta 100', () => {
    const r = lossBreakdown({
      availability: 0.8, performance: 0.9, quality: 0.95,
      downtimeByReason: { EQUIPMENT: 40, CHANGEOVER: 10 },
    });
    for (let i = 1; i < r.losses.length; i++) {
      expect(r.losses[i - 1].oeePoints).toBeGreaterThanOrEqual(r.losses[i].oeePoints);
    }
    expect(r.losses[r.losses.length - 1].cumulativePct).toBeCloseTo(100, 0);
  });

  it('una línea perfecta no tiene pérdidas (OEE 100)', () => {
    const r = lossBreakdown({ availability: 1, performance: 1, quality: 1 });
    expect(r.oeePct).toBe(100);
    expect(r.losses).toEqual([]);
    expect(r.biggest).toBeNull();
    expect(r.totalLossPct).toBe(0);
  });

  it('reparte la pérdida de disponibilidad por razón de paro', () => {
    const r = lossBreakdown({
      availability: 0.7, performance: 1, quality: 1,
      downtimeByReason: { EQUIPMENT: 30, CHANGEOVER: 10 },
    });
    const averias = r.losses.find((l) => l.key === 'down:EQUIPMENT')!;
    const cambios = r.losses.find((l) => l.key === 'down:CHANGEOVER')!;
    expect(averias.label).toBe('Averías de equipo');
    expect(cambios.label).toBe('Cambios y ajustes');
    // 30:10 → averías recibe 3× la pérdida de cambios (total 30 puntos)
    expect(averias.oeePoints).toBeCloseTo(22.5, 1);
    expect(cambios.oeePoints).toBeCloseTo(7.5, 1);
    expect(r.biggest!.key).toBe('down:EQUIPMENT');
  });

  it('usa un solo bucket de paros cuando no hay detalle de razones', () => {
    const r = lossBreakdown({ availability: 0.8, performance: 1, quality: 1 });
    expect(r.losses).toHaveLength(1);
    expect(r.losses[0]).toMatchObject({ key: 'down', category: 'disponibilidad' });
    expect(r.losses[0].oeePoints).toBeCloseTo(20, 1);
  });

  it('identifica la calidad como pérdida dominante cuando Q es baja', () => {
    const r = lossBreakdown({ availability: 0.98, performance: 0.98, quality: 0.6 });
    expect(r.biggest!.key).toBe('defects');
    expect(r.biggest!.label).toBe('Defectos y retrabajo');
  });

  it('es segura con entradas nulas/cero (sin NaN ni excepciones)', () => {
    const r = lossBreakdown({ availability: 0, performance: 0, quality: 0 });
    expect(r.oeePct).toBe(0);
    expect(Number.isFinite(r.totalLossPct)).toBe(true);
    expect(r.losses.every((l) => Number.isFinite(l.oeePoints))).toBe(true);
    const garbage = lossBreakdown({ availability: NaN, performance: 2, quality: -1 } as never);
    expect(Number.isFinite(garbage.oeePct)).toBe(true);
  });
});
