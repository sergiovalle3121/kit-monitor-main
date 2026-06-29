import {
  buildSlideCommentReview,
  formatCommentAge,
  type SlideReviewComment,
} from './commentReview';

let passed = 0;
const fails: string[] = [];
const ok = (condition: boolean, message: string) => { if (condition) passed++; else fails.push(message); };
const eq = (actual: unknown, expected: unknown, message: string) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else fails.push(`${message} - expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

const now = Date.UTC(2026, 5, 29, 12, 0, 0);
const day = 24 * 60 * 60 * 1000;
const comments: SlideReviewComment[] = [
  {
    id: 'c1',
    slide: 0,
    objectId: 'oee-card',
    objectLabel: 'OEE KPI card',
    author: 'ops@axos.local',
    assignedTo: 'quality@axos.local',
    text: 'Critical release blocker: verify the OEE value before the customer review.',
    createdAt: now - (7 * day),
  },
  {
    id: 'r1',
    parentId: 'c1',
    slide: 0,
    author: 'quality@axos.local',
    text: 'Waiting for the final production report.',
    createdAt: now - (6 * day),
  },
  {
    id: 'c2',
    slide: 1,
    author: 'npi@axos.local',
    text: 'Add launch readiness evidence.',
    createdAt: now - day,
  },
  {
    id: 'c3',
    slide: 2,
    author: 'supplier@axos.local',
    text: 'Supplier scorecard approved.',
    createdAt: now - (2 * day),
    resolved: true,
  },
  {
    id: 'c4',
    slide: 1,
    objectId: 'action-table',
    objectLabel: 'Action register',
    author: 'pm@axos.local',
    text: 'Please confirm owners in the action register.',
    createdAt: now - (6 * day),
  },
];

const deck = buildSlideCommentReview(comments, { currentSlide: 1, scope: 'deck', now });
eq(deck.summary.totalThreads, 4, 'deck scope counts root threads');
eq(deck.summary.openThreads, 3, 'deck scope counts open root threads');
eq(deck.summary.resolvedThreads, 1, 'deck scope counts resolved threads');
eq(deck.summary.assignedThreads, 1, 'deck scope counts assigned threads');
eq(deck.summary.objectThreads, 2, 'deck scope counts object anchors');
eq(deck.summary.blockerThreads, 2, 'deck scope detects blockers');
eq(deck.summary.staleThreads, 2, 'deck scope detects stale open threads');
eq(deck.summary.replyCount, 1, 'deck scope counts replies');
eq(deck.summary.slidesWithOpenThreads, 2, 'deck scope counts slides with open threads');
eq(deck.summary.currentSlideOpenThreads, 2, 'deck scope counts current slide open threads');
eq(deck.summary.oldestOpenThreadDays, 7, 'deck scope exposes oldest open age');
ok(!deck.summary.releaseReady, 'deck with open threads is not release ready');
ok(deck.summary.warningMessages.some((message) => message.includes('review blocker')), 'deck summary includes blocker warning');
eq(deck.threads.map((thread) => thread.root.id).slice(0, 2), ['c1', 'c4'], 'priority sort surfaces blockers first');

const slide = buildSlideCommentReview(comments, { currentSlide: 1, scope: 'slide', now });
eq(slide.summary.totalThreads, 2, 'slide scope only includes current slide threads');
eq(slide.threads.map((thread) => thread.root.id), ['c4', 'c2'], 'slide scope keeps priority ordering');

const assigned = buildSlideCommentReview(comments, { currentSlide: 1, scope: 'deck', filter: 'assigned', now });
eq(assigned.threads.map((thread) => thread.root.id), ['c1'], 'assigned filter finds assigned thread');

const blockers = buildSlideCommentReview(comments, { currentSlide: 1, scope: 'deck', filter: 'blockers', now });
eq(blockers.threads.map((thread) => thread.root.id), ['c1', 'c4'], 'blocker filter returns language and stale blockers');

const resolved = buildSlideCommentReview(comments, { currentSlide: 1, scope: 'deck', filter: 'resolved', now });
eq(resolved.threads.map((thread) => thread.root.id), ['c3'], 'resolved filter returns resolved threads only');

const replySearch = buildSlideCommentReview(comments, { currentSlide: 1, scope: 'deck', query: 'final production', now });
eq(replySearch.threads.map((thread) => thread.root.id), ['c1'], 'query searches replies');

const objectSearch = buildSlideCommentReview(comments, { currentSlide: 1, scope: 'deck', query: 'action register', now });
eq(objectSearch.threads.map((thread) => thread.root.id), ['c4'], 'query searches object labels');

const newest = buildSlideCommentReview(comments, { currentSlide: 1, scope: 'deck', sort: 'newest', now });
eq(newest.threads.map((thread) => thread.root.id), ['c2', 'c3', 'c4', 'c1'], 'newest sort uses createdAt descending');

const oldest = buildSlideCommentReview(comments, { currentSlide: 1, scope: 'deck', sort: 'oldest', now });
eq(oldest.threads.map((thread) => thread.root.id), ['c1', 'c4', 'c3', 'c2'], 'oldest sort uses createdAt ascending');

const clean = buildSlideCommentReview([{ ...comments[2], resolved: true }], { currentSlide: 1, scope: 'deck', now });
ok(clean.summary.releaseReady, 'resolved-only deck is release ready');
eq(formatCommentAge(now, now), 'Hoy', 'age label handles today');
eq(formatCommentAge(now - day, now), '1 dia', 'age label handles one day');
eq(formatCommentAge(now - (3 * day), now), '3 dias', 'age label handles multiple days');

if (fails.length) {
  console.error(`\ncomment review: ${fails.length}/${passed + fails.length} failed`);
  for (const fail of fails) console.error(`  - ${fail}`);
  process.exit(1);
}

console.log(`comment review: ${passed}/${passed} assertions passed`);
