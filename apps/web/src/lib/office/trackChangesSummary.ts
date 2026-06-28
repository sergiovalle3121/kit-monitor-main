/* eslint-disable @typescript-eslint/no-explicit-any */

export type TrackedChangeKind = 'insertion' | 'deletion';

export interface TrackedChangeItem {
  id: string;
  type: TrackedChangeKind;
  text: string;
  author: string;
  date: number | null;
  path: string;
}

export interface TrackedChangeAuthorSummary {
  author: string;
  insertions: number;
  deletions: number;
  charactersAdded: number;
  charactersRemoved: number;
}

export interface TrackedChangeSummary {
  total: number;
  insertions: number;
  deletions: number;
  charactersAdded: number;
  charactersRemoved: number;
  authors: TrackedChangeAuthorSummary[];
  items: TrackedChangeItem[];
}

const EMPTY_SUMMARY: TrackedChangeSummary = {
  total: 0,
  insertions: 0,
  deletions: 0,
  charactersAdded: 0,
  charactersRemoved: 0,
  authors: [],
  items: [],
};

function nodeText(node: any): string {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  if (!Array.isArray(node.content)) return '';
  return node.content.map(nodeText).join(' ');
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function getChangeMarks(node: any): Array<{ type: TrackedChangeKind; attrs: any }> {
  if (!Array.isArray(node?.marks)) return [];
  return node.marks
    .filter((mark: any) => mark?.type === 'insertion' || mark?.type === 'deletion')
    .map((mark: any) => ({ type: mark.type as TrackedChangeKind, attrs: mark.attrs ?? {} }));
}

function walk(node: any, path: number[], out: TrackedChangeItem[]) {
  const marks = getChangeMarks(node);
  const text = normalizeText(nodeText(node));
  if (text && marks.length) {
    for (const mark of marks) {
      out.push({
        id: `${path.join('.') || 'root'}:${mark.type}:${out.length}`,
        type: mark.type,
        text,
        author: String(mark.attrs.author || 'Autor desconocido'),
        date: typeof mark.attrs.date === 'number' ? mark.attrs.date : null,
        path: path.join('.') || 'root',
      });
    }
  }

  if (!Array.isArray(node?.content)) return;
  node.content.forEach((child: any, index: number) => walk(child, [...path, index], out));
}

export function summarizeTrackedChanges(content: any): TrackedChangeSummary {
  if (!content || typeof content !== 'object') return EMPTY_SUMMARY;
  const items: TrackedChangeItem[] = [];
  walk(content, [], items);
  if (!items.length) return EMPTY_SUMMARY;

  const authors = new Map<string, TrackedChangeAuthorSummary>();
  let insertions = 0;
  let deletions = 0;
  let charactersAdded = 0;
  let charactersRemoved = 0;

  for (const item of items) {
    const chars = item.text.length;
    const author = authors.get(item.author) ?? { author: item.author, insertions: 0, deletions: 0, charactersAdded: 0, charactersRemoved: 0 };
    if (item.type === 'insertion') {
      insertions += 1;
      charactersAdded += chars;
      author.insertions += 1;
      author.charactersAdded += chars;
    } else {
      deletions += 1;
      charactersRemoved += chars;
      author.deletions += 1;
      author.charactersRemoved += chars;
    }
    authors.set(item.author, author);
  }

  return {
    total: items.length,
    insertions,
    deletions,
    charactersAdded,
    charactersRemoved,
    authors: Array.from(authors.values()).sort((a, b) => (b.insertions + b.deletions) - (a.insertions + a.deletions)),
    items,
  };
}
