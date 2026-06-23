import { BadRequestException } from '@nestjs/common';
import { assertSpecLimits, describeMeasurements } from './spc-math';

describe('assertSpecLimits (USL > nominal > LSL)', () => {
  it('acepta una ventana válida USL > nominal > LSL', () => {
    expect(() =>
      assertSpecLimits({ type: 'VARIABLE', nominal: 10, usl: 10.2, lsl: 9.8 }),
    ).not.toThrow();
  });

  it('rechaza USL <= LSL', () => {
    expect(() =>
      assertSpecLimits({ type: 'VARIABLE', usl: 9.8, lsl: 10.2 }),
    ).toThrow(BadRequestException);
  });

  it('rechaza USL <= nominal', () => {
    expect(() =>
      assertSpecLimits({ type: 'VARIABLE', nominal: 10, usl: 9 }),
    ).toThrow(BadRequestException);
  });

  it('rechaza nominal <= LSL', () => {
    expect(() =>
      assertSpecLimits({ type: 'VARIABLE', nominal: 10, lsl: 11 }),
    ).toThrow(BadRequestException);
  });

  it('acepta ventanas parciales (sólo un límite presente)', () => {
    expect(() => assertSpecLimits({ type: 'VARIABLE', usl: 5 })).not.toThrow();
    expect(() => assertSpecLimits({ type: 'VARIABLE', lsl: 1 })).not.toThrow();
    expect(() =>
      assertSpecLimits({ type: 'VARIABLE', nominal: 3 }),
    ).not.toThrow();
  });

  it('no valida límites para características de ATRIBUTO', () => {
    // Aunque el orden sea "inválido" como variable, un atributo no tiene ventana.
    expect(() =>
      assertSpecLimits({ type: 'ATTRIBUTE', usl: 1, lsl: 5 }),
    ).not.toThrow();
  });
});

describe('describeMeasurements (resumen descriptivo)', () => {
  it('calcula n, media, σ muestral, min/max y % fuera de límites para un set conocido', () => {
    // Set conocido: media exacta = 10.0, σ muestral (n-1) = 0.2.
    // Fuera de límites (estricto): 9.7 < LSL y 10.3 > USL → 2 de 8 = 25%.
    const values = [9.8, 10.0, 10.1, 9.9, 10.2, 10.0, 9.7, 10.3];
    const s = describeMeasurements(values, { usl: 10.2, lsl: 9.8, nominal: 10 });

    expect(s.n).toBe(8);
    expect(s.mean).toBeCloseTo(10.0, 10);
    expect(s.std).toBeCloseTo(0.2, 10);
    expect(s.min).toBe(9.7);
    expect(s.max).toBe(10.3);
    expect(s.belowLsl).toBe(1);
    expect(s.aboveUsl).toBe(1);
    expect(s.outOfSpec).toBe(2);
    expect(s.pctOutOfSpec).toBeCloseTo(25, 10);
  });

  it('trata los valores exactamente en el límite como dentro de especificación', () => {
    const s = describeMeasurements([9.8, 10.2], { usl: 10.2, lsl: 9.8 });
    expect(s.outOfSpec).toBe(0);
    expect(s.pctOutOfSpec).toBe(0);
  });

  it('sólo cuenta el lado cuyo límite está presente', () => {
    const s = describeMeasurements([1, 2, 100], { usl: 10 }); // sin LSL
    expect(s.aboveUsl).toBe(1);
    expect(s.belowLsl).toBe(0);
    expect(s.outOfSpec).toBe(1);
  });

  it('set vacío → n=0 y métricas nulas, sin dividir por cero', () => {
    const s = describeMeasurements([], { usl: 10, lsl: 0 });
    expect(s.n).toBe(0);
    expect(s.mean).toBeNull();
    expect(s.std).toBeNull();
    expect(s.min).toBeNull();
    expect(s.max).toBeNull();
    expect(s.pctOutOfSpec).toBe(0);
  });

  it('n=1 → σ=0 (sin spread calculable)', () => {
    const s = describeMeasurements([7]);
    expect(s.n).toBe(1);
    expect(s.mean).toBe(7);
    expect(s.std).toBe(0);
  });

  it('ignora lecturas no numéricas (p.ej. atributos sin valor)', () => {
    const s = describeMeasurements([10, null, undefined, NaN as unknown as number, 12]);
    expect(s.n).toBe(2);
    expect(s.mean).toBe(11);
  });
});
