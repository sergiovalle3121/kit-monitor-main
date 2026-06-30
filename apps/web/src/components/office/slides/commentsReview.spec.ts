import {
  buildSlideCommentReview,
  buildSlideCommentThreads,
  filterSlideCommentThreads,
  summarizeSlideCommentReview,
  type SlideReviewComment,
} from './commentsReview';

let passed = 0; const fails: string[] = [];
const ok = (condition: boolean, message: string) => { if (condition) passed++; else fails.push(message); };
const eq = <T>(actual: T, expected: T, message: string) => ok(Object.is(actual, expected), `${message} (expected ${expected}, got ${actual})`);

const comments: SlideReviewComment[] = [
  { id: 'c1', slide: 0, objectId: 'obj-1', objectLabel: 'OEE KPI', assignedTo: 'quality@axos.local', text: 'Validate OEE source', createdAt: 1000 },
  { id: 'r1', parentId: 'c1', slide: 0, objectId: 'obj-1', objectLabel: 'OEE KPI', text: 'MES contract pending', createdAt: 1200 },
  { id: 'c2', slide: 1, text: 'Close supplier action before review', createdAt: 1100 },
  { id: 'c3', slide: 2, objectId: 'obj-9', text: 'Resolved note', createdAt: 900, resolved: true },
  { id: 'r-orphan', parentId: 'missing', slide: 2, text: 'Detached reply', createdAt: 1300 },
];

const threads = buildSlideCommentThreads(comments, 0);
const summary = summarizeSlideCommentReview(threads, comments, 0);

eq(threads.length, 3, 'builds one thread per root comment');
eq(threads[0].replyCount, 1, 'attaches replies to their root thread');
eq(summary.openThreads, 2, 'counts open root threads');
eq(summary.resolvedThreads, 1, 'counts resolved root threads');
eq(summary.assignedThreads, 1, 'counts assigned threads');
eq(summary.objectThreads, 2, 'counts object-anchored threads');
eq(summary.currentSlideOpenThreads, 1, 'counts open comments on the current slide');
eq(summary.slidesWithOpenThreads, 2, 'counts slides with open comments');
eq(summary.orphanReplyCount, 1, 'detects orphan replies');
eq(summary.objectThreadsMissingLabel, 1, 'detects object anchors without labels');

const currentOpen = filterSlideCommentThreads(threads, 0, 'slide', 'open', '');
eq(currentOpen.length, 1, 'filters open comments on current slide');
eq(currentOpen[0].root.id, 'c1', 'keeps current slide thread');

const deckAssigned = filterSlideCommentThreads(threads, 0, 'deck', 'assigned', '');
eq(deckAssigned.length, 1, 'filters assigned comments across the deck');

const objectSearch = filterSlideCommentThreads(threads, 0, 'deck', 'object', 'resolved');
eq(objectSearch.length, 1, 'searches object comments by text');
eq(objectSearch[0].root.id, 'c3', 'returns matching resolved object comment');

const review = buildSlideCommentReview({ comments, currentSlide: 0, scope: 'deck', filter: 'open', query: 'supplier' });
eq(review.visibleThreads.length, 1, 'builds filtered deck review');
eq(review.visibleThreads[0].slide, 1, 'finds deck-level comments outside current slide');
eq(review.summary.visibleThreads, 1, 'summary includes visible thread count');

const total = passed + fails.length;
if (fails.length) {
  console.error(`comments review: ${fails.length}/${total} failed`);
  for (const fail of fails) console.error(`  - ${fail}`);
  process.exit(1);
}
console.log(`comments review: ${passed}/${total} assertions passed`);
