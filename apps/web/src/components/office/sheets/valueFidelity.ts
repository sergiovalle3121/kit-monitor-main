/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Fidelidad de **`VALUE(texto)`** — conversión de texto a número como en Excel.
 *
 * Excel convierte a número cualquier texto que represente un **número, una fecha o una hora**:
 *
 *   • `VALUE("1:30:00")`     → `0.0625`        (fracción de día — hora)
 *   • `VALUE("1:30 PM")`     → `0.5625`
 *   • `VALUE("2024-01-15")`  → `45306`         (número de serie de fecha)
 *   • `VALUE("1/15/2024")`   → `45306`
 *   • `VALUE("2024-01-15 13:30")` → `45306.5625` (fecha + hora)
 *
 * Pero `@formulajs/formulajs@2.9.3` SÓLO maneja números, moneda y porcentajes en `VALUE`; para
 * cualquier texto de **fecha u hora** devuelve `#VALUE!`. Esto rompe patrones cotidianos como
 * `=VALUE(A1)+30` sobre una columna de fechas/horas escritas como texto (típico al pegar datos).
 *
 * Estrategia **aditiva y de riesgo cero**: se intenta primero la `VALUE` de `formulajs` (números,
 * `$1,234.50`, `50%`, notación científica, paréntesis…); sólo si esa falla se delega el texto en
 * el parser de hora propio del motor (`TIMEVALUE`, ya fiel a Excel) y en `DATEVALUE` de `formulajs`
 * (que devuelve un `Date`), convirtiendo la fecha al **número de serie** de Excel. Idéntico en todo
 * lo demás. `VALUE` siempre devuelve un **número** (igual que Excel: el formato de celda decide si
 * se ve como fecha/hora).
 */
import * as formulajs from '@formulajs/formulajs';
import { TIMEVALUE } from './scalarFunctions';

// Serie 0 = 1899-12-30 (sistema de fechas 1900 de Excel). Las fechas reales ≥ 1900-03-01 caen
// exactas con esta resta en UTC; el bug del 29-feb-1900 sólo afecta a ene/feb de 1900 (irrelevante).
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const dateToSerial = (d: Date): number => Math.round((d.getTime() - EXCEL_EPOCH) / 86400000);

// Componente de hora «HH:MM[:SS] [AM/PM]» en cualquier posición del texto.
const TIME_RE = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?:AM|PM|A\.M\.|P\.M\.)?/i;

/** Devuelve el número de serie de la fecha si `s` la representa; si no, `null`. */
function dateSerial(s: string): number | null {
  const d = (formulajs as any).DATEVALUE(s);
  return d instanceof Date && !isNaN(d.getTime()) ? dateToSerial(d) : null;
}

/** `VALUE(texto)` con fidelidad de fecha y hora. */
export function VALUE(params: any[]): any {
  const raw = params[0];
  if (raw === null || raw === undefined || raw === '') return 0;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'boolean') return '#VALUE!'; // Excel: VALUE(VERDADERO) = #VALUE!
  const s = String(raw).trim();
  if (s === '') return 0;

  // 1) Número / moneda / porcentaje / científica / paréntesis → lo resuelve formulajs.
  //    Sólo se confía en él si el texto NO contiene letras (salvo `e`/`E` de la notación
  //    científica): así `formulajs` no «aplana» fechas con nombre de mes —p. ej. `"Jan 15, 2024"`
  //    lo convertiría erróneamente en `152024`— que deben ir por la rama de fecha de abajo.
  if (!/[a-df-zA-DF-Z]/.test(s)) {
    const n = (formulajs as any).VALUE(s);
    if (typeof n === 'number' && isFinite(n)) return n;
  }

  // 2) Hora (sola o combinada con fecha).
  const tm = TIME_RE.exec(s);
  if (tm) {
    const tv = TIMEVALUE([tm[0]]);
    if (typeof tv === 'number') {
      const rest = (s.slice(0, tm.index) + s.slice(tm.index + tm[0].length)).replace(/[,\s]+/g, ' ').trim();
      if (!rest) return tv; // sólo hora
      const serial = dateSerial(rest);
      if (serial !== null) return serial + tv; // fecha + hora
      return '#VALUE!'; // hora válida pero el resto no es una fecha
    }
  }

  // 3) Sólo fecha.
  const serial = dateSerial(s);
  if (serial !== null) return serial;

  return '#VALUE!';
}

/** Registro para fusionar en CUSTOM_FUNCTIONS. */
export const VALUE_FIDELITY_FUNCTIONS: Record<string, (params: any[]) => any> = { VALUE };
