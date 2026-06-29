export type SlideLayerIssueFilter =
  | 'all'
  | 'review'
  | 'offCanvas'
  | 'hidden'
  | 'locked'
  | 'animated'
  | 'commented'
  | 'linked'
  | 'smartObject';

export interface SlideLayerItem {
  idx: number;
  label: string;
  type: string;
  visible: boolean;
  locked: boolean;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  objectId?: string;
  commentCount?: number;
  animation?: string;
  hasLink?: boolean;
  smartObjectSource?: string;
  smartObjectUpdatedAt?: string;
}

export interface SlideLayerInsight extends SlideLayerItem {
  offCanvas: boolean;
  animated: boolean;
  commented: boolean;
  linked: boolean;
  smartObjectPending: boolean;
  issueCount: number;
}

export interface SlideLayerSummary {
  total: number;
  visible: number;
  hidden: number;
  locked: number;
  animated: number;
  commented: number;
  linked: number;
  offCanvas: number;
  smartObjectPending: number;
  needsReview: number;
  types: string[];
  warnings: string[];
}

export interface AnalyzeSlideLayersOptions {
  width?: number;
  height?: number;
  tolerance?: number;
}

export interface SlideLayerFilterOptions {
  query?: string;
  type?: string;
  issue?: SlideLayerIssueFilter;
}

export function normalizeLayerQuery(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function numberOr(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isOffCanvas(item: SlideLayerItem, width: number, height: number, tolerance: number): boolean {
  const left = numberOr(item.left);
  const top = numberOr(item.top);
  const w = Math.abs(numberOr(item.width));
  const h = Math.abs(numberOr(item.height));
  if (!w && !h) return false;
  return left < -tolerance || top < -tolerance || left + w > width + tolerance || top + h > height + tolerance;
}

function isAnimated(item: SlideLayerItem): boolean {
  const effect = String(item.animation ?? '').trim();
  return !!effect && effect !== 'none';
}

function isSmartObjectPending(item: SlideLayerItem): boolean {
  const source = String(item.smartObjectSource ?? '').trim().toLowerCase();
  if (!source || source === 'manual' || source === 'static' || source === 'none') return false;
  return !String(item.smartObjectUpdatedAt ?? '').trim();
}

function insightSearchText(item: SlideLayerInsight): string {
  return normalizeLayerQuery([
    item.idx + 1,
    item.label,
    item.type,
    item.objectId,
    item.offCanvas ? 'off canvas bounds fuera limite' : '',
    !item.visible ? 'hidden oculto' : '',
    item.locked ? 'locked bloqueado' : '',
    item.animated ? 'animated animado' : '',
    item.commented ? 'commented comentarios review' : '',
    item.linked ? 'linked link hyperlink' : '',
    item.smartObjectPending ? 'smart object axos pending refresh contract' : '',
  ].filter(Boolean).join(' '));
}

function matchesIssue(item: SlideLayerInsight, issue: SlideLayerIssueFilter): boolean {
  if (issue === 'all') return true;
  if (issue === 'review') return item.issueCount > 0;
  if (issue === 'offCanvas') return item.offCanvas;
  if (issue === 'hidden') return !item.visible;
  if (issue === 'locked') return item.locked;
  if (issue === 'animated') return item.animated;
  if (issue === 'commented') return item.commented;
  if (issue === 'linked') return item.linked;
  return item.smartObjectPending;
}

export function analyzeSlideLayers(
  items: readonly SlideLayerItem[],
  options: AnalyzeSlideLayersOptions = {},
): { items: SlideLayerInsight[]; summary: SlideLayerSummary } {
  const width = options.width ?? 960;
  const height = options.height ?? 540;
  const tolerance = options.tolerance ?? 4;

  const insights = items.map((item) => {
    const offCanvas = isOffCanvas(item, width, height, tolerance);
    const animated = isAnimated(item);
    const commented = numberOr(item.commentCount) > 0;
    const linked = !!item.hasLink;
    const smartObjectPending = isSmartObjectPending(item);
    const issueCount = [
      offCanvas,
      !item.visible,
      item.locked,
      animated,
      commented,
      linked,
      smartObjectPending,
    ].filter(Boolean).length;
    return { ...item, offCanvas, animated, commented, linked, smartObjectPending, issueCount };
  });

  const summary: SlideLayerSummary = {
    total: insights.length,
    visible: insights.filter((item) => item.visible).length,
    hidden: insights.filter((item) => !item.visible).length,
    locked: insights.filter((item) => item.locked).length,
    animated: insights.filter((item) => item.animated).length,
    commented: insights.filter((item) => item.commented).length,
    linked: insights.filter((item) => item.linked).length,
    offCanvas: insights.filter((item) => item.offCanvas).length,
    smartObjectPending: insights.filter((item) => item.smartObjectPending).length,
    needsReview: insights.filter((item) => item.issueCount > 0).length,
    types: [...new Set(insights.map((item) => item.type).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    warnings: [],
  };

  summary.warnings = [
    summary.offCanvas ? `${summary.offCanvas} object(s) are outside the slide bounds.` : '',
    summary.hidden ? `${summary.hidden} hidden object(s) should be confirmed before export.` : '',
    summary.locked ? `${summary.locked} locked object(s) may block late edits.` : '',
    summary.commented ? `${summary.commented} object(s) have open review comments.` : '',
    summary.smartObjectPending ? `${summary.smartObjectPending} AXOS Smart Object(s) need source refresh confirmation.` : '',
  ].filter(Boolean);

  return { items: insights, summary };
}

export function filterSlideLayerInsights(
  items: readonly SlideLayerInsight[],
  options: SlideLayerFilterOptions = {},
): SlideLayerInsight[] {
  const query = normalizeLayerQuery(options.query ?? '');
  const queryTerms = query.split(/\s+/).filter(Boolean);
  const type = options.type ?? 'all';
  const issue = options.issue ?? 'all';

  return items.filter((item) => {
    if (type !== 'all' && item.type !== type) return false;
    if (!matchesIssue(item, issue)) return false;
    if (!queryTerms.length) return true;
    const searchText = insightSearchText(item);
    return queryTerms.every((term) => searchText.includes(term));
  });
}
