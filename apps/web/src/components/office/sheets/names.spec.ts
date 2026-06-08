/* eslint-disable @typescript-eslint/no-explicit-any */
/** Spec de rangos con nombre. npx tsx src/components/office/sheets/names.spec.ts */
import { validateRangeName, qualifiedRef, resolveNamedRange } from '@/lib/office/sheetOps';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };

// validateRangeName
eq(validateRangeName('Ventas', []), null, 'nombre válido');
eq(validateRangeName('total_2024', []), null, 'con _ y dígitos');
ok(!!validateRangeName('', []), 'vacío inválido');
ok(!!validateRangeName('A1', []), 'forma de celda inválida');
ok(!!validateRangeName('1abc', []), 'empieza con dígito inválido');
ok(!!validateRangeName('mi nombre', []), 'espacio inválido');
ok(!!validateRangeName('Ventas', ['ventas']), 'duplicado (case-insensitive)');

// qualifiedRef
eq(qualifiedRef({ name: 'x', range: 'A1:A10', sheetIndex: 0 }, ['Hoja 1']), "'Hoja 1'!A1:A10", 'hoja con espacio → entrecomillada');
eq(qualifiedRef({ name: 'x', range: 'A1:A10', sheetIndex: 0 }, ['Datos']), 'Datos!A1:A10', 'hoja simple sin comillas');

// resolveNamedRange
eq(resolveNamedRange('Ventas', [{ name: 'Ventas', range: 'B2:B9', sheetIndex: 1 }], 0), { range: 'B2:B9', sheetIndex: 1 }, 'resuelve por nombre');
eq(resolveNamedRange('A1:A5', [], 2), { range: 'A1:A5', sheetIndex: 2 }, 'A1 directo con hoja por defecto');
eq(resolveNamedRange('xyz', [], 0), null, 'ni nombre ni rango → null');

console.log(`\nNAMES SPEC: ${passed} OK, ${fails.length} fallos`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} fallos`); }
console.log('✓ Todas las aserciones de rangos con nombre pasan.');
