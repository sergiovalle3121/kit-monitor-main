import { strict as assert } from "node:assert";
import {
  CAD_KEYBOARD_SHORTCUTS,
  cadShortcutLabel,
  matchCadShortcut,
} from "./keyboard-shortcuts";

const combos = CAD_KEYBOARD_SHORTCUTS.map((shortcut) =>
  [
    shortcut.ctrl ? "ctrl" : "",
    shortcut.shift ? "shift" : "",
    shortcut.alt ? "alt" : "",
    shortcut.key.toLowerCase(),
  ].join("+"),
);
assert.equal(
  new Set(combos).size,
  CAD_KEYBOARD_SHORTCUTS.length,
  "shortcut key combinations are unique",
);

const palette = matchCadShortcut({ key: "k", ctrlKey: true });
assert.equal(palette?.id, "palette", "matches ctrl-k palette");
assert.equal(
  matchCadShortcut({ key: "v" })?.id,
  "select",
  "matches plain V as select",
);
assert.equal(
  matchCadShortcut({ key: "V", shiftKey: true })?.id,
  "validate_layout",
  "matches shift-V as validation",
);
assert.equal(
  matchCadShortcut({ key: "t" })?.id,
  "text",
  "matches text note shortcut",
);
assert.equal(
  matchCadShortcut({ key: "e" })?.id,
  "export_dxf",
  "matches DXF export shortcut",
);
assert.equal(
  matchCadShortcut({ key: "Backspace" })?.id,
  "delete",
  "matches backspace delete fallback",
);
assert.equal(
  matchCadShortcut({ key: "z", ctrlKey: true, shiftKey: true })?.id,
  "redo",
  "matches redo",
);
assert.equal(
  matchCadShortcut({ key: "y", metaKey: true })?.id,
  "redo",
  "matches cmd-y redo alternate",
);
assert.equal(cadShortcutLabel(palette!), "Ctrl+K", "formats shortcut labels");
console.log("cad keyboard shortcuts specs passed");
