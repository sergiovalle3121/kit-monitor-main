import { columnIndexToName, columnNameToIndex, formatCellAddress, formatRangeAddress, normalizeSheetName, parseAbsoluteReference, parseCellAddress, parseRangeAddress, parseSheetReference } from './ranges';
let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };
const eq = (a: unknown, b: unknown, m: string) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`);
eq(columnNameToIndex('AA'), 26, 'AA -> 26');
eq(columnIndexToName(701), 'ZZ', '701 -> ZZ');
eq(parseCellAddress('$B$12'), { row: 11, col: 1, colAbsolute: true, rowAbsolute: true }, 'parsea celda absoluta');
eq(formatCellAddress({ row: 0, col: 0 }), 'A1', 'formatea A1');
eq(formatRangeAddress(parseRangeAddress('C3:A1')!), 'C3:A1', 'formatea rango');
eq(parseAbsoluteReference('$A$1'), { row: 0, col: 0, colAbsolute: true, rowAbsolute: true }, 'parseAbsoluteReference');
eq(normalizeSheetName("'Line O''EE'"), "Line O'EE", 'normaliza sheet quote');
eq(parseSheetReference("'Line O''EE'!$A$1:$B$2")?.sheetName, "Line O'EE", 'parsea sheet con espacio');
eq(parseSheetReference('Sheet1!A1')?.address, 'A1', 'parsea sheet ref simple');
ok(parseCellAddress('A0') === null, 'rechaza fila cero');
const total = passed + fails.length;
if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
else console.log(`✅ ${passed}/${total}`);
