/* eslint-disable @typescript-eslint/no-explicit-any */

export type TrackedChangeKind = 'insertion' | 'deletion' | 'formatChange';

export interface TrackedChangeItem {
  id: string;
  type: TrackedChangeKind;
  text: string;
  author: string;
  date: number | null;
  path: string;
  before: string | null;
  after: string | null;
  property: string | null;
}

export interface TrackedChangeAuthorSummary {
  author: string;
  insertions: number;
  deletions: number;
  formatting: number;
  charactersAdded: number;
  charactersRemoved: number;
}

export interface TrackedChangeSummary {
  total: number;
  insertions: number;
  deletions: number;
  formatting: number;
  charactersAdded: number;
  charactersRemoved: number;
  authors: TrackedChangeAuthorSummary[];
  items: TrackedChangeItem[];
}

const EMPTY_SUMMARY: TrackedChangeSummary = {
  total: 0,
  insertions: 0,
  deletions: 0,
  formatting: 0,
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
    .filter((mark: any) => mark?.type === 'insertion' || mark?.type === 'deletion' || mark?.type === 'formatChange')
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
        before: typeof mark.attrs.before === 'string' ? mark.attrs.before : null,
        after: typeof mark.attrs.after === 'string' ? mark.attrs.after : null,
        property: typeof mark.attrs.property === 'string' ? mark.attrs.property : null,
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
  let formatting = 0;
  let charactersAdded = 0;
  let charactersRemoved = 0;

  for (const item of items) {
    const chars = item.text.length;
    const author = authors.get(item.author) ?? { author: item.author, insertions: 0, deletions: 0, formatting: 0, charactersAdded: 0, charactersRemoved: 0 };
    if (item.type === 'insertion') {
      insertions += 1;
      charactersAdded += chars;
      author.insertions += 1;
      author.charactersAdded += chars;
    } else if (item.type === 'deletion') {
      deletions += 1;
      charactersRemoved += chars;
      author.deletions += 1;
      author.charactersRemoved += chars;
    } else {
      formatting += 1;
      author.formatting += 1;
    }
    authors.set(item.author, author);
  }

  return {
    total: items.length,
    insertions,
    deletions,
    formatting,
    charactersAdded,
    charactersRemoved,
    authors: Array.from(authors.values()).sort((a, b) => (b.insertions + b.deletions + b.formatting) - (a.insertions + a.deletions + a.formatting)),
    items,
  };
}
