/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Spec ejecutable del formateador de números (estilo Excel). Pure, sin runner:
 *   cd apps/web && npx tsx src/components/office/sheets/numfmt.spec.ts
 */
import { formatNumber, applyNumberFormat } from '@/lib/office/sheetOps';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, msg: string) => { if (a === b) passed++; else fails.push(`${msg} — esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`); };

// ── Números ──────────────────────────────────────────────────────────────────
eq(formatNumber(1234.5, '#,##0'), '1,235', 'miles redondeado');
eq(formatNumber(1234.5, '#,##0.00'), '1,234.50', 'miles 2 dec');
eq(formatNumber(1234.5, '0.00'), '1234.50', 'fijo 2 dec sin grupo');
eq(formatNumber(1234.5, '$#,##0.00'), '$1,234.50', 'moneda');
eq(formatNumber(-1234.5, '$ #,##0.00;($ #,##0.00)'), '($ 1,234.50)', 'contable negativo entre paréntesis');
eq(formatNumber(1234.5, '$ #,##0.00;($ #,##0.00)'), '$ 1,234.50', 'contable positivo');
eq(formatNumber(-50, '#,##0'), '-50', 'negativo simple');

// ── Porcentaje ───────────────────────────────────────────────────────────────
eq(formatNumber(0.1234, '0%'), '12%', 'porcentaje 0 dec');
eq(formatNumber(0.1234, '0.00%'), '12.34%', 'porcentaje 2 dec');
eq(formatNumber(1, '0%'), '100%', 'porcentaje 100');

// ── Científico ───────────────────────────────────────────────────────────────
eq(formatNumber(1234.5, '0.00E+00'), '1.23E+03', 'científico');
eq(formatNumber(0.000123, '0.00E+00'), '1.23E-04', 'científico negativo exp');

// ── Fracción ─────────────────────────────────────────────────────────────────
eq(formatNumber(1.5, '# ??/??'), '1 1/2', 'fracción 1 1/2');
eq(formatNumber(0.75, '# ??/??'), '3/4', 'fracción 3/4');
eq(formatNumber(2, '# ??/??'), '2', 'fracción entera');

// ── Fechas (string ISO) ──────────────────────────────────────────────────────
eq(formatNumber('2026-01-15', 'dd/mm/yyyy'), '15/01/2026', 'fecha corta');
eq(formatNumber('2026-01-15', 'd "de" mmmm "de" yyyy'), '15 de enero de 2026', 'fecha larga');
eq(formatNumber('2026-01-15T13:45:00Z', 'hh:mm'), '13:45', 'hora (mm = minutos)');
eq(formatNumber('2026-01-15T13:45:09Z', 'dd/mm/yyyy hh:mm:ss'), '15/01/2026 13:45:09', 'fecha+hora (mm mes vs minuto)');
eq(formatNumber('2026-03-09', 'mmm yyyy'), 'mar 2026', 'mes abreviado');

// ── Día de la semana + reloj de 12 horas (AM/PM) ─────────────────────────────
eq(formatNumber('2026-01-15', 'dddd'), 'jueves', 'día de la semana completo (dddd)');
eq(formatNumber('2026-01-15', 'ddd'), 'jue', 'día de la semana abreviado (ddd)');
eq(formatNumber('2026-01-15T13:45:00Z', 'hh:mm AM/PM'), '01:45 PM', '12 horas PM');
eq(formatNumber('2026-01-15T09:05:00Z', 'h:mm am/pm'), '9:05 am', '12 horas am en minúscula');
eq(formatNumber('2026-01-15T00:30:00Z', 'h:mm AM/PM'), '12:30 AM', 'medianoche = 12 AM');
eq(formatNumber('2026-01-15T12:00:00Z', 'h AM/PM'), '12 PM', 'mediodía = 12 PM');
eq(formatNumber('2026-01-15T13:00:00Z', 'h "en punto"'), '13 en punto', '24 horas sin AM/PM intacto');

// ── Fechas (serial Excel) ────────────────────────────────────────────────────
const serial = Math.round((Date.UTC(2026, 0, 15) - Date.UTC(1899, 11, 30)) / 86400000);
eq(formatNumber(serial, 'dd/mm/yyyy'), '15/01/2026', 'serial Excel → fecha');

// ── General / passthrough ────────────────────────────────────────────────────
eq(formatNumber('hola', 'General'), 'hola', 'texto General');
eq(formatNumber(42, 'General'), '42', 'número General');
eq(formatNumber('hola', '#,##0'), 'hola', 'texto con código numérico se respeta');

// ── Texto literal en el formato (antes se perdía) ────────────────────────────
eq(formatNumber(5, '0" kg"'), '5 kg', 'literal sufijo " kg"');
eq(formatNumber(1234, '"$"#,##0'), '$1,234', 'literal prefijo entrecomillado');
eq(formatNumber(0.5, '0%" done"'), '50% done', 'porcentaje + literal');
eq(formatNumber(72, '0" °C"'), '72 °C', 'literal con símbolo');

// ── Relleno de ceros a la izquierda ──────────────────────────────────────────
eq(formatNumber(42, '00000'), '00042', 'relleno a 5 dígitos');
eq(formatNumber(7, '000'), '007', 'relleno a 3 dígitos');

// ── Secciones positivo;negativo;cero;texto ───────────────────────────────────
eq(formatNumber(-1234, '#,##0;(#,##0)'), '(1,234)', 'negativo entre paréntesis (sección)');
eq(formatNumber(0, '0.00;-0.00;"—"'), '—', 'sección de cero personalizada');
eq(formatNumber(1234, '#,##0;(#,##0)'), '1,234', 'positivo con 2 secciones');

// ── Etiquetas [color]/[condición]/[$moneda] ──────────────────────────────────
eq(formatNumber(5, '[Red]0.00'), '5.00', 'etiqueta de color ignorada');
eq(formatNumber(5, '[$€-407]#,##0.00'), '€5.00', 'símbolo de moneda desde [$€-…]');

// ── Escalado por miles (coma final) ──────────────────────────────────────────
eq(formatNumber(1500000, '#,##0,'), '1,500', 'coma final divide entre mil');
eq(formatNumber(2500000, '0.0,,'), '2.5', 'dos comas finales dividen entre millón');

// ── applyNumberFormat sobre una hoja ─────────────────────────────────────────
{
  const sheet: any = { celldata: [{ r: 0, c: 0, v: { v: 0.5, m: '0.5', ct: { fa: 'General', t: 'n' } } }] };
  const n = applyNumberFormat(sheet, 'A1', '0.00%');
  eq(n, 1, 'applyNumberFormat afecta 1 celda');
  eq(sheet.celldata[0].v.m, '50.00%', 'm formateado a 50.00%');
  eq(sheet.celldata[0].v.ct.fa, '0.00%', 'ct.fa guarda el código');
}

console.log(`\nNUMFMT SPEC: ${passed} OK, ${fails.length} fallos`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} fallos`); }
console.log('✓ Todas las aserciones de formato de número pasan.');
