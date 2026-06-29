export interface SlideLayerItem {
  idx: number;
  label: string;
  type: string;
  visible: boolean;
  locked: boolean;
}

export type SlideLayerStatusFilter = 'all' | 'visible' | 'hidden' | 'locked' | 'unlocked';

export interface SlideLayerFilterState {
  query?: string;
  status?: SlideLayerStatusFilter;
  type?: string;
}

export interface SlideLayerTypeOption {
  type: string;
  count: number;
}

export interface SlideLayerSummary {
  total: number;
  visible: number;
  hidden: number;
  locked: number;
  unlocked: number;
  types: SlideLayerTypeOption[];
}

export interface SlideLayerPanelModel {
  ordered: SlideLayerItem[];
  filtered: SlideLayerItem[];
  summary: SlideLayerSummary;
  hasFilters: boolean;
  normalizedQuery: string;
  status: SlideLayerStatusFilter;
  type: string;
}

function normalized(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function safeType(item: SlideLayerItem): string {
  return item.type.trim() || 'Objeto';
}

export function summarizeSlideLayers(items: SlideLayerItem[]): SlideLayerSummary {
  const typeCounts = new Map<string, number>();
  let visible = 0;
  let locked = 0;

  for (const item of items) {
    if (item.visible) visible += 1;
    if (item.locked) locked += 1;
    const type = safeType(item);
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  }

  const types = Array.from(typeCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));

  return {
    total: items.length,
    visible,
    hidden: items.length - visible,
    locked,
    unlocked: items.length - locked,
    types,
  };
}

export function matchesSlideLayer(item: SlideLayerItem, state: SlideLayerFilterState = {}): boolean {
  const query = normalized(state.query);
  const status = state.status ?? 'all';
  const type = normalized(state.type);

  if (status === 'visible' && !item.visible) return false;
  if (status === 'hidden' && item.visible) return false;
  if (status === 'locked' && !item.locked) return false;
  if (status === 'unlocked' && item.locked) return false;
  if (type && type !== 'all' && normalized(item.type) !== type) return false;
  if (!query) return true;

  return [
    item.label,
    item.type,
    `z ${item.idx + 1}`,
    `#${item.idx + 1}`,
    item.visible ? 'visible' : 'hidden',
    item.locked ? 'locked' : 'unlocked',
  ].some((part) => normalized(part).includes(query));
}

export function buildSlideLayerPanelModel(items: SlideLayerItem[], state: SlideLayerFilterState = {}): SlideLayerPanelModel {
  const ordered = [...items].reverse();
  const status = state.status ?? 'all';
  const normalizedQuery = normalized(state.query);
  const type = normalized(state.type || 'all') || 'all';
  const filtered = ordered.filter((item) => matchesSlideLayer(item, { query: normalizedQuery, status, type }));

  return {
    ordered,
    filtered,
    summary: summarizeSlideLayers(items),
    hasFilters: !!normalizedQuery || status !== 'all' || type !== 'all',
    normalizedQuery,
    status,
    type,
  };
}
