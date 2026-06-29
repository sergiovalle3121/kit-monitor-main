/* eslint-disable @typescript-eslint/no-explicit-any */

const TEXT_TYPES = new Set(['textbox', 'i-text', 'text']);

export interface SlideOutlineEntry {
  index: number;
  title: string;
  body: string;
  searchableText: string;
  objectCount: number;
  textObjectCount: number;
  characterCount: number;
  hasTitle: boolean;
  isEmpty: boolean;
  isDense: boolean;
  warnings: string[];
}

export interface SlideOutlineStats {
  totalSlides: number;
  missingTitles: number;
  emptySlides: number;
  denseSlides: number;
  totalObjects: number;
}

function isTextObject(o: any): boolean {
  return TEXT_TYPES.has(String(o?.type ?? '').toLowerCase());
}

function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function buildSlideOutlineEntries(slides: any[]): SlideOutlineEntry[] {
  return (slides ?? []).map((slide, index) => {
    const objects = Array.isArray(slide?.objects) ? slide.objects : [];
    const textObjects = objects.filter(isTextObject);
    const textParts = textObjects.map((o: any) => cleanText(o?.text)).filter(Boolean);
    const title = textParts[0] ?? '';
    const body = textParts.slice(1).join('  -  ');
    const characterCount = textParts.join(' ').length;
    const warnings: string[] = [];

    if (!title) warnings.push('Sin titulo');
    if (!objects.length) warnings.push('Vacia');
    if (characterCount > 520) warnings.push('Texto denso');

    return {
      index,
      title,
      body,
      searchableText: [title, body, ...warnings].join(' ').toLowerCase(),
      objectCount: objects.length,
      textObjectCount: textObjects.length,
      characterCount,
      hasTitle: !!title,
      isEmpty: objects.length === 0,
      isDense: characterCount > 520,
      warnings,
    };
  });
}

export function filterSlideOutlineEntries(entries: SlideOutlineEntry[], query: string): SlideOutlineEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((entry) => entry.searchableText.includes(q) || String(entry.index + 1) === q);
}

export function summarizeSlideOutline(entries: SlideOutlineEntry[]): SlideOutlineStats {
  return entries.reduce<SlideOutlineStats>((stats, entry) => ({
    totalSlides: stats.totalSlides + 1,
    missingTitles: stats.missingTitles + (entry.hasTitle ? 0 : 1),
    emptySlides: stats.emptySlides + (entry.isEmpty ? 1 : 0),
    denseSlides: stats.denseSlides + (entry.isDense ? 1 : 0),
    totalObjects: stats.totalObjects + entry.objectCount,
  }), { totalSlides: 0, missingTitles: 0, emptySlides: 0, denseSlides: 0, totalObjects: 0 });
}
