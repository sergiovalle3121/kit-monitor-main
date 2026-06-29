/* eslint-disable @typescript-eslint/no-explicit-any */

const TEXT_TYPES = new Set(['textbox', 'i-text', 'text', 'fabrictext']);

export interface SlideNavigationItem {
  index: number;
  title: string;
  body: string;
  section: string;
  sectionStart: boolean;
  objectCount: number;
  textCount: number;
  hasTitle: boolean;
  searchText: string;
}

export interface SlideNavigationSummary {
  slideCount: number;
  sectionCount: number;
  missingTitleCount: number;
  textSlideCount: number;
  objectCount: number;
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

export function getSlideTextRuns(slide: any): string[] {
  return collectTextObjects(slide?.objects ?? []).map((item) => cleanText(item.text)).filter(Boolean);
}

export function getSlideTitle(slide: any): string {
  return cleanText(getSlideTextRuns(slide)[0] ?? '');
}

export function getSlideBody(slide: any): string {
  return getSlideTextRuns(slide).slice(1).join('  -  ');
}

export function buildSlideNavigationItems(slides: any[], sections: (string | null | undefined)[] = []): SlideNavigationItem[] {
  let activeSection = '';
  return slides.map((slide, index) => {
    const sectionLabel = cleanText(sections[index]);
    const sectionStart = !!sectionLabel;
    if (sectionStart) activeSection = sectionLabel;
    const textRuns = getSlideTextRuns(slide);
    const title = cleanText(textRuns[0] ?? '');
    const body = textRuns.slice(1).join('  -  ');
    const objectCount = Array.isArray(slide?.objects) ? slide.objects.length : 0;
    const section = activeSection;
    return {
      index,
      title,
      body,
      section,
      sectionStart,
      objectCount,
      textCount: textRuns.length,
      hasTitle: !!title,
      searchText: cleanText(`${index + 1} ${section} ${title} ${body}`).toLowerCase(),
    };
  });
}

export function getSlideSectionOptions(items: SlideNavigationItem[]): string[] {
  const seen = new Set<string>();
  for (const item of items) {
    if (item.section) seen.add(item.section);
  }
  return [...seen];
}

export function filterSlideNavigationItems(
  items: SlideNavigationItem[],
  query: string,
  section: string = 'all',
): SlideNavigationItem[] {
  const q = cleanText(query).toLowerCase();
  return items.filter((item) => {
    const inSection = section === 'all' || (section === 'none' ? !item.section : item.section === section);
    const inQuery = !q || item.searchText.includes(q);
    return inSection && inQuery;
  });
}

export function summarizeSlideNavigation(items: SlideNavigationItem[]): SlideNavigationSummary {
  return {
    slideCount: items.length,
    sectionCount: getSlideSectionOptions(items).length,
    missingTitleCount: items.filter((item) => !item.hasTitle).length,
    textSlideCount: items.filter((item) => item.textCount > 0).length,
    objectCount: items.reduce((sum, item) => sum + item.objectCount, 0),
  };
}
