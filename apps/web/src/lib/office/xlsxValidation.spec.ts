/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Export de VALIDACIÓN DE DATOS al .xlsx (ExcelJS):
 *   cd apps/web && npx tsx src/lib/office/xlsxValidation.spec.ts
 * Construye una hoja con dataVerification (lista, número, fecha, longitud), escribe bytes reales y los
 * REABRE con ExcelJS para confirmar que las reglas de validación viajan al .xlsx (lo que el writer no hacía).
 */
import ExcelJS from 'exceljs';
import { dataValidationFor, styledXlsxBuffer } from './xlsxStyled';

let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };

// ── Mapeo puro ──
{ const v = dataValidationFor({ type: 'dropdown', value1: 'Alta,Media,Baja', hintShow: true, hintText: 'Elige una' });
  ok(v.type === 'list' && v.formulae[0] === '"Alta,Media,Baja"', 'lista literal');
  ok(v.showInputMessage === true && v.prompt === 'Elige una', 'mensaje de entrada'); }
{ const v = dataValidationFor({ type: 'number_integer', type2: 'between', value1: '1', value2: '10', prohibitInput: true });
  ok(v.type === 'whole' && v.operator === 'between' && v.formulae[0] === '1' && v.formulae[1] === '10', 'entero entre 1 y 10');
  ok(v.errorStyle === 'stop', 'rechazo (stop)'); }
{ const v = dataValidationFor({ type: 'number_decimal', type2: 'greaterOrEqualTo', value1: '0' });
  ok(v.type === 'decimal' && v.operator === 'greaterThanOrEqual' && v.formulae.length === 1, 'decimal ≥ 0 (un solo valor)'); }
{ const v = dataValidationFor({ type: 'date', type2: 'laterThan', value1: '2024-01-01' });
  ok(v.type === 'date' && v.operator === 'greaterThan', 'fecha posterior'); }
{ const v = dataValidationFor({ type: 'text_length', type2: 'lessThanOrEqualTo', value1: '20' });
  ok(v.type === 'textLength' && v.operator === 'lessThanOrEqual', 'longitud ≤ 20'); }
{ const v = dataValidationFor({ type: 'custom_formula', value1: '=AND(VALUE>=0,VALUE<=100)' });
  ok(v.type === 'custom' && v.formulae[0] === 'AND(VALUE>=0,VALUE<=100)', 'fórmula personalizada segura'); }
ok(dataValidationFor({ type: 'text_content' }) === null, 'text_content sin equivalente → null');
ok(dataValidationFor(null) === null, 'null → null');

// ── Round-trip real ──
const cell = (v: any) => ({ v, m: String(v ?? ''), ct: { fa: 'General', t: typeof v === 'number' ? 'n' : 's' } });
const sheets = [{
  name: 'Form',
  celldata: [{ r: 0, c: 0, v: cell('Prioridad') }],
  dataVerification: {
    '1_0': { type: 'dropdown', value1: 'Alta,Media,Baja', remote: false, hintShow: true, hintText: 'Elige' },
    '1_1': { type: 'number_integer', type2: 'between', value1: '1', value2: '5', prohibitInput: true },
    '1_2': { type: 'date', type2: 'noEarlierThan', value1: '2024-01-01' },
    '1_3': { type: 'custom_formula', value1: '=AND(VALUE>=0,VALUE<=100)' },
  },
}];

(async () => {
  const buf = await styledXlsxBuffer(ExcelJS, sheets as any);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const ws = wb.getWorksheet('Form')!;

  const a2 = ws.getCell('A2').dataValidation as any;
  ok(!!a2 && a2.type === 'list', 'A2 conserva la lista');
  ok(a2.formulae[0] === '"Alta,Media,Baja"', 'A2 lleva las opciones');
  ok(a2.prompt === 'Elige', 'A2 conserva el mensaje');
  const b2 = ws.getCell('B2').dataValidation as any;
  ok(!!b2 && b2.type === 'whole' && b2.operator === 'between', 'B2 conserva entero entre');
  ok(b2.formulae[0] == 1 && b2.formulae[1] == 5, 'B2 con sus límites');
  const c2 = ws.getCell('C2').dataValidation as any;
  ok(!!c2 && c2.type === 'date' && c2.operator === 'greaterThanOrEqual', 'C2 conserva fecha ≥');

  const d2 = ws.getCell('D2').dataValidation as any;
  ok(!!d2 && d2.type === 'custom' && d2.formulae[0] === 'AND(VALUE>=0,VALUE<=100)', 'D2 conserva fórmula personalizada');

  const total = passed + fails.length;
  if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
  else console.log(`✅ ${passed}/${total}`);
})().catch((e) => { console.error(e); process.exit(1); });
