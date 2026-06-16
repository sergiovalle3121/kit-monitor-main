/* eslint-disable @typescript-eslint/no-explicit-any */
/** Spec de formato condicional (barras de datos, comparación). npx tsx … */
import { applyConditional } from '@/lib/office/sheetOps';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (a === b) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };
const cell = (r: number, c: number, v: any) => ({ r, c, v: { v, m: String(v), ct: { fa: 'General', t: typeof v === 'number' ? 'n' : 's' } } });
const at = (sheet: any, r: number, c: number) => sheet.celldata.find((x: any) => x.r === r && x.c === c)?.v;

// ── Barras de datos ──────────────────────────────────────────────────────────
{
  const sheet: any = { celldata: [cell(0, 0, 0), cell(1, 0, 5), cell(2, 0, 10)] };
  applyConditional(sheet, { kind: 'databar', range: 'A1:A3', sheetIndex: 0, color: '#3b82f6' } as any);
  eq(at(sheet, 0, 0).m, '░░░░░░░░░░ 0', 'mín → barra vacía');
  eq(at(sheet, 1, 0).m, '█████░░░░░ 5', 'medio → media barra');
  eq(at(sheet, 2, 0).m, '██████████ 10', 'máx → barra llena');
  eq(at(sheet, 2, 0).fc, '#3b82f6', 'color de barra');
  // Reaplicar es idempotente (no acumula barras).
  applyConditional(sheet, { kind: 'databar', range: 'A1:A3', sheetIndex: 0, color: '#3b82f6' } as any);
  eq(at(sheet, 1, 0).m, '█████░░░░░ 5', 'reaplicar idempotente');
}

// ── Comparación + limpiar ────────────────────────────────────────────────────
{
  const sheet: any = { celldata: [cell(0, 0, 3), cell(1, 0, 8)] };
  applyConditional(sheet, { kind: 'compare', range: 'A1:A2', sheetIndex: 0, op: '>', value: '5', color: '#dcfce7' } as any);
  ok(at(sheet, 0, 0).bg == null, '3 no cumple > 5');
  eq(at(sheet, 1, 0).bg, '#dcfce7', '8 cumple > 5 → relleno');
  applyConditional(sheet, { kind: 'clear', range: 'A1:A2', sheetIndex: 0 } as any);
  ok(at(sheet, 1, 0).bg == null, 'limpiar quita el relleno');
}

// ── Entre / No entre ─────────────────────────────────────────────────────────
{
  const sheet: any = { celldata: [cell(0, 0, 5), cell(1, 0, 15), cell(2, 0, 25)] };
  applyConditional(sheet, { kind: 'compare', range: 'A1:A3', sheetIndex: 0, op: 'between', value: '10', value2: '20', color: '#dcfce7' } as any);
  ok(at(sheet, 0, 0).bg == null, '5 fuera de [10,20]');
  eq(at(sheet, 1, 0).bg, '#dcfce7', '15 dentro de [10,20]');
  ok(at(sheet, 2, 0).bg == null, '25 fuera de [10,20]');
}

// ── Reglas de texto: empieza por / termina en / no contiene ──────────────────
{
  const sheet: any = { celldata: [cell(0, 0, 'Manzana'), cell(1, 0, 'Mandarina'), cell(2, 0, 'Pera')] };
  applyConditional(sheet, { kind: 'compare', range: 'A1:A3', sheetIndex: 0, op: 'beginsWith', value: 'Man', color: '#dbeafe' } as any);
  eq(at(sheet, 0, 0).bg, '#dbeafe', 'Manzana empieza por Man');
  eq(at(sheet, 1, 0).bg, '#dbeafe', 'Mandarina empieza por Man');
  ok(at(sheet, 2, 0).bg == null, 'Pera no empieza por Man');

  const sheet2: any = { celldata: [cell(0, 0, 'informe.pdf'), cell(1, 0, 'hoja.xlsx')] };
  applyConditional(sheet2, { kind: 'compare', range: 'A1:A2', sheetIndex: 0, op: 'endsWith', value: '.pdf', color: '#fee2e2' } as any);
  eq(at(sheet2, 0, 0).bg, '#fee2e2', 'termina en .pdf');
  ok(at(sheet2, 1, 0).bg == null, 'no termina en .pdf');

  const sheet3: any = { celldata: [cell(0, 0, 'ok'), cell(1, 0, 'error: x')] };
  applyConditional(sheet3, { kind: 'compare', range: 'A1:A2', sheetIndex: 0, op: 'notcontains', value: 'error', color: '#dcfce7' } as any);
  eq(at(sheet3, 0, 0).bg, '#dcfce7', '«ok» no contiene error');
  ok(at(sheet3, 1, 0).bg == null, '«error: x» sí contiene error');
}

// ── Valores únicos (complemento de duplicados) ───────────────────────────────
{
  const sheet: any = { celldata: [cell(0, 0, 'a'), cell(1, 0, 'b'), cell(2, 0, 'a'), cell(3, 0, 'c')] };
  applyConditional(sheet, { kind: 'unique', range: 'A1:A4', sheetIndex: 0, color: '#dcfce7' } as any);
  ok(at(sheet, 0, 0).bg == null, '«a» duplicado, no único');
  eq(at(sheet, 1, 0).bg, '#dcfce7', '«b» único');
  ok(at(sheet, 2, 0).bg == null, '«a» duplicado, no único (2)');
  eq(at(sheet, 3, 0).bg, '#dcfce7', '«c» único');
}

console.log(`\nCOND SPEC: ${passed} OK, ${fails.length} fallos`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} fallos`); }
console.log('✓ Todas las aserciones de formato condicional pasan.');
