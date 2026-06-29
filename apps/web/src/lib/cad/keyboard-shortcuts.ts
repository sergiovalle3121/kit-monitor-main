export type CadKeyboardShortcutId =
  | "palette"
  | "select"
  | "measure"
  | "wall"
  | "text"
  | "grid"
  | "fit_view"
  | "validate_layout"
  | "export_dxf"
  | "select_all"
  | "duplicate"
  | "delete"
  | "rotate_cw"
  | "rotate_ccw"
  | "undo"
  | "redo"
  | "cancel";

export interface CadKeyboardShortcut {
  id: CadKeyboardShortcutId;
  label: string;
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
}
export interface CadKeyboardEventLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

export const CAD_KEYBOARD_SHORTCUTS: CadKeyboardShortcut[] = [
  {
    id: "palette",
    label: "Command palette",
    key: "k",
    ctrl: true,
    description: "Open the CAD command palette.",
  },
  {
    id: "select",
    label: "Select",
    key: "v",
    description: "Switch to select mode.",
  },
  {
    id: "validate_layout",
    label: "Validate",
    key: "v",
    shift: true,
    description: "Open design validation.",
  },
  {
    id: "measure",
    label: "Measure",
    key: "m",
    description: "Toggle the measurement tool.",
  },
  {
    id: "wall",
    label: "Wall",
    key: "w",
    description: "Toggle wall drawing.",
  },
  {
    id: "text",
    label: "Text note",
    key: "t",
    description: "Add a text note at the viewport target.",
  },
  {
    id: "grid",
    label: "Grid snap",
    key: "g",
    description: "Toggle grid snapping.",
  },
  {
    id: "fit_view",
    label: "Fit view",
    key: "f",
    description: "Fit the layout in the viewport.",
  },
  {
    id: "export_dxf",
    label: "DXF export",
    key: "e",
    description: "Open the DXF export panel.",
  },
  {
    id: "select_all",
    label: "Select all",
    key: "a",
    ctrl: true,
    description: "Select every CAD object.",
  },
  {
    id: "duplicate",
    label: "Duplicate",
    key: "d",
    ctrl: true,
    description: "Duplicate the current selection.",
  },
  {
    id: "delete",
    label: "Delete",
    key: "delete",
    description: "Delete the current selection.",
  },
  {
    id: "delete",
    label: "Delete",
    key: "backspace",
    description: "Delete the current selection.",
  },
  {
    id: "rotate_cw",
    label: "Rotate",
    key: "r",
    description: "Rotate the current selection 15 degrees.",
  },
  {
    id: "rotate_ccw",
    label: "Rotate counterclockwise",
    key: "r",
    shift: true,
    description: "Rotate the current selection -15 degrees.",
  },
  {
    id: "undo",
    label: "Undo",
    key: "z",
    ctrl: true,
    description: "Undo the last edit.",
  },
  {
    id: "redo",
    label: "Redo",
    key: "z",
    ctrl: true,
    shift: true,
    description: "Redo the last edit.",
  },
  {
    id: "redo",
    label: "Redo",
    key: "y",
    ctrl: true,
    description: "Redo the last edit.",
  },
  {
    id: "cancel",
    label: "Cancel",
    key: "escape",
    description: "Cancel the active tool or close the active overlay.",
  },
];

export function matchCadShortcut(
  event: CadKeyboardEventLike,
  shortcuts = CAD_KEYBOARD_SHORTCUTS,
): CadKeyboardShortcut | undefined {
  const key = event.key.toLowerCase();
  const ctrl = !!(event.ctrlKey || event.metaKey);
  return shortcuts.find(
    (shortcut) =>
      shortcut.key.toLowerCase() === key &&
      !!shortcut.ctrl === ctrl &&
      !!shortcut.shift === !!event.shiftKey &&
      !!shortcut.alt === !!event.altKey,
  );
}
export function cadShortcutLabel(shortcut: CadKeyboardShortcut): string {
  return [
    shortcut.ctrl ? "Ctrl" : null,
    shortcut.shift ? "Shift" : null,
    shortcut.alt ? "Alt" : null,
    shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key,
  ]
    .filter(Boolean)
    .join("+");
}
