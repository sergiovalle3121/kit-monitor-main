/**
 * OEE loss breakdown — pure, side-effect-free Pareto of the big OEE losses (F-Q1).
 *
 * computeOee gives the headline OEE = Availability × Performance × Quality, but a
 * reviewer still needs to know WHERE the points went. This decomposes the gap to
 * 100% into named losses, each in OEE POINTS, so OEE + Σ(losses) = 100, and ranks
 * them as a Pareto (biggest first, with the running cumulative share) — the "start
 * here" list for an improvement team.
 *
 * Decomposition (multiplicative, so the points add up exactly):
 *   Availability loss = (1 − A)            → split across the downtime reasons
 *   Performance loss  = A·(1 − P)          → reduced speed + minor stops (one bucket;
 *                                            the floor data doesn't separate them)
 *   Quality loss      = A·P·(1 − Q)        → defects + startup rejects (one bucket)
 *
 * Kept pure so the math/ranking can be unit-tested without a DB.
 */

/** Human labels for the floor's downtime reason codes (availability losses). */
const REASON_LABEL: Record<string, string> = {
  EQUIPMENT: 'Averías de equipo',
  CHANGEOVER: 'Cambios y ajustes',
  MATERIAL: 'Falta de material',
  NO_OPERATOR: 'Sin operador',
  QUALITY: 'Paros por calidad',
  OTHER: 'Otros paros',
};

export interface LossInput {
  availability: number; // 0..1
  performance: number; // 0..1
  quality: number; // 0..1
  /** Downtime minutes per reason code (optional — used to split availability loss). */
  downtimeByReason?: Partial<Record<string, number>>;
}

export type LossCategory = 'disponibilidad' | 'desempeño' | 'calidad';

export interface OeeLoss {
  key: string;
  label: string;
  category: LossCategory;
  /** Points of OEE lost to this cause (0..100). */
  oeePoints: number;
  /** Running share of the TOTAL loss, % (the Pareto curve; last ≈ 100). */
  cumulativePct: number;
}

export interface LossBreakdownResult {
  /** OEE itself, in points (0..100). */
  oeePct: number;
  /** Total OEE lost = 100 − oeePct. */
  totalLossPct: number;
  /** Losses ranked biggest-first with cumulative %. */
  losses: OeeLoss[];
  /** The #1 loss to attack, or null when the line is perfect. */
  biggest: OeeLoss | null;
  /** True when there is anything to report (always, given a valid factor). */
  scored: boolean;
}

const clamp01 = (n: number): number => {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return v > 1 ? 1 : v;
};
const round = (n: number, dp = 1): number => {
  const f = 10 ** dp;
  return Math.round((Number(n) || 0) * f) / f;
};

/** Roll an OEE factor breakdown into a ranked Pareto of OEE-point losses. */
export function lossBreakdown(input: LossInput): LossBreakdownResult {
  const a = clamp01(input.availability);
  const p = clamp01(input.performance);
  const q = clamp01(input.quality);

  const oee = a * p * q;
  const availLoss = (1 - a) * 100;
  const perfLoss = a * (1 - p) * 100;
  const qualLoss = a * p * (1 - q) * 100;

  const raw: Omit<OeeLoss, 'cumulativePct'>[] = [];

  // Availability loss → split across the actual downtime reasons (proportional to
  // minutes); fall back to a single bucket when no reason detail is available.
  const reasons = Object.entries(input.downtimeByReason ?? {})
    .map(([k, v]) => [k, Math.max(0, Number(v) || 0)] as const)
    .filter(([, v]) => v > 0);
  const totalDown = reasons.reduce((s, [, v]) => s + v, 0);
  if (availLoss > 0) {
    if (totalDown > 0) {
      for (const [reason, mins] of reasons) {
        raw.push({
          key: `down:${reason}`,
          label: REASON_LABEL[reason] ?? reason,
          category: 'disponibilidad',
          oeePoints: availLoss * (mins / totalDown),
        });
      }
    } else {
      raw.push({ key: 'down', label: 'Paros (disponibilidad)', category: 'disponibilidad', oeePoints: availLoss });
    }
  }
  if (perfLoss > 0) {
    raw.push({ key: 'speed', label: 'Velocidad reducida y microparos', category: 'desempeño', oeePoints: perfLoss });
  }
  if (qualLoss > 0) {
    raw.push({ key: 'defects', label: 'Defectos y retrabajo', category: 'calidad', oeePoints: qualLoss });
  }

  const totalLoss = availLoss + perfLoss + qualLoss;
  raw.sort((x, y) => y.oeePoints - x.oeePoints);

  let acc = 0;
  const losses: OeeLoss[] = raw.map((l) => {
    acc += l.oeePoints;
    return {
      key: l.key,
      label: l.label,
      category: l.category,
      oeePoints: round(l.oeePoints),
      cumulativePct: totalLoss > 0 ? round((100 * acc) / totalLoss) : 0,
    };
  });

  return {
    oeePct: round(oee * 100),
    totalLossPct: round(totalLoss),
    losses,
    biggest: losses[0] ?? null,
    scored: true,
  };
}
