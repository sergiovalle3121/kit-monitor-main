import { assignedFromText, mentionsOf, normalizeRangeRef, type SheetCommentAnchor } from './sheetGovernance';

export interface SheetCommentReply {
  id: string;
  text: string;
  author?: string;
  createdAt: string;
  mentions?: string[];
}

export interface SheetCommentThread {
  id: string;
  sheetIndex: number;
  range: string;
  anchor?: SheetCommentAnchor;
  persistedId?: string;
  parentId?: string | null;
  text: string;
  author?: string;
  createdAt: string;
  resolved?: boolean;
  resolvedAt?: string;
  reopenedAt?: string;
  replies?: SheetCommentReply[];
  mentions?: string[];
  assignedTo?: string | null;
}

const idFrom = (prefix: string, now: Date) => `${prefix}_${now.getTime().toString(36)}`;

export function createSheetCommentThread(input: { sheetIndex: number; range: string; text: string; author?: string; now?: Date }): SheetCommentThread {
  const now = input.now ?? new Date();
  return {
    id: idFrom('sc', now),
    sheetIndex: input.sheetIndex,
    range: normalizeRangeRef(input.range),
    text: input.text.trim(),
    mentions: mentionsOf(input.text),
    assignedTo: assignedFromText(input.text),
    author: input.author,
    createdAt: now.toISOString(),
  };
}

export function addSheetCommentReply(comments: SheetCommentThread[], id: string, text: string, author = 'AXOS', now = new Date()): SheetCommentThread[] {
  const clean = text.trim();
  if (!clean) return comments;
  return comments.map((comment) => comment.id === id
    ? { ...comment, replies: [...(comment.replies ?? []), { id: idFrom('scr', now), text: clean, author, createdAt: now.toISOString(), mentions: mentionsOf(clean) }] }
    : comment);
}

export function resolveSheetComment(comments: SheetCommentThread[], id: string, now = new Date()): SheetCommentThread[] {
  return comments.map((comment) => comment.id === id ? { ...comment, resolved: true, resolvedAt: now.toISOString() } : comment);
}

export function reopenSheetComment(comments: SheetCommentThread[], id: string, now = new Date()): SheetCommentThread[] {
  return comments.map((comment) => comment.id === id ? { ...comment, resolved: false, reopenedAt: now.toISOString() } : comment);
}

export function deleteSheetComment(comments: SheetCommentThread[], id: string): SheetCommentThread[] {
  return comments.filter((comment) => comment.id !== id);
}

export function commentsForSelection(comments: SheetCommentThread[], sheetIndex: number, range: string, includeResolved = false): SheetCommentThread[] {
  return comments.filter((comment) => comment.sheetIndex === sheetIndex && normalizeRangeRef(comment.range) === normalizeRangeRef(range) && (includeResolved || !comment.resolved));
}

export function formatSheetCommentSummary(comment: SheetCommentThread): string {
  const replies = comment.replies?.length ? ` (${comment.replies.length} respuestas)` : '';
  const status = comment.resolved ? 'resuelto' : 'abierto';
  return `${comment.range} · ${status}${replies} — ${comment.text}`;
}

export function groupSheetCommentThreads(comments: SheetCommentThread[]): SheetCommentThread[] {
  const roots = comments.filter((c) => !c.parentId);
  const replies = comments.filter((c) => !!c.parentId);
  return roots.map((root) => ({
    ...root,
    replies: [
      ...(root.replies ?? []),
      ...replies.filter((reply) => reply.parentId === (root.persistedId ?? root.id)).map((reply) => ({
        id: reply.id, text: reply.text, author: reply.author, createdAt: reply.createdAt, mentions: reply.mentions,
      })),
    ],
  }));
}
