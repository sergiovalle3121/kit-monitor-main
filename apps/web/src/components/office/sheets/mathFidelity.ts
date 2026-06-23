/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Correcciones de fidelidad de funciones matemáticas con **argumento opcional sin valor por
 * defecto** en `@formulajs/formulajs@2.9.3` (auditoría de valores conocidos):
 *
 *  • `LOG(número)` sin base → `#NUM!` (Excel usa base 10): `LOG(100)` = 2.
 *  • `CEILING(número)` sin cifra significativa → 0 (Excel usa 1): `CEILING(4.3)` = 5.
 *  • `FLOOR(número)` sin cifra significativa → 0 (Excel usa 1): `FLOOR(4.7)` = 4.
 *
 * Se delega en el MISMO `formulajs` cuando el argumento SÍ está (comportamiento idéntico, riesgo
 * cero); sólo se rellena el valor por defecto que faltaba.
 */
import * as formulajs from '@formulajs/formulajs';

const has = (v: any): boolean => v !== undefined && v !== null;

/** LOG(número; [base=10]). */
function LOG(p: any[]): any { return (formulajs as any).LOG(p[0], has(p[1]) ? p[1] : 10); }
/** CEILING(número; [cifra=1]) — redondea al múltiplo superior. */
function CEILING(p: any[]): any { return (formulajs as any).CEILING(p[0], has(p[1]) ? p[1] : 1); }
/** FLOOR(número; [cifra=1]) — redondea al múltiplo inferior. */
function FLOOR(p: any[]): any { return (formulajs as any).FLOOR(p[0], has(p[1]) ? p[1] : 1); }

/** Registro para fusionar en CUSTOM_FUNCTIONS. */
export const MATH_FIDELITY_FUNCTIONS: Record<string, (params: any[]) => any> = { LOG, CEILING, FLOOR };
