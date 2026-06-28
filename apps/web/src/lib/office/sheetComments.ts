export interface SheetCommentReply {
  id: string;
  text: string;
  author?: string;
  createdAt: string;
}

export type SheetCommentAnchorType = 'sheet' | 'cell' | 'range' | 'table' | 'pivot' | 'chart';

export interface SheetCommentThread {
  id: string;
  sheetIndex: number;
  range: string;
  anchorType?: SheetCommentAnchorType;
  anchorLabel?: string;
  assignedTo?: string | null;
  text: string;
  author?: string;
  createdAt: string;
  resolved?: boolean;
  resolvedAt?: string;
  reopenedAt?: string;
  replies?: SheetCommentReply[];
}

const idFrom = (prefix: string, now: Date) => `${prefix}_${now.getTime().toString(36)}`;

export function createSheetCommentThread(input: { sheetIndex: number; range: string; text: string; author?: string; assignedTo?: string | null; anchorType?: SheetCommentAnchorType; anchorLabel?: string; now?: Date }): SheetCommentThread {
  const now = input.now ?? new Date();
  return {
    id: idFrom('sc', now),
    sheetIndex: input.sheetIndex,
    range: input.range,
    anchorType: input.anchorType ?? (input.range.includes(':') ? 'range' : 'cell'),
    anchorLabel: input.anchorLabel,
    assignedTo: input.assignedTo ?? null,
    text: input.text.trim(),
    author: input.author,
    createdAt: now.toISOString(),
  };
}

export function addSheetCommentReply(comments: SheetCommentThread[], id: string, text: string, author = 'AXOS', now = new Date()): SheetCommentThread[] {
  const clean = text.trim();
  if (!clean) return comments;
  return comments.map((comment) => comment.id === id
    ? { ...comment, replies: [...(comment.replies ?? []), { id: idFrom('scr', now), text: clean, author, createdAt: now.toISOString() }] }
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
  return comments.filter((comment) => comment.sheetIndex === sheetIndex && comment.range === range && (includeResolved || !comment.resolved));
}

export function formatSheetCommentSummary(comment: SheetCommentThread): string {
  const replies = comment.replies?.length ? ` (${comment.replies.length} respuestas)` : '';
  const assignee = comment.assignedTo ? ` · @${comment.assignedTo}` : '';
  const status = comment.resolved ? 'resuelto' : 'abierto';
  return `${comment.anchorLabel || comment.range} · ${status}${assignee}${replies} — ${comment.text}`;
}
