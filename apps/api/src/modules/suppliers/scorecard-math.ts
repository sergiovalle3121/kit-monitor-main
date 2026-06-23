/**
 * Pure scorecard math for the supplier module. No TypeORM, no I/O — every
 * function takes plain data and returns a derived number, so the honest
 * calculations (PPM from IQC, OTD from receipts, SCAR responsiveness, the
 * composite grade and the AVL ranking) are unit-testable in isolation.
 *
 * Why "derived" matters: the Supplier master carries `otd_pct` / `ppm` as loose
 * typed-in fields. Here we compute them from the real transactional records so
 * the scorecard reflects what actually happened on the dock and at incoming
 * inspection — and we always say which number is derived vs a manual fallback.
 */

const DAY_MS = 86_400_000;

// ── Source tagging ────────────────────────────────────────────────────────────
/** 'derived' = computed from real records; 'manual' = typed-in fallback; 'none' = no data. */
export type MetricSource = 'derived' | 'manual' | 'none';

// ── PPM (parts-per-million defective) from incoming inspections ────────────────
export interface PpmInput {
  sampleSize?: number | null;
  defectsFound?: number | null;
  createdAt?: Date | string | null;
}
export interface PpmResult {
  ppm: number | null;
  inspected: number;
  defects: number;
  lots: number;
  source: MetricSource;
}

/**
 * PPM = Σ defects / Σ inspected × 1e6 over the lots that recorded a sample size.
 * `sinceMs` (optional) windows the calculation (e.g. last 12 months). Lots with
 * no sample size can't contribute to a rate and are ignored for the denominator.
 */
export function computePpm(
  inspections: PpmInput[],
  manualFallback?: number | null,
  sinceMs?: number,
): PpmResult {
  let inspected = 0;
  let defects = 0;
  let lots = 0;
  for (const i of inspections) {
    if (sinceMs != null && i.createdAt != null) {
      const t = new Date(i.createdAt).getTime();
      if (!Number.isNaN(t) && t < sinceMs) continue;
    }
    const sample = Number(i.sampleSize ?? 0);
    if (!(sample > 0)) continue;
    inspected += sample;
    defects += Math.max(0, Number(i.defectsFound ?? 0));
    lots += 1;
  }
  if (inspected > 0) {
    return { ppm: Math.round((defects / inspected) * 1_000_000), inspected, defects, lots, source: 'derived' };
  }
  if (manualFallback != null) {
    return { ppm: Math.round(manualFallback), inspected: 0, defects: 0, lots: 0, source: 'manual' };
  }
  return { ppm: null, inspected: 0, defects: 0, lots: 0, source: 'none' };
}

// ── OTD (on-time delivery %) from purchase orders / receipts ───────────────────
export interface OtdInput {
  status?: string | null;
  promisedDate?: Date | string | null;
  requiredDate?: Date | string | null;
  receivedDate?: Date | string | null;
}
export interface OtdResult {
  otdPct: number | null;
  eligible: number;
  onTime: number;
  late: number;
  source: MetricSource;
}

const RECEIVED_STATES = new Set(['RECEIVED', 'CLOSED']);

/**
 * OTD mirrors the procurement KPI convention: a PO counts once it is RECEIVED or
 * CLOSED and has both a commitment date (promised, else required) and an actual
 * received date. On-time = received on or before the commitment, with a same-day
 * grace. Falls back to the supplier's typed-in `otd_pct` when no PO has the dates.
 */
export function computeOtd(
  orders: OtdInput[],
  manualFallback?: number | null,
): OtdResult {
  let eligible = 0;
  let onTime = 0;
  for (const po of orders) {
    if (po.status && !RECEIVED_STATES.has(String(po.status).toUpperCase())) continue;
    const target = po.promisedDate ?? po.requiredDate;
    if (!target || !po.receivedDate) continue;
    eligible += 1;
    const targetT = new Date(target).getTime();
    const recvT = new Date(po.receivedDate).getTime();
    if (!Number.isNaN(targetT) && !Number.isNaN(recvT) && recvT <= targetT + DAY_MS) onTime += 1;
  }
  if (eligible > 0) {
    return { otdPct: Math.round((onTime / eligible) * 1000) / 10, eligible, onTime, late: eligible - onTime, source: 'derived' };
  }
  if (manualFallback != null) {
    return { otdPct: Math.round(manualFallback * 10) / 10, eligible: 0, onTime: 0, late: 0, source: 'manual' };
  }
  return { otdPct: null, eligible: 0, onTime: 0, late: 0, source: 'none' };
}

// ── SCAR responsiveness ────────────────────────────────────────────────────────
export interface ScarInput {
  status?: string | null;
  createdAt?: Date | string | null;
  closedAt?: Date | string | null;
  dueDate?: Date | string | null;
}
export interface ScarResult {
  total: number;
  open: number;
  closed: number;
  closedOnTime: number;
  onTimeRate: number | null; // % of closed SCARs shut on/before due date
  avgClosureDays: number;
}

export function computeScarResponsiveness(scars: ScarInput[]): ScarResult {
  let open = 0;
  let closed = 0;
  let closedOnTime = 0;
  let dueKnown = 0;
  let totalDays = 0;
  for (const s of scars) {
    const isClosed = String(s.status ?? '').toLowerCase() === 'closed';
    if (!isClosed) { open += 1; continue; }
    closed += 1;
    if (s.closedAt && s.createdAt) {
      totalDays += Math.max(0, (new Date(s.closedAt).getTime() - new Date(s.createdAt).getTime()) / DAY_MS);
    }
    if (s.dueDate && s.closedAt) {
      dueKnown += 1;
      if (new Date(s.closedAt).getTime() <= new Date(s.dueDate).getTime() + DAY_MS) closedOnTime += 1;
    }
  }
  return {
    total: scars.length,
    open,
    closed,
    closedOnTime,
    onTimeRate: dueKnown > 0 ? Math.round((closedOnTime / dueKnown) * 100) : null,
    avgClosureDays: closed > 0 ? Math.round(totalDays / closed) : 0,
  };
}

// ── Component scores (0–100, higher is better) ─────────────────────────────────
/** Map PPM to a 0–100 score: 0 ppm → 100, ≥5000 ppm → 0 (linear, EMS-tuned). */
export function ppmToScore(ppm: number | null): number | null {
  if (ppm == null) return null;
  return Math.max(0, Math.min(100, Math.round(100 - ppm / 50)));
}

export interface CertInput {
  status?: string | null; // VALID | EXPIRING | EXPIRED | REVOKED
}
/** Cert health: share of certs that are still current (VALID or EXPIRING). null if none. */
export function certScore(certs: CertInput[]): number | null {
  if (!certs.length) return null;
  const ok = certs.filter((c) => {
    const s = String(c.status ?? 'VALID').toUpperCase();
    return s === 'VALID' || s === 'EXPIRING';
  }).length;
  return Math.round((ok / certs.length) * 100);
}

// ── Composite grade ────────────────────────────────────────────────────────────
/**
 * Weights are documented and intentionally simple. Missing components (null) are
 * dropped and the remaining weights renormalized, so a supplier is never punished
 * for data we don't have — only graded on what we can actually measure.
 */
export const SCORECARD_WEIGHTS = { otd: 0.35, ppm: 0.3, scar: 0.2, cert: 0.15 } as const;

export interface CompositeInput {
  otdScore: number | null; // OTD % already 0–100
  ppmScore: number | null;
  scarScore: number | null; // SCAR on-time closure rate
  certScore: number | null;
}
export interface CompositeResult {
  composite: number | null;
  grade: 'A' | 'B' | 'C' | 'NA';
  color: string;
  parts: { key: string; weight: number; score: number }[];
}

export function gradeFromScore(score: number | null): { grade: 'A' | 'B' | 'C' | 'NA'; color: string } {
  if (score == null) return { grade: 'NA', color: '#6b7280' };
  if (score >= 85) return { grade: 'A', color: '#10b981' };
  if (score >= 70) return { grade: 'B', color: '#f59e0b' };
  return { grade: 'C', color: '#ef4444' };
}

export function buildComposite(input: CompositeInput): CompositeResult {
  const entries: { key: string; weight: number; score: number }[] = [];
  if (input.otdScore != null) entries.push({ key: 'otd', weight: SCORECARD_WEIGHTS.otd, score: input.otdScore });
  if (input.ppmScore != null) entries.push({ key: 'ppm', weight: SCORECARD_WEIGHTS.ppm, score: input.ppmScore });
  if (input.scarScore != null) entries.push({ key: 'scar', weight: SCORECARD_WEIGHTS.scar, score: input.scarScore });
  if (input.certScore != null) entries.push({ key: 'cert', weight: SCORECARD_WEIGHTS.cert, score: input.certScore });
  if (!entries.length) return { composite: null, grade: 'NA', color: '#6b7280', parts: [] };
  const wsum = entries.reduce((a, e) => a + e.weight, 0);
  const composite = Math.round(entries.reduce((a, e) => a + e.score * e.weight, 0) / wsum);
  return { composite, ...gradeFromScore(composite), parts: entries };
}

// ── AVL "who supplies this part?" ranking ──────────────────────────────────────
export interface PartCandidate {
  approvalStatus?: string | null;
  otdPct?: number | null;
  ppm?: number | null;
  unitPrice?: number | null;
  leadTimeDays?: number | null;
}
/** Blended performance score for ranking approved sources (OTD + incoming quality). */
export function candidatePerfScore(c: PartCandidate): number {
  const otd = c.otdPct != null ? c.otdPct : 70; // neutral when unknown
  const ppmS = ppmToScore(c.ppm ?? null);
  const quality = ppmS != null ? ppmS : 70;
  return Math.round(otd * 0.5 + quality * 0.5);
}

/**
 * Select the APPROVED sources for a part and rank them by performance, then by
 * price, then by lead time. Used by GET /suppliers/for-part — answers the
 * buyer's "who can I buy AX-DRIVE-100 from?" with the best source on top.
 */
export function selectAndRankForPart<T extends PartCandidate>(candidates: T[]): T[] {
  return candidates
    .filter((c) => String(c.approvalStatus ?? '').toUpperCase() === 'APPROVED')
    .map((c) => ({ c, perf: candidatePerfScore(c) }))
    .sort((a, b) => {
      if (b.perf !== a.perf) return b.perf - a.perf;
      const pa = a.c.unitPrice ?? Number.POSITIVE_INFINITY;
      const pb = b.c.unitPrice ?? Number.POSITIVE_INFINITY;
      if (pa !== pb) return pa - pb;
      const la = a.c.leadTimeDays ?? Number.POSITIVE_INFINITY;
      const lb = b.c.leadTimeDays ?? Number.POSITIVE_INFINITY;
      return la - lb;
    })
    .map((x) => x.c);
}

// ── Monthly trend (OTD & PPM over time) ────────────────────────────────────────
export interface TrendPoint { month: string; otdPct: number | null; ppm: number | null }

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Bucket OTD (by PO received date) and PPM (by inspection date) into the last
 * `months` calendar months so the 360 can show whether a supplier is improving
 * or sliding. Returns oldest → newest.
 */
export function monthlyTrend(orders: OtdInput[], inspections: PpmInput[], now: Date, months = 6): TrendPoint[] {
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(monthKey(d));
  }
  const otdBucket = new Map<string, { on: number; elig: number }>();
  for (const po of orders) {
    if (po.status && !RECEIVED_STATES.has(String(po.status).toUpperCase())) continue;
    const target = po.promisedDate ?? po.requiredDate;
    if (!target || !po.receivedDate) continue;
    const k = monthKey(new Date(po.receivedDate));
    const b = otdBucket.get(k) ?? { on: 0, elig: 0 };
    b.elig += 1;
    if (new Date(po.receivedDate).getTime() <= new Date(target).getTime() + DAY_MS) b.on += 1;
    otdBucket.set(k, b);
  }
  const ppmBucket = new Map<string, { def: number; insp: number }>();
  for (const ins of inspections) {
    if (!ins.createdAt) continue;
    const sample = Number(ins.sampleSize ?? 0);
    if (!(sample > 0)) continue;
    const k = monthKey(new Date(ins.createdAt));
    const b = ppmBucket.get(k) ?? { def: 0, insp: 0 };
    b.insp += sample;
    b.def += Math.max(0, Number(ins.defectsFound ?? 0));
    ppmBucket.set(k, b);
  }
  return keys.map((month) => {
    const o = otdBucket.get(month);
    const p = ppmBucket.get(month);
    return {
      month,
      otdPct: o && o.elig > 0 ? Math.round((o.on / o.elig) * 1000) / 10 : null,
      ppm: p && p.insp > 0 ? Math.round((p.def / p.insp) * 1_000_000) : null,
    };
  });
}
