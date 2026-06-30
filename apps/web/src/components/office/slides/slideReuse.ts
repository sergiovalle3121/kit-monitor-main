/* eslint-disable @typescript-eslint/no-explicit-any */

const TEXT_TYPES = new Set(['textbox', 'i-text', 'text', 'fabrictext']);

export interface SlideReuseSource {
  slide: any;
  note?: string;
  transition?: string;
  transDur?: number;
}

export type SlideReuseFilter = 'all' | 'withNotes' | 'missingTitle' | 'withTransition';

export interface SlideReuseSearchItem<T extends SlideReuseSource = SlideReuseSource> {
  index: number;
  item: T;
  title: string;
  body: string;
  objectCount: number;
  textCount: number;
  hasTitle: boolean;
  hasNotes: boolean;
  hasTransition: boolean;
  searchText: string;
}

export interface SlideReuseSummary {
  slideCount: number;
  withNotes: number;
  missingTitles: number;
  withTransitions: number;
}

function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function collectTextObjects(node: any, out: any[] = []): any[] {
  if (!node) return out;
  if (Array.isArray(node)) {
    node.forEach((item) => collectTextObjects(item, out));
    return out;
  }
  const type = typeof node.type === 'string' ? node.type.toLowerCase() : '';
  if (TEXT_TYPES.has(type) && cleanText(node.text)) out.push(node);
  if (Array.isArray(node.objects)) collectTextObjects(node.objects, out);
  return out;
}

export function getReuseSlideText(slide: any): string[] {
  return collectTextObjects(slide?.objects ?? []).map((item) => cleanText(item.text)).filter(Boolean);
}

export function buildSlideReuseItems<T extends SlideReuseSource>(items: T[]): SlideReuseSearchItem<T>[] {
  return items.map((item, index) => {
    const textRuns = getReuseSlideText(item.slide);
    const title = cleanText(textRuns[0] ?? '');
    const body = textRuns.slice(1).join('  -  ');
    const note = cleanText(item.note);
    const transition = cleanText(item.transition);
    const hasTransition = !!transition && transition !== 'none';
    return {
      index,
      item,
      title,
      body,
      objectCount: Array.isArray(item.slide?.objects) ? item.slide.objects.length : 0,
      textCount: textRuns.length,
      hasTitle: !!title,
      hasNotes: !!note,
      hasTransition,
      searchText: cleanText(`${index + 1} ${title} ${body} ${note} ${transition}`).toLowerCase(),
    };
  });
}

export function filterSlideReuseItems<T extends SlideReuseSource>(
  items: SlideReuseSearchItem<T>[],
  query: string,
  filter: SlideReuseFilter,
): SlideReuseSearchItem<T>[] {
  const q = cleanText(query).toLowerCase();
  return items.filter((item) => {
    const inFilter = filter === 'all'
      || (filter === 'withNotes' && item.hasNotes)
      || (filter === 'missingTitle' && !item.hasTitle)
      || (filter === 'withTransition' && item.hasTransition);
    return inFilter && (!q || item.searchText.includes(q));
  });
}

export function summarizeSlideReuseItems(items: SlideReuseSearchItem[]): SlideReuseSummary {
  return {
    slideCount: items.length,
    withNotes: items.filter((item) => item.hasNotes).length,
    missingTitles: items.filter((item) => !item.hasTitle).length,
    withTransitions: items.filter((item) => item.hasTransition).length,
  };
}
