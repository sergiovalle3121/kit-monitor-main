/* eslint-disable @typescript-eslint/no-explicit-any */
/** Fidelidad de VALUE (fecha/hora). npx tsx src/components/office/sheets/valueFidelity.spec.ts */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => {
  const ok = typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : String(a) === String(b);
  if (ok) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`);
};

const Parser: any = (FP as any).Parser;
const parser = new Parser();
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

// ── Lo que YA funcionaba sigue igual (números, moneda, %, científica) ──
eq(ev('=VALUE("123")'), 123, 'número simple');
eq(ev('=VALUE("1,234.5")'), 1234.5, 'separador de miles');
eq(ev('=VALUE("$1,234.50")'), 1234.5, 'moneda');
eq(ev('=VALUE("50%")'), 0.5, 'porcentaje');
eq(ev('=VALUE("1E3")'), 1000, 'notación científica');
eq(ev('=VALUE("  42  ")'), 42, 'espacios alrededor');
eq(ev('=VALUE("-5")'), -5, 'negativo');

// ── Horas → fracción de día (NUEVO) ──
eq(ev('=VALUE("1:30:00")'), 0.0625, 'hora con segundos');
eq(ev('=VALUE("1:30")'), 0.0625, 'hora sin segundos');
eq(ev('=VALUE("12:00:00")'), 0.5, 'mediodía');
eq(ev('=VALUE("0:00:00")'), 0, 'medianoche');
eq(ev('=VALUE("1:30 PM")'), 0.5625, 'PM con AM/PM');
eq(ev('=VALUE("13:30")'), 0.5625, '24h');
eq(ev('=VALUE("6:00 AM")'), 0.25, 'AM');

// ── Fechas → número de serie (NUEVO) ──
eq(ev('=VALUE("2024-01-15")'), 45306, 'ISO');
eq(ev('=VALUE("1/15/2024")'), 45306, 'M/D/Y (en-US)');
eq(ev('=VALUE("15-Jan-2024")'), 45306, 'D-Mmm-Y');
eq(ev('=VALUE("Jan 15, 2024")'), 45306, 'Mmm D, Y');
eq(ev('=DATE(2024,1,15)-1+VALUE("2024-01-15")*0'), ev('=DATE(2024,1,15)-1'), 'serie coherente con DATE');

// ── Fecha + hora → serie + fracción (NUEVO) ──
eq(ev('=VALUE("2024-01-15 13:30")'), 45306.5625, 'fecha y hora combinadas');
eq(ev('=VALUE("1/15/2024 6:00 AM")'), 45306.25, 'M/D/Y con AM');

// ── Casos de error (la cadena «#VALUE!» es capturada por IFERROR, como en Excel) ──
eq(ev('=VALUE("hola")'), '#VALUE!', 'texto no numérico → #VALUE!');
eq(ev('=VALUE("13:30 mundo")'), '#VALUE!', 'hora + basura → #VALUE!');
eq(ev('=IFERROR(VALUE("hola"),"X")'), 'X', 'IFERROR captura el #VALUE!');
eq(ev('=VALUE("")'), 0, 'cadena vacía → 0');

// ── Roundtrip: VALUE de un texto de hora reconstruye HOUR/MINUTE ──
eq(ev('=HOUR(VALUE("13:45:00"))'), 13, 'HOUR(VALUE(hora))');
eq(ev('=MINUTE(VALUE("13:45:00"))'), 45, 'MINUTE(VALUE(hora))');
// VALUE de una fecha alimenta YEAR/MONTH/DAY.
eq(ev('=YEAR(VALUE("2024-01-15"))'), 2024, 'YEAR(VALUE(fecha))');
eq(ev('=MONTH(VALUE("2024-01-15"))'), 1, 'MONTH(VALUE(fecha))');
eq(ev('=DAY(VALUE("2024-01-15"))'), 15, 'DAY(VALUE(fecha))');

if (fails.length) { console.log(`❌ ${passed}/${passed + fails.length}`); for (const f of fails) console.log('  - ' + f); process.exit(1); }
else console.log(`✅ ${passed}/${passed}`);
