export type SlideCommentReviewFilter = 'all' | 'open' | 'assigned' | 'resolved' | 'object';
export type SlideCommentReviewScope = 'slide' | 'deck';

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

export interface SlideCommentThreadReview {
  root: SlideReviewComment;
  replies: SlideReviewComment[];
  slide: number;
  isCurrentSlide: boolean;
  isOpen: boolean;
  isObjectAnchored: boolean;
  assignedTo: string;
  replyCount: number;
  searchText: string;
}

export interface SlideCommentReviewSummary {
  totalThreads: number;
  visibleThreads: number;
  openThreads: number;
  resolvedThreads: number;
  assignedThreads: number;
  objectThreads: number;
  currentSlideThreads: number;
  currentSlideOpenThreads: number;
  slidesWithOpenThreads: number;
  replyCount: number;
  orphanReplyCount: number;
  objectThreadsMissingLabel: number;
}

export interface SlideCommentReviewInput {
  comments: SlideReviewComment[];
  currentSlide: number;
  scope?: SlideCommentReviewScope;
  filter?: SlideCommentReviewFilter;
  query?: string;
}

function clean(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function lower(value: unknown): string {
  return clean(value).toLowerCase();
}

function threadAssignedTo(root: SlideReviewComment, replies: SlideReviewComment[]): string {
  return clean(root.assignedTo || replies.find((reply) => clean(reply.assignedTo))?.assignedTo || '');
}

export function buildSlideCommentThreads(comments: SlideReviewComment[], currentSlide = 0): SlideCommentThreadReview[] {
  const roots = comments.filter((comment) => !comment.parentId);
  const rootIds = new Set(roots.map((comment) => comment.id));
  const repliesByParent = new Map<string, SlideReviewComment[]>();

  for (const comment of comments) {
    if (!comment.parentId || !rootIds.has(comment.parentId)) continue;
    const replies = repliesByParent.get(comment.parentId) ?? [];
    replies.push(comment);
    repliesByParent.set(comment.parentId, replies);
  }

  return roots.map((root) => {
    const replies = [...(repliesByParent.get(root.id) ?? [])].sort((a, b) => a.createdAt - b.createdAt);
    const assignedTo = threadAssignedTo(root, replies);
    const isObjectAnchored = !!clean(root.objectId);
    const searchText = lower([
      `slide ${root.slide + 1}`,
      root.objectId ? 'object' : 'slide',
      root.objectLabel,
      root.author,
      assignedTo,
      root.text,
      ...replies.flatMap((reply) => [reply.author, reply.assignedTo, reply.text]),
    ].join(' '));

    return {
      root,
      replies,
      slide: root.slide,
      isCurrentSlide: root.slide === currentSlide,
      isOpen: !root.resolved,
      isObjectAnchored,
      assignedTo,
      replyCount: replies.length,
      searchText,
    };
  });
}

export function summarizeSlideCommentReview(
  threads: SlideCommentThreadReview[],
  comments: SlideReviewComment[],
  currentSlide = 0,
  visibleThreads = threads.length,
): SlideCommentReviewSummary {
  const openThreads = threads.filter((thread) => thread.isOpen);
  return {
    totalThreads: threads.length,
    visibleThreads,
    openThreads: openThreads.length,
    resolvedThreads: threads.filter((thread) => !thread.isOpen).length,
    assignedThreads: threads.filter((thread) => !!thread.assignedTo).length,
    objectThreads: threads.filter((thread) => thread.isObjectAnchored).length,
    currentSlideThreads: threads.filter((thread) => thread.slide === currentSlide).length,
    currentSlideOpenThreads: openThreads.filter((thread) => thread.slide === currentSlide).length,
    slidesWithOpenThreads: new Set(openThreads.map((thread) => thread.slide)).size,
    replyCount: threads.reduce((sum, thread) => sum + thread.replyCount, 0),
    orphanReplyCount: comments.filter((comment) => comment.parentId && !threads.some((thread) => thread.root.id === comment.parentId)).length,
    objectThreadsMissingLabel: threads.filter((thread) => thread.isObjectAnchored && !clean(thread.root.objectLabel)).length,
  };
}

export function filterSlideCommentThreads(
  threads: SlideCommentThreadReview[],
  currentSlide: number,
  scope: SlideCommentReviewScope = 'slide',
  filter: SlideCommentReviewFilter = 'all',
  query = '',
): SlideCommentThreadReview[] {
  const q = lower(query);
  return threads
    .filter((thread) => {
      if (scope === 'slide' && thread.slide !== currentSlide) return false;
      if (filter === 'open' && !thread.isOpen) return false;
      if (filter === 'assigned' && !thread.assignedTo) return false;
      if (filter === 'resolved' && thread.isOpen) return false;
      if (filter === 'object' && !thread.isObjectAnchored) return false;
      return !q || thread.searchText.includes(q);
    })
    .sort((a, b) => {
      if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
      if (a.isCurrentSlide !== b.isCurrentSlide) return a.isCurrentSlide ? -1 : 1;
      if (a.slide !== b.slide) return a.slide - b.slide;
      return b.root.createdAt - a.root.createdAt;
    });
}

export function buildSlideCommentReview(input: SlideCommentReviewInput) {
  const threads = buildSlideCommentThreads(input.comments ?? [], input.currentSlide);
  const visibleThreads = filterSlideCommentThreads(
    threads,
    input.currentSlide,
    input.scope ?? 'slide',
    input.filter ?? 'all',
    input.query ?? '',
  );
  return {
    threads,
    visibleThreads,
    summary: summarizeSlideCommentReview(threads, input.comments ?? [], input.currentSlide, visibleThreads.length),
  };
}
