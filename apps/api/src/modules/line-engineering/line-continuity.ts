/**
 * Pure, side-effect-free line-continuity topology for the 2D layout (Fase 45).
 *
 * line-flow.ts (Fase 10) measures the GEOMETRY of the material path — how far it
 * travels and where the lines tangle. This answers the complementary, topological
 * question every line review asks: is the flow actually ONE continuous, ordered
 * path that visits every station? It walks the directed connector graph and
 * reports the breaks — stations wired to nothing, the path split into several
 * disconnected pieces, more than one start or one end, splits/merges, and
 * back-flow links that run against the build sequence — plus a single continuity
 * index 0..100.
 *
 * Kept pure so the rules can be unit-tested without a database or a canvas.
 */

export interface ContinuityStation {
  id: string;
  station: string; // human label, e.g. "EST-10"
  sequence: number;
}

export interface ContinuityLink {
  from: string; // station id
  to: string; // station id
  kind?: string; // 'flow' | 'conveyor' | 'return' ...
}

export interface ContinuityInput {
  stations: ContinuityStation[];
  links: ContinuityLink[];
}

export interface ContinuityNodeRef {
  id: string;
  station: string;
}

export interface ContinuityBackLink {
  from: string;
  to: string;
  fromStation: string;
  toStation: string;
}

export interface ContinuityResult {
  stationCount: number;
  /** Links whose endpoints are both known stations (self-loops excluded). */
  linkCount: number;
  /** Links referencing an unknown station id (ignored by the topology). */
  danglingLinks: number;
  /** Weakly-connected components over all stations (a clean line has 1). */
  components: number;
  /** Stations with no incident link at all — not wired into the flow. */
  isolated: ContinuityNodeRef[];
  /** In-degree 0 with at least one out-link — line entry points (expect 1). */
  sources: ContinuityNodeRef[];
  /** Out-degree 0 with at least one in-link — line exit points (expect 1). */
  sinks: ContinuityNodeRef[];
  /** Nodes where the path splits or merges (in- or out-degree > 1). */
  branches: ContinuityNodeRef[];
  /** Links running against the build sequence (excluding intentional returns). */
  backFlow: ContinuityBackLink[];
  /** Stations reached by a directed walk from the start (0 when no links). */
  reached: number;
  /** 100 * reached / stationCount, the headline continuity index. */
  continuityPct: number;
  /**
   * True iff the flow is one clean ordered path: a single component, exactly one
   * source and one sink, nothing isolated, no splits/merges, no back-flow, and
   * the directed walk reaches every station.
   */
  continuous: boolean;
  /** Human-readable Spanish issues, most important first. */
  issues: string[];
}

function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round((Number(n) || 0) * f) / f;
}

/** Validate the connector graph topology of a line layout (pure). */
export function computeContinuity(input: ContinuityInput): ContinuityResult {
  const stations = input.stations ?? [];
  const links = input.links ?? [];
  const byId = new Map(stations.map((s) => [s.id, s]));
  const ref = (id: string): ContinuityNodeRef => ({ id, station: byId.get(id)?.station ?? id });

  // Keep only links between two distinct, known stations; the rest are dangling.
  const valid = links.filter((l) => byId.has(l.from) && byId.has(l.to) && l.from !== l.to);
  const danglingLinks = links.length - valid.length;

  const outDeg = new Map<string, number>();
  const inDeg = new Map<string, number>();
  const adjOut = new Map<string, string[]>();
  const undirected = new Map<string, Set<string>>();
  for (const s of stations) {
    outDeg.set(s.id, 0);
    inDeg.set(s.id, 0);
    adjOut.set(s.id, []);
    undirected.set(s.id, new Set());
  }
  for (const l of valid) {
    outDeg.set(l.from, (outDeg.get(l.from) || 0) + 1);
    inDeg.set(l.to, (inDeg.get(l.to) || 0) + 1);
    adjOut.get(l.from)!.push(l.to);
    undirected.get(l.from)!.add(l.to);
    undirected.get(l.to)!.add(l.from);
  }

  const isolated = stations.filter((s) => undirected.get(s.id)!.size === 0).map((s) => ref(s.id));
  const sources = stations
    .filter((s) => (inDeg.get(s.id) || 0) === 0 && (outDeg.get(s.id) || 0) >= 1)
    .map((s) => ref(s.id));
  const sinks = stations
    .filter((s) => (outDeg.get(s.id) || 0) === 0 && (inDeg.get(s.id) || 0) >= 1)
    .map((s) => ref(s.id));
  const branches = stations
    .filter((s) => (outDeg.get(s.id) || 0) > 1 || (inDeg.get(s.id) || 0) > 1)
    .map((s) => ref(s.id));

  // Back-flow: a link whose target sits earlier in the build sequence than its
  // source — material running backwards — unless it's an intentional return.
  const backFlow: ContinuityBackLink[] = valid
    .filter((l) => (l.kind ?? '') !== 'return' && byId.get(l.to)!.sequence < byId.get(l.from)!.sequence)
    .map((l) => ({
      from: l.from,
      to: l.to,
      fromStation: byId.get(l.from)!.station,
      toStation: byId.get(l.to)!.station,
    }));

  // Weakly-connected components over every station (isolated ones are singletons).
  const seen = new Set<string>();
  let components = 0;
  for (const s of stations) {
    if (seen.has(s.id)) continue;
    components++;
    const stack = [s.id];
    seen.add(s.id);
    while (stack.length) {
      const cur = stack.pop()!;
      for (const nb of undirected.get(cur)!) {
        if (!seen.has(nb)) {
          seen.add(nb);
          stack.push(nb);
        }
      }
    }
  }

  // Reachability along directed edges from the line start: the lowest-sequence
  // source, or — failing a clear source — the lowest-sequence station overall.
  let reached = 0;
  if (valid.length > 0) {
    const pool = sources.length ? sources.map((r) => byId.get(r.id)!) : stations;
    const start = [...pool].sort((a, b) => a.sequence - b.sequence)[0];
    if (start) {
      const vis = new Set<string>([start.id]);
      const stack = [start.id];
      while (stack.length) {
        const cur = stack.pop()!;
        for (const nb of adjOut.get(cur)!) {
          if (!vis.has(nb)) {
            vis.add(nb);
            stack.push(nb);
          }
        }
      }
      reached = vis.size;
    }
  }

  const stationCount = stations.length;
  const continuityPct = stationCount ? round((100 * reached) / stationCount) : 0;

  const continuous =
    stationCount > 0 &&
    valid.length > 0 &&
    components === 1 &&
    isolated.length === 0 &&
    sources.length === 1 &&
    sinks.length === 1 &&
    branches.length === 0 &&
    backFlow.length === 0 &&
    reached === stationCount;

  const issues: string[] = [];
  if (stationCount === 0) {
    issues.push('No hay estaciones que evaluar');
  } else if (valid.length === 0) {
    issues.push('No hay conexiones de flujo dibujadas');
  } else {
    if (isolated.length) issues.push(`${isolated.length} estación(es) sin conectar al flujo`);
    if (components > 1) issues.push(`El flujo está partido en ${components} tramos inconexos`);
    if (sources.length === 0) issues.push('El flujo no tiene un inicio claro (posible ciclo)');
    else if (sources.length > 1) issues.push(`${sources.length} inicios de línea (debería haber 1)`);
    if (sinks.length === 0) issues.push('El flujo no tiene un final claro (posible ciclo)');
    else if (sinks.length > 1) issues.push(`${sinks.length} finales de línea (debería haber 1)`);
    if (branches.length) issues.push(`${branches.length} estación(es) con ramificación (división o unión del flujo)`);
    if (backFlow.length) issues.push(`${backFlow.length} conexión(es) en contraflujo (van contra la secuencia)`);
    if (components === 1 && reached < stationCount) {
      issues.push(`El recorrido dirigido sólo alcanza ${reached} de ${stationCount} estaciones`);
    }
  }

  return {
    stationCount,
    linkCount: valid.length,
    danglingLinks,
    components,
    isolated,
    sources,
    sinks,
    branches,
    backFlow,
    reached,
    continuityPct,
    continuous,
    issues,
  };
}
