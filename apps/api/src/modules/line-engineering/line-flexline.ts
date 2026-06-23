/**
 * Pure, side-effect-free flex-line (multi-model) analysis (Fase 40).
 *
 * A physical line usually builds several models, each with its own routing. The
 * layout question for a flex line is how much the models SHARE: which stations
 * are common to every model (the fixed backbone) versus model-specific (the
 * changeover surface), and how balanced/heavy each model is on the shared line.
 * High commonality means cheap, fast changeovers; low commonality flags a line
 * that is really several lines wearing a trench coat.
 *
 * Kept pure so the set math can be unit-tested without a database or a canvas.
 */

export interface FlexModelRoute {
  model: string;
  revision: string;
  /** Station names in routing order. */
  stations: string[];
  /** Slowest station cycle time (the model's line cycle), seconds. */
  bottleneckSec: number;
}

export interface FlexStationUsage {
  station: string;
  /** Model labels that use this station. */
  models: string[];
  usageCount: number;
  /** Used by every model on the line. */
  sharedByAll: boolean;
}

export interface FlexModelSummary {
  model: string;
  revision: string;
  label: string;
  stationCount: number;
  /** Stations only this model uses (its changeover surface). */
  uniqueStations: number;
  bottleneckSec: number;
}

export interface FlexLineResult {
  line: string;
  modelCount: number;
  models: FlexModelSummary[];
  stations: FlexStationUsage[];
  /** Stations used by EVERY model — the fixed backbone. */
  sharedStations: number;
  totalUniqueStations: number;
  /** sharedStations / totalUniqueStations, % — the line's commonality. */
  commonalityPct: number;
}

function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round((Number(n) || 0) * f) / f;
}

function labelOf(model: string, revision: string): string {
  return revision && revision !== 'A' ? `${model} · ${revision}` : model;
}

export function flexLineAnalysis(
  line: string,
  routes: FlexModelRoute[],
): FlexLineResult {
  const valid = (routes ?? []).filter((r) => r && r.model);
  const modelCount = valid.length;

  // station → ordered, de-duped list of model labels that use it.
  const usage = new Map<string, string[]>();
  for (const r of valid) {
    const label = labelOf(r.model, r.revision);
    const seen = new Set<string>();
    for (const st of r.stations ?? []) {
      if (seen.has(st)) continue; // a station counts once per model
      seen.add(st);
      const arr = usage.get(st) ?? [];
      arr.push(label);
      usage.set(st, arr);
    }
  }

  const stations: FlexStationUsage[] = [...usage.entries()]
    .map(([station, models]) => ({
      station,
      models,
      usageCount: models.length,
      sharedByAll: modelCount > 0 && models.length === modelCount,
    }))
    .sort(
      (a, b) =>
        b.usageCount - a.usageCount || a.station.localeCompare(b.station),
    );

  const uniqueCountByStation = new Map(
    stations.map((s) => [s.station, s.usageCount]),
  );

  const models: FlexModelSummary[] = valid.map((r) => {
    const own = new Set(r.stations ?? []);
    const uniqueStations = [...own].filter(
      (st) => (uniqueCountByStation.get(st) ?? 0) === 1,
    ).length;
    return {
      model: r.model,
      revision: r.revision,
      label: labelOf(r.model, r.revision),
      stationCount: own.size,
      uniqueStations,
      bottleneckSec: round(Math.max(0, Number(r.bottleneckSec) || 0)),
    };
  });

  const sharedStations = stations.filter((s) => s.sharedByAll).length;
  const totalUniqueStations = stations.length;

  return {
    line,
    modelCount,
    models,
    stations,
    sharedStations,
    totalUniqueStations,
    commonalityPct:
      totalUniqueStations > 0
        ? round((sharedStations / totalUniqueStations) * 100, 1)
        : 0,
  };
}
