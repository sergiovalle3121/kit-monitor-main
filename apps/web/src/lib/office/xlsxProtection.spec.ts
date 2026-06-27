/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Export de PROTECCIÓN DE HOJA al .xlsx (ExcelJS):
 *   cd apps/web && npx tsx src/lib/office/xlsxProtection.spec.ts
 * Una hoja con `protection.enabled` debe exportarse protegida (se abre bloqueada en Excel).
 */
import ExcelJS from 'exceljs';
import { axosProtectOptionsFor, protectOptionsFor, styledXlsxBuffer, readStylesIntoSheets } from './xlsxStyled';

let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };

// ── Mapeo puro ──
ok(protectOptionsFor(null) === null, 'sin protección → null');
ok(protectOptionsFor({ enabled: false }) === null, 'enabled=false → null');
{ const po = protectOptionsFor({ enabled: true })!;
  ok(po.password === '' && po.options.selectLockedCells === true && po.options.selectUnlockedCells === true, 'por defecto: seleccionar permitido');
  ok(po.options.formatCells === false && po.options.insertRows === false, 'por defecto: editar bloqueado'); }
{ const po = protectOptionsFor({ enabled: true, password: 'x', insertRows: true, sort: true })!;
  ok(po.password === 'x', 'contraseña'); ok(po.options.insertRows === true && po.options.sort === true, 'permisos concedidos'); }
ok(axosProtectOptionsFor(null) === null, 'axos: sin protección → null');
ok(axosProtectOptionsFor({ ranges: [{ range: 'B2:C3', locked: true }] })?.options.insertRows === false, 'axos: rango bloqueado protege hoja');
ok(axosProtectOptionsFor({ ranges: [{ range: 'B2:C3', locked: false }] }) === null, 'axos: rango editable no protege hoja');

// ── Round-trip real ──
const cell = (v: any) => ({ v, m: String(v ?? ''), ct: { fa: 'General', t: typeof v === 'number' ? 'n' : 's' } });
const sheets = [
  { name: 'Bloqueada', celldata: [{ r: 0, c: 0, v: cell('no editable') }], protection: { enabled: true, sort: true } },
  { name: 'Libre', celldata: [{ r: 0, c: 0, v: cell('editable') }] },
  { name: 'AxosRange', celldata: [{ r: 0, c: 0, v: cell('editable') }, { r: 1, c: 1, v: cell('locked') }], axosProtection: { ranges: [{ range: 'B2:C3', locked: true }] } },
];

(async () => {
  const buf = await styledXlsxBuffer(ExcelJS, sheets as any);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const prot = wb.getWorksheet('Bloqueada') as any;
  const free = wb.getWorksheet('Libre') as any;
  const axos = wb.getWorksheet('AxosRange') as any;
  ok(prot.sheetProtection && prot.sheetProtection.sheet === true, 'la hoja protegida sale bloqueada');
  ok(prot.getCell('A1').value === 'no editable', 'la protección no pierde el valor');
  ok(!free.sheetProtection || free.sheetProtection.sheet !== true, 'la hoja libre NO está protegida');
  ok(axos.sheetProtection && axos.sheetProtection.sheet === true, 'axos: el rango protegido activa protección de hoja');
  ok(axos.getCell('A1').protection?.locked === false, 'axos: celdas fuera de rango quedan editables');
  ok(axos.getCell('B2').protection?.locked !== false, 'axos: celdas dentro de rango quedan bloqueadas');

  // ── Round-trip de IMPORT: un .xlsx protegido sigue protegido al releer ──
  const reimported: any[] = [{ name: 'Bloqueada', celldata: [] }, { name: 'Libre', celldata: [] }];
  await readStylesIntoSheets(ExcelJS, buf, reimported);
  ok(reimported[0].protection && reimported[0].protection.enabled === true, 'import: la hoja protegida vuelve marcada');
  ok(reimported[0].protection.sort === true, 'import: conserva el permiso de ordenar');
  ok(!reimported[1].protection, 'import: la hoja libre no trae protección');

  const total = passed + fails.length;
  if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
  else console.log(`✅ ${passed}/${total}`);
})().catch((e) => { console.error(e); process.exit(1); });
