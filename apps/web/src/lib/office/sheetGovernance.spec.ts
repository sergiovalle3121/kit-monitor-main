import { strict as assert } from 'assert';
import { anchorForSelection, assignedFromText, labelForAnchor, mentionsOf, normalizeRangeRef, summarizeWorkbookGovernance } from './sheetGovernance';

assert.equal(normalizeRangeRef('$b$2:$c$4'), 'B2:C4');
assert.deepEqual(anchorForSelection('Ops', 'A1:A1'), { type: 'cell', sheetName: 'Ops', cell: 'A1' });
assert.equal(labelForAnchor({ type: 'range', sheetName: 'Ops', range: 'B2:C4' }), 'Ops!B2:C4');
assert.deepEqual(mentionsOf('Revisar @quality@example.com y @ops'), ['quality@example.com', 'ops']);
assert.equal(assignedFromText('Responsable: @planner@example.com'), 'planner@example.com');
const summary = summarizeWorkbookGovernance({ sheets: [{ axosProtection: { sheetLocked: true, ranges: [{ range: 'A1:B2' }, { range: 'C1:D2', connectorId: 'cx' }] } }], comments: [{ id: '1', resolved: false, assignedTo: 'a' }, { id: '2', resolved: true }] });
assert.equal(summary.openComments, 1);
assert.equal(summary.assignedComments, 1);
assert.equal(summary.protectedSheets, 1);
assert.equal(summary.protectedRanges, 2);
assert.equal(summary.connectorLocks, 1);
console.log('sheetGovernance ok');
