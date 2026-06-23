/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Distribuciones **χ², F y t de Student** de Excel, con sus colas y sus inversas. Las versiones de
 * `@formulajs/formulajs@2.9.3` son **numéricamente incorrectas** (`CHIINV(0.05,1)`→0.0039 en vez de
 * 3.841; `FINV`, `TINV` y las `*.DIST.RT`/`*.INV.RT`/`*.2T` igual de mal o ausentes). Aquí se
 * implementan correctamente sobre la **gamma incompleta regularizada** `P(a,x)` y la **beta
 * incompleta regularizada** `Iₓ(a,b)` (algoritmos de Numerical Recipes: serie + fracción continua),
 * y se invierten por bisección. Se registran en `CUSTOM_FUNCTIONS` (ganan al fallback roto).
 */
import { toNum, flatten } from './formulaEngine';

// ── Funciones especiales ───────────────────────────────────────────────────────
function gammaln(xx: number): number {
  const cof = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = xx; let tmp = xx + 5.5; tmp -= (xx + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) { y++; ser += cof[j] / y; }
  return -tmp + Math.log(2.5066282746310005 * ser / xx);
}

/** P(a,x): gamma incompleta inferior regularizada. */
function gammp(a: number, x: number): number {
  if (x <= 0 || a <= 0) return x <= 0 ? 0 : NaN;
  if (x < a + 1) { // serie
    let ap = a, sum = 1 / a, del = sum;
    for (let n = 0; n < 300; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-16) break; }
    return sum * Math.exp(-x + a * Math.log(x) - gammaln(a));
  }
  // fracción continua para Q = 1 - P
  const FPMIN = 1e-300;
  let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
  for (let i = 1; i < 300; i++) {
    const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - gammaln(a)) * h;
}

function betacf(a: number, b: number, x: number): number {
  const FPMIN = 1e-300; const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return h;
}
/** Iₓ(a,b): beta incompleta regularizada. */
function betai(a: number, b: number, x: number): number {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(gammaln(a + b) - gammaln(a) - gammaln(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}

// ── CDFs ───────────────────────────────────────────────────────────────────────
const chisqCdf = (x: number, df: number): number => gammp(df / 2, x / 2);
const fCdf = (x: number, d1: number, d2: number): number => (x <= 0 ? 0 : betai(d1 / 2, d2 / 2, (d1 * x) / (d1 * x + d2)));
/** CDF de t de Student (cola izquierda). */
function tCdf(t: number, df: number): number {
  const ib = 0.5 * betai(df / 2, 0.5, df / (df + t * t));
  return t >= 0 ? 1 - ib : ib;
}

/** Inversa por bisección de una función creciente `f` en `[lo,hi]` para `f(x)=target`. */
function bisect(f: (x: number) => number, target: number, lo: number, hi: number): number {
  let a = lo, b = hi;
  // expande el extremo superior si hace falta
  for (let k = 0; k < 100 && f(b) < target; k++) b *= 2;
  for (let i = 0; i < 200; i++) { const m = (a + b) / 2; if (f(m) < target) a = m; else b = m; if (b - a < 1e-12) break; }
  return (a + b) / 2;
}

const num = (v: any, dflt = NaN): number => { const n = toNum(v); return n === null ? dflt : n; };
function truthy(v: any): boolean { if (v === true) return true; if (v === false || v == null || v === '') return false; if (typeof v === 'number') return v !== 0; if (typeof v === 'string') return !/^(false|falso|0)$/i.test(v.trim()); return !!v; }

// ── Gamma / Beta / discretas (reutilizan P(a,x) e Iₓ(a,b)) ─────────────────────
/** log de la combinación C(n,k). */
const logC = (n: number, k: number): number => gammaln(n + 1) - gammaln(k + 1) - gammaln(n - k + 1);
/** CDF de la gamma (forma `alpha`, escala `beta`). */
const gammaCdf = (x: number, a: number, b: number): number => (x <= 0 ? 0 : gammp(a, x / b));
/** PERCENTRANK.EXC: posición exclusiva (1-based) de `x` dividida por `n+1`. */
function percentrankExc(arg: any, x: number, sig: number): any {
  const a = flatten(arg).map(toNum).filter((v): v is number => v !== null).sort((p, q) => p - q);
  const n = a.length;
  if (n === 0 || x < a[0] || x > a[n - 1]) return '#N/A';
  let pos = -1;
  for (let i = 0; i < n; i++) { if (a[i] === x) { pos = i + 1; break; } if (a[i] < x && x < a[i + 1]) { pos = (i + 1) + (x - a[i]) / (a[i + 1] - a[i]); break; } }
  if (pos < 0) return '#N/A';
  const pr = pos / (n + 1);
  const f = Math.pow(10, sig);
  return Math.floor(pr * f) / f;
}

// ── Registro (nombres modernos y legados corregidos) ───────────────────────────
export const DISTRIBUTION_FUNCTIONS: Record<string, (params: any[]) => any> = {
  // χ²
  'CHISQ.DIST': (p) => { const x = num(p[0]), df = num(p[1]); if (x < 0 || df < 1) return '#NUM!'; if (!truthy(p[2])) { return Math.exp((df / 2 - 1) * Math.log(x) - x / 2 - (df / 2) * Math.log(2) - gammaln(df / 2)); } return chisqCdf(x, df); },
  'CHISQ.DIST.RT': (p) => { const x = num(p[0]), df = num(p[1]); if (x < 0 || df < 1) return '#NUM!'; return 1 - chisqCdf(x, df); },
  'CHISQ.INV': (p) => { const q = num(p[0]), df = num(p[1]); if (q < 0 || q > 1 || df < 1) return '#NUM!'; return bisect((x) => chisqCdf(x, df), q, 0, 100); },
  'CHISQ.INV.RT': (p) => { const q = num(p[0]), df = num(p[1]); if (q < 0 || q > 1 || df < 1) return '#NUM!'; return bisect((x) => chisqCdf(x, df), 1 - q, 0, 100); },
  CHIDIST: (p) => { const x = num(p[0]), df = num(p[1]); if (x < 0 || df < 1) return '#NUM!'; return 1 - chisqCdf(x, df); },          // legado corregido (cola derecha)
  CHIINV: (p) => { const q = num(p[0]), df = num(p[1]); if (q < 0 || q > 1 || df < 1) return '#NUM!'; return bisect((x) => chisqCdf(x, df), 1 - q, 0, 100); }, // legado corregido
  // F
  'F.DIST': (p) => { const x = num(p[0]), d1 = num(p[1]), d2 = num(p[2]); if (x < 0 || d1 < 1 || d2 < 1) return '#NUM!'; if (!truthy(p[3])) return '#NUM!'; return fCdf(x, d1, d2); },
  'F.DIST.RT': (p) => { const x = num(p[0]), d1 = num(p[1]), d2 = num(p[2]); if (x < 0 || d1 < 1 || d2 < 1) return '#NUM!'; return 1 - fCdf(x, d1, d2); },
  'F.INV': (p) => { const q = num(p[0]), d1 = num(p[1]), d2 = num(p[2]); if (q < 0 || q > 1 || d1 < 1 || d2 < 1) return '#NUM!'; return bisect((x) => fCdf(x, d1, d2), q, 0, 10); },
  'F.INV.RT': (p) => { const q = num(p[0]), d1 = num(p[1]), d2 = num(p[2]); if (q < 0 || q > 1 || d1 < 1 || d2 < 1) return '#NUM!'; return bisect((x) => fCdf(x, d1, d2), 1 - q, 0, 10); },
  FDIST: (p) => { const x = num(p[0]), d1 = num(p[1]), d2 = num(p[2]); if (x < 0 || d1 < 1 || d2 < 1) return '#NUM!'; return 1 - fCdf(x, d1, d2); },  // legado corregido (cola derecha)
  FINV: (p) => { const q = num(p[0]), d1 = num(p[1]), d2 = num(p[2]); if (q < 0 || q > 1 || d1 < 1 || d2 < 1) return '#NUM!'; return bisect((x) => fCdf(x, d1, d2), 1 - q, 0, 10); }, // legado corregido
  // t de Student
  'T.DIST': (p) => { const t = num(p[0]), df = num(p[1]); if (df < 1) return '#NUM!'; if (!truthy(p[2])) { return Math.exp(gammaln((df + 1) / 2) - gammaln(df / 2)) / Math.sqrt(df * Math.PI) * Math.pow(1 + t * t / df, -(df + 1) / 2); } return tCdf(t, df); },
  'T.DIST.RT': (p) => { const t = num(p[0]), df = num(p[1]); if (df < 1) return '#NUM!'; return 1 - tCdf(t, df); },
  'T.DIST.2T': (p) => { const t = num(p[0]), df = num(p[1]); if (df < 1 || t < 0) return '#NUM!'; return 2 * (1 - tCdf(Math.abs(t), df)); },
  'T.INV': (p) => { const q = num(p[0]), df = num(p[1]); if (q <= 0 || q >= 1 || df < 1) return '#NUM!'; return bisect((t) => tCdf(t, df), q, -100, 100); },
  'T.INV.2T': (p) => { const q = num(p[0]), df = num(p[1]); if (q <= 0 || q > 1 || df < 1) return '#NUM!'; return bisect((t) => 1 - 2 * (1 - tCdf(t, df)), 1 - q, 0, 100); },
  TINV: (p) => { const q = num(p[0]), df = num(p[1]); if (q <= 0 || q > 1 || df < 1) return '#NUM!'; return bisect((t) => 1 - 2 * (1 - tCdf(t, df)), 1 - q, 0, 100); }, // legado corregido (2 colas)
  // Gamma
  'GAMMA.DIST': (p) => { const x = num(p[0]), a = num(p[1]), b = num(p[2]); if (x < 0 || a <= 0 || b <= 0) return '#NUM!'; if (!truthy(p[3])) return Math.exp((a - 1) * Math.log(x) - x / b - a * Math.log(b) - gammaln(a)); return gammaCdf(x, a, b); },
  'GAMMA.INV': (p) => { const q = num(p[0]), a = num(p[1]), b = num(p[2]); if (q < 0 || q > 1 || a <= 0 || b <= 0) return '#NUM!'; return bisect((x) => gammaCdf(x, a, b), q, 0, 100); },
  GAMMADIST: (p) => { const x = num(p[0]), a = num(p[1]), b = num(p[2]); if (x < 0 || a <= 0 || b <= 0) return '#NUM!'; if (!truthy(p[3])) return Math.exp((a - 1) * Math.log(x) - x / b - a * Math.log(b) - gammaln(a)); return gammaCdf(x, a, b); },
  GAMMAINV: (p) => { const q = num(p[0]), a = num(p[1]), b = num(p[2]); if (q < 0 || q > 1 || a <= 0 || b <= 0) return '#NUM!'; return bisect((x) => gammaCdf(x, a, b), q, 0, 100); },
  'GAMMALN.PRECISE': (p) => { const x = num(p[0]); if (x <= 0) return '#NUM!'; return gammaln(x); },
  // Beta (con escalado opcional [A,B])
  'BETA.DIST': (p) => { const a = num(p[1]), b = num(p[2]); const A = p[4] === undefined ? 0 : num(p[4]), B = p[5] === undefined ? 1 : num(p[5]); const y = (num(p[0]) - A) / (B - A); if (a <= 0 || b <= 0 || B <= A) return '#NUM!'; if (!truthy(p[3])) { if (y < 0 || y > 1) return '#NUM!'; return Math.exp((a - 1) * Math.log(y) + (b - 1) * Math.log(1 - y) - (gammaln(a) + gammaln(b) - gammaln(a + b))) / (B - A); } return betai(a, b, Math.min(1, Math.max(0, y))); },
  'BETA.INV': (p) => { const q = num(p[0]), a = num(p[1]), b = num(p[2]); const A = p[3] === undefined ? 0 : num(p[3]), B = p[4] === undefined ? 1 : num(p[4]); if (q < 0 || q > 1 || a <= 0 || b <= 0 || B <= A) return '#NUM!'; return A + (B - A) * bisect((y) => betai(a, b, y), q, 0, 1); },
  // Discretas
  'HYPGEOM.DIST': (p) => { const k = Math.round(num(p[0])), n = Math.round(num(p[1])), K = Math.round(num(p[2])), N = Math.round(num(p[3])); if (k < 0 || k > n || K > N || n > N) return '#NUM!'; const pmf = (i: number) => Math.exp(logC(K, i) + logC(N - K, n - i) - logC(N, n)); if (!truthy(p[4])) return (i => (i < Math.max(0, n - (N - K)) || i > Math.min(n, K) ? 0 : pmf(i)))(k); let s = 0; for (let i = Math.max(0, n - (N - K)); i <= Math.min(k, n, K); i++) s += pmf(i); return s; },
  'NEGBINOM.DIST': (p) => { const f = Math.round(num(p[0])), s = Math.round(num(p[1])), pr = num(p[2]); if (f < 0 || s < 1 || pr <= 0 || pr > 1) return '#NUM!'; const pmf = (i: number) => Math.exp(logC(i + s - 1, s - 1)) * Math.pow(pr, s) * Math.pow(1 - pr, i); if (!truthy(p[3])) return pmf(f); let sum = 0; for (let i = 0; i <= f; i++) sum += pmf(i); return sum; },
  'PERCENTRANK.EXC': (p) => percentrankExc(p[0], num(p[1]), p[2] === undefined ? 3 : Math.trunc(num(p[2]))),
};
