/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Fidelidad de **truncamiento de argumentos enteros** en funciones de texto. Excel **trunca** los
 * argumentos de conteo/longitud/posición que son fraccionarios (`REPT("ab", 2.9)` = `"abab"`), pero
 * `@formulajs/formulajs@2.9.3` los **redondea** o **revienta**:
 *   `REPT(_, 2.9)`→`#ERROR!`, `RIGHT("hello", 2.9)`→`"llo"` (3), `MID`/`ROMAN` con fracción → mal.
 *
 * Aquí se **trunca hacia cero** cada argumento entero antes de **delegar en el mismo `formulajs`**
 * (que con enteros es correcto) → idéntico con enteros, riesgo cero.
 */
import * as formulajs from '@formulajs/formulajs';
import { toNum } from './formulaEngine';

/** Trunca hacia cero si es número; si no, deja el valor (que formulajs maneje el error). */
function tr(v: any): any { const n = toNum(v); return n === null ? v : Math.trunc(n); }
const def = (v: any, d: number): any => (v === undefined || v === null ? d : tr(v));

function REPT(p: any[]): any { return (formulajs as any).REPT(p[0], tr(p[1])); }
function LEFT(p: any[]): any { return (formulajs as any).LEFT(p[0], def(p[1], 1)); }
function RIGHT(p: any[]): any { return (formulajs as any).RIGHT(p[0], def(p[1], 1)); }
function MID(p: any[]): any { return (formulajs as any).MID(p[0], tr(p[1]), tr(p[2])); }
function ROMAN(p: any[]): any { return (formulajs as any).ROMAN(tr(p[0]), p[1]); }

/** Registro para fusionar en CUSTOM_FUNCTIONS. */
export const TEXT_TRUNC_FUNCTIONS: Record<string, (params: any[]) => any> = { REPT, LEFT, RIGHT, MID, ROMAN };
