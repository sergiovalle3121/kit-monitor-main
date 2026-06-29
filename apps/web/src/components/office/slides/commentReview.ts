export interface SlideReviewComment {
  id: string;
  parentId?: string | null;
  slide: number;
  objectId?: string;
  objectLabel?: string;
  author?: string;
  assignedTo?: string;
  text: string;
  createdAt: number;
  resolved?: boolean;
}

export type SlideCommentReviewScope = 'slide' | 'deck';
export type SlideCommentReviewFilter = 'all' | 'open' | 'assigned' | 'blockers' | 'resolved';
export type SlideCommentReviewSort = 'priority' | 'newest' | 'oldest';

export interface SlideCommentReviewThread {
  root: SlideReviewComment;
  replies: SlideReviewComment[];
  replyCount: number;
  assignedTo?: string;
  targetLabel: string;
  ageDays: number;
  isOpen: boolean;
  isAssigned: boolean;
  isObjectAnchored: boolean;
  isStale: boolean;
  isBlocker: boolean;
}

export interface SlideCommentReviewSummary {
  totalThreads: number;
  visibleThreads: number;
  openThreads: number;
  resolvedThreads: number;
  assignedThreads: number;
  objectThreads: number;
  blockerThreads: number;
  staleThreads: number;
  replyCount: number;
  slidesWithOpenThreads: number;
  currentSlideOpenThreads: number;
  oldestOpenThreadDays: number;
  releaseReady: boolean;
  warningMessages: string[];
}

export interface SlideCommentReviewResult {
  threads: SlideCommentReviewThread[];
  summary: SlideCommentReviewSummary;
}

export interface BuildSlideCommentReviewOptions {
  currentSlide: number;
  scope?: SlideCommentReviewScope;
  filter?: SlideCommentReviewFilter;
  sort?: SlideCommentReviewSort;
  query?: string;
  now?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_DAYS = 5;
const BLOCKER_WORDS = [
  'blocker',
  'bloqueo',
  'critico',
  'critical',
  'release',
  'liberar',
  'aprobacion',
  'approval',
  'cliente',
  'customer',
  'calidad',
  'quality',
  'export',
];

function normalize(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function safeSlide(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function ageDays(createdAt: number, now: number): number {
  if (!Number.isFinite(createdAt) || createdAt <= 0) return 0;
  return Math.max(0, Math.floor((now - createdAt) / DAY_MS));
}

function assignedTo(root: SlideReviewComment, replies: SlideReviewComment[]): string | undefined {
  const value = [root, ...replies].map((comment) => String(comment.assignedTo || '').trim()).find(Boolean);
  return value || undefined;
}

function threadText(root: SlideReviewComment, replies: SlideReviewComment[]): string {
  return [root, ...replies]
    .map((comment) => [
      comment.text,
      comment.objectLabel,
      comment.assignedTo,
      comment.author,
      `slide ${safeSlide(comment.slide) + 1}`,
    ].join(' '))
    .join(' ');
}

function hasBlockerLanguage(root: SlideReviewComment, replies: SlideReviewComment[]): boolean {
  const text = normalize(threadText(root, replies));
  return BLOCKER_WORDS.some((word) => text.includes(word));
}

function buildThread(root: SlideReviewComment, replies: SlideReviewComment[], now: number): SlideCommentReviewThread {
  const rootSlide = safeSlide(root.slide);
  const threadAgeDays = ageDays(root.createdAt, now);
  const threadAssignedTo = assignedTo(root, replies);
  const isOpen = !root.resolved;
  const isObjectAnchored = Boolean(root.objectId);
  const isStale = isOpen && threadAgeDays >= STALE_DAYS;
  const isAssigned = Boolean(threadAssignedTo);
  const isBlocker = isOpen && (isStale || isAssigned || hasBlockerLanguage(root, replies));

  return {
    root: { ...root, slide: rootSlide },
    replies: replies.map((reply) => ({ ...reply, slide: safeSlide(reply.slide) })),
    replyCount: replies.length,
    assignedTo: threadAssignedTo,
    targetLabel: isObjectAnchored ? `Objeto - ${root.objectLabel || root.objectId || 'seleccion'}` : 'Diapositiva',
    ageDays: threadAgeDays,
    isOpen,
    isAssigned,
    isObjectAnchored,
    isStale,
    isBlocker,
  };
}

function filterThread(thread: SlideCommentReviewThread, filter: SlideCommentReviewFilter, query: string): boolean {
  if (filter === 'open' && !thread.isOpen) return false;
  if (filter === 'assigned' && !thread.isAssigned) return false;
  if (filter === 'blockers' && !thread.isBlocker) return false;
  if (filter === 'resolved' && thread.isOpen) return false;
  if (!query) return true;
  return normalize(threadText(thread.root, thread.replies)).includes(query);
}

function priority(thread: SlideCommentReviewThread): number {
  if (thread.isBlocker) return 0;
  if (thread.isOpen && thread.isAssigned) return 1;
  if (thread.isOpen) return 2;
  return 3;
}

function sortThreads(threads: SlideCommentReviewThread[], sort: SlideCommentReviewSort): SlideCommentReviewThread[] {
  return [...threads].sort((a, b) => {
    if (sort === 'oldest') return a.root.createdAt - b.root.createdAt;
    if (sort === 'newest') return b.root.createdAt - a.root.createdAt;
    return priority(a) - priority(b) || b.ageDays - a.ageDays || b.root.createdAt - a.root.createdAt;
  });
}

function summarize(allThreads: SlideCommentReviewThread[], visibleThreads: SlideCommentReviewThread[], currentSlide: number): SlideCommentReviewSummary {
  const openThreads = allThreads.filter((thread) => thread.isOpen);
  const resolvedThreads = allThreads.filter((thread) => !thread.isOpen);
  const assignedThreads = allThreads.filter((thread) => thread.isAssigned);
  const objectThreads = allThreads.filter((thread) => thread.isObjectAnchored);
  const blockerThreads = allThreads.filter((thread) => thread.isBlocker);
  const staleThreads = allThreads.filter((thread) => thread.isStale);
  const slidesWithOpenThreads = new Set(openThreads.map((thread) => thread.root.slide)).size;
  const currentSlideOpenThreads = openThreads.filter((thread) => thread.root.slide === currentSlide).length;
  const oldestOpenThreadDays = openThreads.reduce((max, thread) => Math.max(max, thread.ageDays), 0);
  const warningMessages = [
    blockerThreads.length ? `${blockerThreads.length} review blocker(s) need attention before release.` : '',
    staleThreads.length ? `${staleThreads.length} open thread(s) are older than ${STALE_DAYS} days.` : '',
    assignedThreads.length ? `${assignedThreads.length} thread(s) are assigned to reviewers.` : '',
    objectThreads.length ? `${objectThreads.length} object-anchored thread(s) should be checked after layout edits.` : '',
  ].filter(Boolean);

  return {
    totalThreads: allThreads.length,
    visibleThreads: visibleThreads.length,
    openThreads: openThreads.length,
    resolvedThreads: resolvedThreads.length,
    assignedThreads: assignedThreads.length,
    objectThreads: objectThreads.length,
    blockerThreads: blockerThreads.length,
    staleThreads: staleThreads.length,
    replyCount: allThreads.reduce((sum, thread) => sum + thread.replyCount, 0),
    slidesWithOpenThreads,
    currentSlideOpenThreads,
    oldestOpenThreadDays,
    releaseReady: openThreads.length === 0 && blockerThreads.length === 0,
    warningMessages,
  };
}

export function buildSlideCommentReview(comments: SlideReviewComment[], options: BuildSlideCommentReviewOptions): SlideCommentReviewResult {
  const currentSlide = safeSlide(options.currentSlide);
  const scope = options.scope ?? 'slide';
  const filter = options.filter ?? 'all';
  const sort = options.sort ?? 'priority';
  const query = normalize(options.query);
  const now = options.now ?? Date.now();
  const rows = Array.isArray(comments) ? comments.filter((comment) => comment && typeof comment.text === 'string') : [];
  const replies = new Map<string, SlideReviewComment[]>();
  const roots: SlideReviewComment[] = [];

  for (const comment of rows) {
    if (comment.parentId) {
      const list = replies.get(comment.parentId) ?? [];
      list.push(comment);
      replies.set(comment.parentId, list);
    } else {
      roots.push(comment);
    }
  }

  const allThreads = roots
    .map((root) => buildThread(root, replies.get(root.id) ?? [], now))
    .filter((thread) => scope === 'deck' || thread.root.slide === currentSlide);
  const visibleThreads = sortThreads(allThreads.filter((thread) => filterThread(thread, filter, query)), sort);

  return {
    threads: visibleThreads,
    summary: summarize(allThreads, visibleThreads, currentSlide),
  };
}

export function formatCommentAge(createdAt: number, now = Date.now()): string {
  const days = ageDays(createdAt, now);
  if (days <= 0) return 'Hoy';
  if (days === 1) return '1 dia';
  return `${days} dias`;
}
