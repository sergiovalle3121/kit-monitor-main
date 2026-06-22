/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Administrador de escenarios (Scenario Manager) — el tercer análisis de hipótesis de Excel
 * (junto a «Buscar objetivo» §39 y «Tabla de datos» §41). Un escenario es un conjunto con nombre
 * de valores de celdas de entrada; el resumen muestra, para cada escenario, el valor de unas
 * celdas de resultado. Reutiliza `evalOverSheet` (§36); puro sobre COPIAS de la hoja.
 */
import { evalOverSheet } from './arraySpill';
import { parseRange } from '@/lib/office/charts';

const clone = (x: any) => JSON.parse(JSON.stringify(x));

export interface Scenario { name: string; changes: { cell: string; value: number }[] }

function setCellRaw(sheet: any, r: number, c: number, value: number) {
  sheet.celldata = sheet.celldata || [];
  let cd = sheet.celldata.find((x: any) => x.r === r && x.c === c);
  if (!cd) { cd = { r, c, v: {} }; sheet.celldata.push(cd); }
  if (cd.v && typeof cd.v === 'object') { cd.v.v = value; cd.v.m = String(value); delete cd.v.f; }
  else cd.v = value;
}
function readCell(sheet: any, r: number, c: number): any {
  const cd = (sheet.celldata ?? []).find((x: any) => x.r === r && x.c === c);
  return cd?.v && typeof cd.v === 'object' ? (cd.v.v ?? cd.v.m) : cd?.v;
}
function getFormula(sheet: any, r: number, c: number): string | undefined {
  const cd = (sheet.celldata ?? []).find((x: any) => x.r === r && x.c === c);
  return cd?.v && typeof cd.v === 'object' ? cd.v.f : undefined;
}

/** "A1=100, B2=-5" → cambios. Ignora pares mal formados. */
export function parseChanges(text: string): { cell: string; value: number }[] {
  return String(text ?? '').split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean).map((p) => {
    const m = /^([A-Za-z]+\d+)\s*=\s*(-?\d+(?:[.,]\d+)?)$/.exec(p);
    return m ? { cell: m[1].toUpperCase(), value: Number(m[2].replace(',', '.')) } : null;
  }).filter((x): x is { cell: string; value: number } => x != null);
}

/** Aplica un escenario (escribe sus valores) sobre `sheet` (lo muta). */
export function applyScenario(sheet: any, scenario: Scenario) {
  for (const ch of scenario.changes) { const p = parseRange(ch.cell); if (p) setCellRaw(sheet, p.r1, p.c1, ch.value); }
}

export interface ScenarioSummary { headers: string[]; rows: { cell: string; values: number[] }[] }

/** Para cada celda de resultado, su valor bajo cada escenario (recalcula la fórmula si la tiene). */
export function scenarioSummary(sheet: any, scenarios: Scenario[], resultCells: string[]): ScenarioSummary {
  const rows = resultCells.map((cell) => {
    const p = parseRange(cell);
    const values = scenarios.map((sc) => {
      if (!p) return NaN;
      const w = clone(sheet);
      applyScenario(w, sc);
      const formula = getFormula(w, p.r1, p.c1);
      if (formula) { const ev = evalOverSheet(w, formula); const n = typeof ev.result === 'number' ? ev.result : Number(ev.result); return Number.isFinite(n) ? n : NaN; }
      const n = Number(readCell(w, p.r1, p.c1)); return Number.isFinite(n) ? n : NaN;
    });
    return { cell, values };
  });
  return { headers: scenarios.map((s) => s.name), rows };
}
