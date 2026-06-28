import { addSheetCommentReply, commentsForSelection, createSheetCommentThread, deleteSheetComment, formatSheetCommentSummary, reopenSheetComment, resolveSheetComment } from './sheetComments';

let passed = 0; const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else fails.push(msg); };
const eq = (a: unknown, b: unknown, msg: string) => { if (a === b) passed++; else fails.push(`${msg} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const now = new Date('2026-06-27T12:00:00.000Z');
const comment = createSheetCommentThread({ sheetIndex: 1, range: 'B2:C4', text: ' Revisar scrap ', author: 'QA', now });
eq(comment.id, 'sc_mqwb5hc0', 'id determinístico');
eq(comment.text, 'Revisar scrap', 'trim text');
eq(comment.createdAt, '2026-06-27T12:00:00.000Z', 'createdAt ISO');

let comments = [comment];
comments = addSheetCommentReply(comments, comment.id, 'Confirmado en línea 2', 'Ops', new Date('2026-06-27T12:05:00.000Z'));
eq(comments[0].replies?.length, 1, 'agrega respuesta');
eq(comments[0].replies?.[0].author, 'Ops', 'autor respuesta');
comments = resolveSheetComment(comments, comment.id, new Date('2026-06-27T12:10:00.000Z'));
ok(!!comments[0].resolved, 'resuelve comentario');
eq(commentsForSelection(comments, 1, 'B2:C4').length, 0, 'resuelto no aparece en abiertos');
eq(commentsForSelection(comments, 1, 'B2:C4', true).length, 1, 'includeResolved incluye resuelto');
comments = reopenSheetComment(comments, comment.id, new Date('2026-06-27T12:15:00.000Z'));
ok(!comments[0].resolved, 'reabre comentario');
ok(formatSheetCommentSummary(comments[0]).includes('1 respuestas'), 'summary incluye respuestas');
comments = deleteSheetComment(comments, comment.id);
eq(comments.length, 0, 'elimina comentario');

const total = passed + fails.length;
if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`✅ ${passed}/${total}`);
