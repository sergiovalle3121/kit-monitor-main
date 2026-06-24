/* eslint-disable @typescript-eslint/no-explicit-any */
/** Spec del autofiltro nativo en su sitio. npx tsx src/components/office/sheets/autoFilter.spec.ts */
import { setAutoFilter, clearAutoFilter } from '@/lib/office/sheetOps';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };

// Activar sobre A1:C10.
{
  const sheet: any = {};
  ok(setAutoFilter(sheet, 'A1:C10') === true, 'setAutoFilter devuelve true');
  eq(sheet.filter_select, { row: [0, 9], column: [0, 2] }, 'filter_select fila 0-9 col 0-2');
  eq(sheet.filter, {}, 'filter inicializado a objeto vacío');
}

// Rango inválido → false, sin tocar la hoja.
{
  const sheet: any = {};
  ok(setAutoFilter(sheet, '') === false, 'rango vacío → false');
  eq(sheet.filter_select, undefined, 'no se escribe filter_select');
}

// Reactivar reemplaza el rango anterior (un solo autofiltro por hoja).
{
  const sheet: any = {};
  setAutoFilter(sheet, 'A1:B5');
  setAutoFilter(sheet, 'D1:F20');
  eq(sheet.filter_select, { row: [0, 19], column: [3, 5] }, 'reemplaza por el nuevo rango');
}

// Quitar.
{
  const sheet: any = {};
  setAutoFilter(sheet, 'A1:C10');
  ok(clearAutoFilter(sheet) === true, 'clearAutoFilter true cuando había');
  eq(sheet.filter_select, undefined, 'filter_select borrado');
  eq(sheet.filter, undefined, 'filter borrado');
}

// Quitar sin autofiltro → false.
{
  const sheet: any = {};
  ok(clearAutoFilter(sheet) === false, 'sin autofiltro → false');
}

// Roundtrip activar→quitar deja la hoja limpia.
{
  const sheet: any = { celldata: [] };
  setAutoFilter(sheet, 'A1:C3');
  clearAutoFilter(sheet);
  ok(sheet.filter_select === undefined && sheet.filter === undefined, 'roundtrip limpio');
}

console.log(`\nAUTOFILTER SPEC: ${passed} OK, ${fails.length} fallos`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} fallos`); }
console.log('✓ Todas las aserciones de autofiltro nativo pasan.');
