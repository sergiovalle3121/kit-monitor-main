'use client';

/**
 * Global-search index for the command palette (⌘K).
 *
 * There is no single "/search" endpoint in the backend, so real cross-entity
 * search is assembled client-side from the list endpoints each module already
 * exposes:
 *
 *   • WO        → GET /production-plan         (SfWorkOrder[])
 *   • NCR       → GET /ncr                     (NCR[])
 *   • Parts     → GET /product-models          (ProductModel[])
 *
 * The lists are fetched once, normalized into a flat `SearchHit[]` index with a
 * precomputed lowercase `haystack`, and cached for a short TTL so typing filters
 * locally without re-hitting the network on every keystroke. Each source is
 * loaded independently (Promise.all + per-source guards): if one is forbidden or
 * down it lands in `degraded` and the others still work — the palette stays
 * honest about what it could and couldn't reach.
 */

import { apiFetch } from '@/lib/apiFetch';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

export type SearchKind = 'wo' | 'ncr' | 'part';

/** Order groups are presented in (records first, navigation is appended by the UI). */
export const ENTITY_ORDER: SearchKind[] = ['wo', 'ncr', 'part'];

/** Max hits rendered per group so one noisy source can't drown the rest. */
const PER_GROUP = 6;

/** How long a built index stays warm. Re-opening the palette within this window is instant. */
const TTL_MS = 45_000;

export interface SearchHit {
  kind: SearchKind;
  id: string;        // unique, used as React key + selection id
  title: string;     // primary line (folio / number / name / title)
  subtitle: string;  // secondary line (context)
  badge?: string;    // status / type pill
  href: string;      // navigation target (detail page where one exists)
  haystack: string;  // precomputed lowercase text to match against
  score: number;     // filled in during filtering
  ts: number;        // recency (ms) for tie-breaking; 0 when unknown
}

export interface SearchIndex {
  hits: SearchHit[];
  /** Sources that failed to load (forbidden / network / shape) — surfaced honestly in the UI. */
  degraded: SearchKind[];
  /** True when *no* source could be reached at all (e.g. session expired). */
  authError: boolean;
}

// ── Fetch helper ─────────────────────────────────────────────────────────────

interface RawResult {
  ok: boolean;
  status: number;
  data: unknown;
}

async function getJson(path: string, signal?: AbortSignal): Promise<RawResult> {
  try {
    const res = await apiFetch(`${API_BASE}${path}`, { signal });
    if (!res.ok) return { ok: false, status: res.status, data: null };
    const json = await res.json().catch(() => null);
    // Unwrap { success, data } envelopes the same way useApi's fetcher does.
    const data =
      json && typeof json === 'object' && 'data' in json && 'success' in json
        ? (json as { data: unknown }).data
        : json;
    return { ok: true, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

function asArray<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

function ts(value: unknown): number {
  if (!value) return 0;
  const t = new Date(value as string).getTime();
  return Number.isFinite(t) ? t : 0;
}

function lower(...parts: Array<string | number | null | undefined>): string {
  return parts.filter((p) => p !== null && p !== undefined && p !== '').join(' ').toLowerCase();
}

// ── Per-source normalizers ─────────────────────────────────────────────────

interface RawWo { id: string; folio?: string | null; model?: string; line?: string; customer?: string | null; status?: string; priority?: string; quantityPlanned?: number; quantityCompleted?: number; publishedAt?: string; scheduledDate?: string }
interface RawNcr { id: number; ncrNumber: string; partNumber?: string; model?: string; workOrder?: string; category?: string; description?: string; status?: string; customer?: string; createdAt?: string }
interface RawPart { id: string; modelNumber: string; name: string; customer?: string | null; revision?: string; status?: string; createdAt?: string }

function mapWos(rows: RawWo[]): SearchHit[] {
  return rows.map((w) => {
    const planned = w.quantityPlanned ?? 0;
    const done = w.quantityCompleted ?? 0;
    const subtitle = [w.model, w.line ? `Línea ${w.line}` : '', planned ? `${done}/${planned} u` : '']
      .filter(Boolean)
      .join(' · ');
    return {
      kind: 'wo' as const,
      id: `wo:${w.id}`,
      title: w.folio || w.model || 'WO',
      subtitle: subtitle || (w.customer ?? ''),
      badge: w.status,
      href: '/dashboard/production-plan',
      haystack: lower(w.folio, w.model, w.line, w.customer, w.status, w.priority),
      score: 0,
      ts: ts(w.publishedAt) || ts(w.scheduledDate),
    };
  });
}

function mapNcrs(rows: RawNcr[]): SearchHit[] {
  return rows.map((n) => ({
    kind: 'ncr' as const,
    id: `ncr:${n.id}`,
    title: n.ncrNumber,
    subtitle: [n.partNumber, n.model, n.workOrder, n.category].filter(Boolean).join(' · '),
    badge: n.status,
    href: `/dashboard/quality/ncr/${n.id}`,
    haystack: lower(n.ncrNumber, n.partNumber, n.model, n.workOrder, n.category, n.description, n.status, n.customer),
    score: 0,
    ts: ts(n.createdAt),
  }));
}

function mapParts(rows: RawPart[]): SearchHit[] {
  return rows.map((p) => ({
    kind: 'part' as const,
    id: `part:${p.id}`,
    title: p.name || p.modelNumber,
    subtitle: [p.modelNumber, p.customer, p.revision ? `rev ${p.revision}` : ''].filter(Boolean).join(' · '),
    badge: p.status,
    href: `/dashboard/models/${p.id}`,
    haystack: lower(p.modelNumber, p.name, p.customer, p.status),
    score: 0,
    ts: ts(p.createdAt),
  }));
}

// ── Index build + cache ──────────────────────────────────────────────────────

let cache: { at: number; index: SearchIndex } | null = null;
let inflight: Promise<SearchIndex> | null = null;

async function buildIndex(signal?: AbortSignal): Promise<SearchIndex> {
  const [wo, ncr, part] = await Promise.all([
    getJson('/production-plan', signal),
    getJson('/ncr', signal),
    getJson('/product-models', signal),
  ]);

  // If the user kept typing and this load was aborted, don't cache a torn result.
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const hits: SearchHit[] = [];
  const degraded: SearchKind[] = [];

  const collect = (kind: SearchKind, res: RawResult, map: (rows: never[]) => SearchHit[]) => {
    if (res.ok) hits.push(...map(asArray(res.data) as never[]));
    else degraded.push(kind);
  };

  collect('wo', wo, mapWos as never);
  collect('ncr', ncr, mapNcrs as never);
  collect('part', part, mapParts as never);

  return { hits, degraded, authError: degraded.length === ENTITY_ORDER.length };
}

/** Load (or reuse a warm) search index. Concurrent callers share one in-flight build. */
export async function ensureSearchIndex(signal?: AbortSignal): Promise<SearchIndex> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.index;
  if (inflight) return inflight;
  inflight = buildIndex(signal)
    .then((index) => {
      cache = { at: Date.now(), index };
      inflight = null;
      return index;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });
  return inflight;
}

// ── Filtering + scoring ──────────────────────────────────────────────────────

function scoreHit(hit: SearchHit, q: string, terms: string[]): number {
  const title = hit.title.toLowerCase();
  let s = terms.length; // base for an all-terms match
  if (title === q) s += 200;
  else if (title.startsWith(q)) s += 120;
  else if (title.includes(q)) s += 60;
  if (hit.haystack.startsWith(q)) s += 40;
  return s;
}

/**
 * Filter a built index by `query` (all terms must match, AND semantics), score,
 * sort within each group by relevance then recency, and cap per group. Returns a
 * single flat array ordered by `ENTITY_ORDER` — ready for keyboard navigation.
 */
export function filterSearchIndex(index: SearchIndex, query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);

  const buckets: Record<SearchKind, SearchHit[]> = { wo: [], ncr: [], part: [] };
  for (const hit of index.hits) {
    if (!terms.every((t) => hit.haystack.includes(t))) continue;
    buckets[hit.kind].push({ ...hit, score: scoreHit(hit, q, terms) });
  }

  const out: SearchHit[] = [];
  for (const kind of ENTITY_ORDER) {
    buckets[kind].sort((a, b) => b.score - a.score || b.ts - a.ts);
    out.push(...buckets[kind].slice(0, PER_GROUP));
  }
  return out;
}
