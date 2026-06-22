/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Solver (optimización) — el «Solver» de Excel: encuentra los valores de varias celdas VARIABLE
 * que MAXIMIZAN / MINIMIZAN una celda objetivo (o la llevan a un VALOR), con límites opcionales
 * por variable. Va más allá de «Buscar objetivo» (§39, una variable) al optimizar VARIAS a la vez.
 *
 * Reutiliza `evalOverSheet` (§36) para evaluar el objetivo con valores de prueba y resuelve con
 * **Nelder–Mead** (símplex descendente, sin derivadas). Es PURO sobre una COPIA de la hoja hasta
 * tener solución, así que se prueba sin navegador.
 *
 * Límite (documentado, igual que §39): recalcula SOLO la fórmula objetivo; las variables deben
 * influir en ella directamente o vía celdas de valor. Los límites se imponen por recorte (clamp).
 */
import { evalOverSheet } from './arraySpill';
import { parseRange } from '@/lib/office/charts';

const clone = (x: any) => JSON.parse(JSON.stringify(x));
const round = (x: number) => (Math.abs(x - Math.round(x)) < 1e-7 ? Math.round(x) : +x.toFixed(8));

export type SolverGoal = 'max' | 'min' | 'value';
export interface SolverVar { cell: string; min?: number; max?: number }
export interface SolverResult { ok: boolean; values?: { cell: string; value: number }[]; objective?: number; iterations?: number; error?: string }

function getFormula(sheet: any, r: number, c: number): string | undefined {
  const cd = (sheet.celldata ?? []).find((x: any) => x.r === r && x.c === c);
  return cd?.v && typeof cd.v === 'object' ? cd.v.f : undefined;
}
function setCellRaw(sheet: any, r: number, c: number, value: number) {
  sheet.celldata = sheet.celldata || [];
  let cd = sheet.celldata.find((x: any) => x.r === r && x.c === c);
  if (!cd) { cd = { r, c, v: {} }; sheet.celldata.push(cd); }
  if (cd.v && typeof cd.v === 'object') { cd.v.v = value; cd.v.m = String(value); delete cd.v.f; }
  else cd.v = value;
}
function readNum(sheet: any, r: number, c: number): number {
  const cd = (sheet.celldata ?? []).find((x: any) => x.r === r && x.c === c);
  const raw = cd?.v && typeof cd.v === 'object' ? cd.v.v : cd?.v;
  const n = Number(raw); return Number.isFinite(n) ? n : 0;
}

/** Minimiza `f` (R^n→R) con Nelder–Mead desde `x0`. Devuelve el mejor punto. */
function nelderMead(f: (x: number[]) => number, x0: number[], maxIter: number): { x: number[]; f: number; iter: number } {
  const n = x0.length;
  const simplex: number[][] = [x0.slice()];
  for (let i = 0; i < n; i++) { const p = x0.slice(); const step = Math.abs(p[i]) > 1e-8 ? 0.05 * p[i] : 0.05; p[i] += step; simplex.push(p); }
  const fv = simplex.map(f);
  const alpha = 1, gamma = 2, rho = 0.5, sigma = 0.5;
  let iter = 0;
  for (; iter < maxIter; iter++) {
    const order = fv.map((_, i) => i).sort((a, b) => fv[a] - fv[b]);
    const sx = order.map((i) => simplex[i]); const sf = order.map((i) => fv[i]);
    for (let i = 0; i <= n; i++) { simplex[i] = sx[i]; fv[i] = sf[i]; }
    if (Math.abs(fv[n] - fv[0]) < 1e-12) break;
    const c = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += simplex[i][j];
    for (let j = 0; j < n; j++) c[j] /= n;
    const worst = simplex[n], fw = fv[n];
    const xr = c.map((cj, j) => cj + alpha * (cj - worst[j])); const fr = f(xr);
    if (fr < fv[0]) {
      const xe = c.map((cj, j) => cj + gamma * (xr[j] - cj)); const fe = f(xe);
      if (fe < fr) { simplex[n] = xe; fv[n] = fe; } else { simplex[n] = xr; fv[n] = fr; }
    } else if (fr < fv[n - 1]) {
      simplex[n] = xr; fv[n] = fr;
    } else {
      const xc = c.map((cj, j) => cj + rho * (worst[j] - cj)); const fc = f(xc);
      if (fc < fw) { simplex[n] = xc; fv[n] = fc; }
      else { for (let i = 1; i <= n; i++) { simplex[i] = simplex[0].map((b, j) => b + sigma * (simplex[i][j] - b)); fv[i] = f(simplex[i]); } }
    }
  }
  let bi = 0; for (let i = 1; i < fv.length; i++) if (fv[i] < fv[bi]) bi = i;
  return { x: simplex[bi], f: fv[bi], iter };
}

/** Pulido local por descenso de coordenadas con paso que se reduce: afina el óptimo (planos incl.). */
function coordinatePolish(f: (x: number[]) => number, x0: number[], maxPasses = 80): { x: number[]; f: number } {
  const n = x0.length;
  let x = x0.slice(); let fx = f(x);
  const step = x.map((v) => Math.max(1, Math.abs(v)));
  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false;
    for (let i = 0; i < n; i++) {
      for (const dir of [1, -1]) {
        const cand = x.slice(); cand[i] += dir * step[i];
        const fc = f(cand);
        if (fc < fx - 1e-15) { x = cand; fx = fc; improved = true; }
      }
    }
    if (!improved) {
      let allTiny = true;
      for (let i = 0; i < n; i++) { step[i] *= 0.5; if (step[i] > 1e-9) allTiny = false; }
      if (allTiny) break;
    }
  }
  return { x, f: fx };
}

/** Optimiza la celda `objectiveA1` cambiando `variables`, con límites opcionales. Si halla solución, la fija en `sheet`. */
export function solve(sheet: any, objectiveA1: string, goal: SolverGoal, target: number, variables: SolverVar[], maxIter = 400): SolverResult {
  const op = parseRange(objectiveA1);
  if (!op) return { ok: false, error: 'Celda objetivo inválida.' };
  const formula = getFormula(sheet, op.r1, op.c1);
  if (!formula) return { ok: false, error: 'La celda objetivo no contiene una fórmula.' };
  if (goal === 'value' && !Number.isFinite(target)) return { ok: false, error: 'El valor objetivo debe ser un número.' };
  const vars = variables.map((v) => ({ ...v, pos: parseRange(v.cell) })).filter((v) => v.pos);
  if (!vars.length) return { ok: false, error: 'Indica al menos una celda variable válida.' };
  const n = vars.length;
  const work = clone(sheet);
  const clamp = (i: number, x: number) => { const v = vars[i]; let y = x; if (v.min != null && y < v.min) y = v.min; if (v.max != null && y > v.max) y = v.max; return y; };
  const objAt = (x: number[]): number => {
    for (let i = 0; i < n; i++) setCellRaw(work, vars[i].pos!.r1, vars[i].pos!.c1, clamp(i, x[i]));
    const ev = evalOverSheet(work, formula);
    const f = typeof ev.result === 'number' ? ev.result : Number(ev.result);
    return Number.isFinite(f) ? f : NaN;
  };
  const cost = (x: number[]): number => {
    const f = objAt(x);
    if (!Number.isFinite(f)) return 1e15;
    if (goal === 'max') return -f;
    if (goal === 'value') return (f - target) * (f - target);
    return f;
  };
  const x0 = vars.map((v, i) => clamp(i, readNum(sheet, v.pos!.r1, v.pos!.c1)));
  // Dos arranques (desde el punto actual y desde un punto desplazado) para esquivar mínimos locales planos.
  const r1 = nelderMead(cost, x0, maxIter);
  const r2 = nelderMead(cost, x0.map((v, i) => clamp(i, v + (Math.abs(v) > 1 ? v * 0.5 : 1))), maxIter);
  const best = (r2.f < r1.f ? r2 : r1);
  // Pulido local para afinar el óptimo (Nelder–Mead se estanca en cimas/valles planos).
  const polished = coordinatePolish(cost, best.x.map((xi, i) => clamp(i, xi)));
  const sol = polished.x.map((xi, i) => clamp(i, xi));
  for (let i = 0; i < n; i++) setCellRaw(sheet, vars[i].pos!.r1, vars[i].pos!.c1, round(sol[i]));
  const objective = round(objAt(sol));
  return { ok: true, values: vars.map((v, i) => ({ cell: v.cell, value: round(sol[i]) })), objective, iterations: best.iter };
}
