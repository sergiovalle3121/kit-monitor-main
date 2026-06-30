# AXOS Sheets Keyboard Productivity

This slice hardens Phase 18 keyboard productivity without changing the Fortune-Sheet grid or duplicating the SheetEditor command layer.

## Mounted UI

- Shell: `apps/web/src/components/office/OfficeShell.tsx`
- Shortcut catalog: `apps/web/src/components/office/officeShortcuts.ts`
- Focused spec: `apps/web/src/components/office/officeShortcuts.spec.ts`

## User-visible behavior

- `Ctrl/Cmd+/` opens the Office shortcut command center from any Office editor.
- `Esc` closes the shortcut command center.
- Sheets now shows grouped, status-labeled shortcuts for workbook save, print preview, search, undo/redo, clipboard focus restore, formula bar commit/cancel, and grid deletion.
- Read-only sheets mark mutating commands as blocked instead of implying they will write.
- Focus-dependent grid commands are labeled honestly because Fortune-Sheet owns native cell/key handling when the grid has focus.

## Non-duplication notes

- The shortcut command center documents and exposes the existing `SheetEditor` keyboard handlers; it does not add a second grid event engine.
- Print, find, undo/redo, clipboard focus restore, and formula bar commit remain owned by `SheetEditor.tsx`.
- Save remains owned by the Office document page autosave/save flow.
- Fullscreen remains owned by `OfficeShell` and the browser Fullscreen API.

## Limitations

- The command center is descriptive and state-aware; it is not a command palette that executes every listed action.
- Read-only search currently follows existing SheetEditor behavior: `Ctrl/Cmd+F` is blocked with other edit-mode shortcuts, so the panel labels it as read-only blocked.
