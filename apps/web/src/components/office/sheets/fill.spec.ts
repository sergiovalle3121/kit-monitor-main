/* eslint-disable @typescript-eslint/no-explicit-any */
/** Spec de rellenar series y transponer. npx tsx src/components/office/sheets/fill.spec.ts */
import { fillSeries, applyFill, transposeRange, rawOf } from '@/lib/office/sheetOps';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };
const cell = (r: number, c: number, v: any) => ({ r, c, v: { v, m: String(v), ct: { fa: 'General', t: typeof v === 'number' ? 'n' : 's' } } });
const at = (sheet: any, r: number, c: number) => { const cd = sheet.celldata.find((x: any) => x.r === r && x.c === c); return cd ? rawOf(cd) : null; };

// ── fillSeries ───────────────────────────────────────────────────────────────
eq(fillSeries([1, 2, 3], 2), [4, 5], 'aritmética paso 1');
eq(fillSeries([2, 4], 3), [6, 8, 10], 'aritmética paso 2');
eq(fillSeries([5], 2), [6, 7], 'semilla única → paso 1');
eq(fillSeries(['enero', 'febrero'], 2), ['marzo', 'abril'], 'meses');
eq(fillSeries(['Enero'], 2), ['Febrero', 'Marzo'], 'meses con mayúscula');
eq(fillSeries(['lunes'], 1), ['martes'], 'días de la semana');
eq(fillSeries(['2026-01-01', '2026-01-02'], 2), ['2026-01-03', '2026-01-04'], 'fechas paso 1 día');
eq(fillSeries(['Item 1'], 2), ['Item 2', 'Item 3'], 'texto con número');
eq(fillSeries(['Q1'], 1), ['Q2'], 'prefijo + número');
eq(fillSeries(['a', 'b'], 3), ['a', 'b', 'a'], 'repite patrón cuando no hay serie');

// ── applyFill hacia abajo ────────────────────────────────────────────────────
{
  const sheet: any = { celldata: [cell(0, 0, 1), cell(1, 0, 2)] };
  const n = applyFill(sheet, { seedRange: 'A1:A2', direction: 'down', count: 2 });
  eq(n, 2, 'escribe 2 celdas');
  eq(at(sheet, 2, 0), 3, 'A3 = 3');
  eq(at(sheet, 3, 0), 4, 'A4 = 4');
}

// ── transposeRange ───────────────────────────────────────────────────────────
{
  const sheet: any = { celldata: [cell(0, 0, 1), cell(0, 1, 2), cell(1, 0, 3), cell(1, 1, 4)] };
  transposeRange(sheet, 'A1:B2', 'D1');
  eq(at(sheet, 0, 3), 1, 'D1 = 1');
  eq(at(sheet, 0, 4), 3, 'E1 = 3 (transpuesto)');
  eq(at(sheet, 1, 3), 2, 'D2 = 2 (transpuesto)');
  eq(at(sheet, 1, 4), 4, 'E2 = 4');
}

console.log(`\nFILL SPEC: ${passed} OK, ${fails.length} fallos`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} fallos`); }
console.log('✓ Todas las aserciones de rellenar/transponer pasan.');
