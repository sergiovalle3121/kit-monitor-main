export type LayerFilterMode = 'all' | 'visible' | 'hidden' | 'locked' | 'editable';

export interface LayerPanelItem {
  idx: number;
  label: string;
  type: string;
  visible: boolean;
  locked: boolean;
}

export interface LayerPanelFilter {
  query?: string;
  mode?: LayerFilterMode;
  type?: string;
}

export interface LayerPanelStats {
  total: number;
  visible: number;
  hidden: number;
  locked: number;
  editable: number;
  types: { type: string; count: number }[];
}

export const LAYER_FILTERS: { id: LayerFilterMode; label: string }[] = [
  { id: 'all', label: 'Todo' },
  { id: 'visible', label: 'Visible' },
  { id: 'hidden', label: 'Oculto' },
  { id: 'locked', label: 'Bloqueado' },
  { id: 'editable', label: 'Editable' },
];

export function normalizeLayerQuery(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

export function layerPanelStats(items: LayerPanelItem[]): LayerPanelStats {
  const typeCounts = new Map<string, number>();
  for (const item of items) {
    const type = item.type || 'Objeto';
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  }
  const types = Array.from(typeCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));

  const visible = items.filter((item) => item.visible).length;
  const locked = items.filter((item) => item.locked).length;
  return {
    total: items.length,
    visible,
    hidden: items.length - visible,
    locked,
    editable: items.length - locked,
    types,
  };
}

export function filterLayerPanelItems(items: LayerPanelItem[], filter: LayerPanelFilter = {}): LayerPanelItem[] {
  const mode = filter.mode ?? 'all';
  const type = filter.type ?? 'all';
  const query = normalizeLayerQuery(filter.query ?? '');
  return items.filter((item) => {
    if (mode === 'visible' && !item.visible) return false;
    if (mode === 'hidden' && item.visible) return false;
    if (mode === 'locked' && !item.locked) return false;
    if (mode === 'editable' && item.locked) return false;
    if (type !== 'all' && item.type !== type) return false;
    if (!query) return true;
    return normalizeLayerQuery(`${item.label} ${item.type}`).includes(query);
  });
}

export function layerFilterSummary(stats: LayerPanelStats): string {
  if (!stats.total) return '0 objetos';
  const parts = [`${stats.total} objeto${stats.total === 1 ? '' : 's'}`];
  if (stats.hidden) parts.push(`${stats.hidden} oculto${stats.hidden === 1 ? '' : 's'}`);
  if (stats.locked) parts.push(`${stats.locked} bloqueado${stats.locked === 1 ? '' : 's'}`);
  return parts.join(' · ');
}
