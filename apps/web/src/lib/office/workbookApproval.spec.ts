/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  compareWorkbookApprovalSnapshot,
  requestWorkbookReview,
  workbookApprovalContentSignature,
} from './workbookApproval';

let passed = 0; const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else fails.push(msg); };
const eq = (a: any, b: any, msg: string) => { if (a === b) passed++; else fails.push(`${msg} - expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };

const workbook: any = {
  sheets: [{ name: 'Ops', celldata: [{ r: 0, c: 0, v: { v: 10, m: '10' } }] }],
  charts: [],
  comments: [],
};

const baseSignature = workbookApprovalContentSignature(workbook);
eq(baseSignature, workbookApprovalContentSignature({ ...workbook, approval: { status: 'draft' } }), 'approval metadata is excluded from content signature');

const review = requestWorkbookReview(null, 'Planner', 'Check OEE', workbook);
eq(review.status, 'in_review', 'request review sets in_review');
eq(review.requestedBy, 'Planner', 'request review stores requester');
eq(review.requestedContentSignature, baseSignature, 'request review captures content signature');
eq(compareWorkbookApprovalSnapshot({ ...workbook, approval: review }).status, 'matched', 'unchanged review snapshot matches');

const changedWorkbook = {
  ...workbook,
  sheets: [{ name: 'Ops', celldata: [{ r: 0, c: 0, v: { v: 11, m: '11' } }] }],
  approval: review,
};
eq(compareWorkbookApprovalSnapshot(changedWorkbook).status, 'changed', 'changed workbook after review is detected');

const approved = {
  status: 'approved',
  approvedBy: 'QA',
  approvedContentSignature: baseSignature,
};
eq(compareWorkbookApprovalSnapshot({ ...workbook, approval: approved }).status, 'matched', 'approved snapshot can match');
eq(compareWorkbookApprovalSnapshot({ ...changedWorkbook, approval: approved }).status, 'changed', 'approved snapshot drift is detected');
eq(compareWorkbookApprovalSnapshot({ ...workbook, approval: { status: 'approved', approvedBy: 'QA' } }).status, 'untracked', 'legacy approvals without snapshot are untracked');

ok(typeof review.requestedAt === 'string' && review.requestedAt.length > 0, 'request review stores timestamp');

const total = passed + fails.length;
if (fails.length) { console.error(`FAIL ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`OK workbook approval: ${passed}/${total}`);
