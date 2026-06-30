import assert from 'node:assert/strict';
import {
  OFFICE_SHORTCUT_AVAILABILITY_LABELS,
  getOfficeShortcutGroups,
  type OfficeShortcutCommand,
} from './officeShortcuts';

function flat(type: Parameters<typeof getOfficeShortcutGroups>[0], readOnly = false): OfficeShortcutCommand[] {
  return getOfficeShortcutGroups(type, readOnly).flatMap((group) => group.commands);
}

{
  const sheet = flat('sheet');
  assert.ok(sheet.some((command) => command.id === 'sheet-print' && command.availability === 'available'));
  assert.ok(sheet.some((command) => command.id === 'sheet-formula-commit' && command.keys === 'Enter'));
  assert.ok(sheet.some((command) => command.id === 'sheet-clipboard' && command.availability === 'focus-dependent'));
  assert.ok(sheet.some((command) => command.id === 'shortcuts' && command.keys === 'Ctrl / Cmd + /'));
}

{
  const readOnlySheet = flat('sheet', true);
  assert.equal(readOnlySheet.find((command) => command.id === 'save')?.availability, 'read-only-blocked');
  assert.equal(readOnlySheet.find((command) => command.id === 'sheet-formula-commit')?.availability, 'read-only-blocked');
  assert.equal(readOnlySheet.find((command) => command.id === 'sheet-print')?.availability, 'available');
}

{
  const doc = flat('doc');
  const slides = flat('slides');
  assert.ok(doc.some((command) => command.id === 'doc-find'));
  assert.ok(slides.some((command) => command.id === 'slides-duplicate'));
  assert.equal(doc.some((command) => command.id === 'sheet-print'), false);
}

{
  for (const type of ['doc', 'sheet', 'slides'] as const) {
    const groups = getOfficeShortcutGroups(type);
    assert.ok(groups.length > 0);
    assert.equal(groups.some((group) => group.commands.length === 0), false);
    const ids = groups.flatMap((group) => group.commands.map((command) => command.id));
    assert.equal(new Set(ids).size, ids.length);
  }
}

{
  assert.equal(OFFICE_SHORTCUT_AVAILABILITY_LABELS.available, 'Disponible');
  assert.equal(OFFICE_SHORTCUT_AVAILABILITY_LABELS['read-only-blocked'], 'Solo lectura');
}
