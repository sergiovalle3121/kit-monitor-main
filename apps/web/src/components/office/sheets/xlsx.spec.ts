/* eslint-disable @typescript-eslint/no-explicit-any */
/** Spec del puente .xlsx: mapeo puro + round-trip real con SheetJS. npx tsx … */
import * as XLSX from 'xlsx';
import { cellToXlsx, xlsxToFortuneV, fortuneToWs, wsToFortune, namesToDefined, definedToNames } from '@/lib/office/xlsx';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };

// ── Mapeo puro Fortune → SheetJS ─────────────────────────────────────────────
eq(cellToXlsx({ v: 5, ct: { fa: 'General', t: 'n' } }), { t: 'n', v: 5 }, 'número');
eq(cellToXlsx({ v: 0.5, ct: { fa: '0.00%', t: 'n' } }), { t: 'n', v: 0.5, z: '0.00%' }, 'número con formato');
eq(cellToXlsx({ v: 3, f: '=A1+A2', ct: { fa: 'General' } }), { t: 'n', v: 3, f: 'A1+A2' }, 'fórmula');
eq(cellToXlsx({ v: 'hola', ct: { fa: 'General', t: 's' } }), { t: 's', v: 'hola' }, 'texto');
eq(cellToXlsx({ v: true }), { t: 'b', v: true }, 'booleano');
eq(cellToXlsx({ v: null }), null, 'vacío sin fórmula → null');

// ── Mapeo puro SheetJS → Fortune ─────────────────────────────────────────────
{
  const fv = xlsxToFortuneV({ t: 'n', v: 0.5, z: '0.00%', w: '50.00%' });
  eq(fv.v, 0.5, 'valor'); eq(fv.m, '50.00%', 'display w'); eq(fv.ct.fa, '0.00%', 'formato');
  eq(xlsxToFortuneV({ t: 'n', v: 3, f: 'A1+A2' }).f, '=A1+A2', 'fórmula con =');
}

// ── Round-trip real a través de SheetJS (escribir + leer) ────────────────────
{
  const sheet: any = {
    name: 'Datos',
    celldata: [
      { r: 0, c: 0, v: { v: 'Mes', m: 'Mes', ct: { fa: 'General', t: 's' } } },
      { r: 0, c: 1, v: { v: 'Importe', m: 'Importe', ct: { fa: 'General', t: 's' } } },
      { r: 1, c: 0, v: { v: 'Ene', m: 'Ene', ct: { fa: 'General', t: 's' } } },
      { r: 1, c: 1, v: { v: 1234.5, m: '1234.5', ct: { fa: '$#,##0.00', t: 'n' } } },
      { r: 2, c: 1, v: { v: 0, m: '0', f: '=SUM(B2:B2)', ct: { fa: 'General', t: 'n' } } },
    ],
    config: { merge: { '0_0': { r: 0, c: 0, rs: 1, cs: 2 } }, columnlen: { 0: 120 } },
  };
  const ws = fortuneToWs(XLSX, sheet);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const wb2 = XLSX.read(buf, { type: 'array', cellFormula: true, cellNF: true });
  const back = wsToFortune(XLSX, wb2.Sheets['Datos'], 'Datos', 0);

  const find = (r: number, c: number) => back.celldata!.find((x: any) => x.r === r && x.c === c)?.v as any;
  eq(find(1, 1).v, 1234.5, 'round-trip valor numérico');
  eq(find(1, 1).ct.fa, '$#,##0.00', 'round-trip formato de número');
  eq(find(2, 1).f, '=SUM(B2:B2)', 'round-trip fórmula');
  ok(!!back.config.merge && Object.keys(back.config.merge).length === 1, 'round-trip combinación');
}

// ── Anchos de columna: cada dirección por separado ────────────────────────────
// (SheetJS CE no garantiza conservar `wpx` tras escribir+leer; sí el mapeo directo.)
{
  const ws = fortuneToWs(XLSX, { celldata: [{ r: 0, c: 0, v: { v: 1 } }], config: { columnlen: { 0: 120 } } } as any);
  eq(ws['!cols'][0].wpx, 120, 'fortuneToWs escribe wpx');
  const back = wsToFortune(XLSX, { '!ref': 'A1', '!cols': [{ wpx: 90 }] }, 'x', 0);
  eq(back.config.columnlen, { 0: 90 }, 'wsToFortune lee wpx');
}

// ── Altos de fila: mapeo directo en cada dirección ────────────────────────────
{
  const ws = fortuneToWs(XLSX, { celldata: [{ r: 0, c: 0, v: { v: 1 } }], config: { rowlen: { 0: 40 } } } as any);
  eq(ws['!rows'][0].hpx, 40, 'fortuneToWs escribe hpx');
  const back = wsToFortune(XLSX, { '!ref': 'A1', '!rows': [{ hpx: 30 }] }, 'x', 0);
  eq(back.config.rowlen, { 0: 30 }, 'wsToFortune lee hpx');
}

// ── Nombres definidos: mapeo puro y round-trip ────────────────────────────────
{
  const names = [{ name: 'Ventas', range: 'A1:A10', sheetIndex: 0 }, { name: 'Tasa', range: 'B2', sheetIndex: 1 }];
  const defined = namesToDefined(names, ['Datos', 'Mi Hoja']);
  eq(defined[0], { Name: 'Ventas', Ref: 'Datos!$A$1:$A$10' }, 'nombre → Ref absoluta');
  eq(defined[1], { Name: 'Tasa', Ref: "'Mi Hoja'!$B$2" }, 'nombre con hoja entrecomillada');
  eq(definedToNames(defined, ['Datos', 'Mi Hoja']), names, 'Ref → NamedRange (round-trip puro)');
  // Descarta nombres que en realidad son fórmulas/constantes (no rangos A1).
  eq(definedToNames([{ Name: 'IVA', Ref: '0.16' }], ['Datos']).length, 0, 'ignora nombre-constante');
}

// ── Round-trip REAL multi-hoja: fórmula ENTRE HOJAS + nombre definido ──────────
{
  const datos: any = { name: 'Datos', celldata: [
    { r: 0, c: 0, v: { v: 10, ct: { fa: 'General', t: 'n' } } },
    { r: 1, c: 0, v: { v: 20, ct: { fa: 'General', t: 'n' } } },
  ], config: {} };
  const resumen: any = { name: 'Resumen', celldata: [
    { r: 0, c: 0, v: { v: 0, f: '=SUM(Datos!A1:A2)', ct: { fa: 'General', t: 'n' } } },
    { r: 1, c: 0, v: { v: 0, f: '=Datos!A1*2', ct: { fa: 'General', t: 'n' } } },
  ], config: {} };
  const wb: any = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, fortuneToWs(XLSX, datos), 'Datos');
  XLSX.utils.book_append_sheet(wb, fortuneToWs(XLSX, resumen), 'Resumen');
  wb.Workbook = { Names: namesToDefined([{ name: 'Entradas', range: 'A1:A2', sheetIndex: 0 }], ['Datos', 'Resumen']) };
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const wb2: any = XLSX.read(buf, { type: 'array', cellFormula: true, cellNF: true });
  ok(wb2.SheetNames.length === 2, 'round-trip: 2 hojas');
  const back1 = wsToFortune(XLSX, wb2.Sheets['Datos'], 'Datos', 0);
  const back2 = wsToFortune(XLSX, wb2.Sheets['Resumen'], 'Resumen', 1);
  const find = (s: any, r: number, c: number) => s.celldata!.find((x: any) => x.r === r && x.c === c)?.v as any;
  eq(find(back1, 1, 0).v, 20, 'round-trip: valor en hoja 1');
  eq(find(back2, 0, 0).f, '=SUM(Datos!A1:A2)', 'round-trip: fórmula entre hojas (SUM)');
  eq(find(back2, 1, 0).f, '=Datos!A1*2', 'round-trip: referencia entre hojas');
  eq(definedToNames(wb2.Workbook?.Names, ['Datos', 'Resumen']), [{ name: 'Entradas', range: 'A1:A2', sheetIndex: 0 }], 'round-trip: nombre definido');
}

console.log(`\nXLSX SPEC: ${passed} OK, ${fails.length} fallos`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} fallos`); }
console.log('✓ Todas las aserciones de .xlsx pasan.');
