# AXOS Slides Tree Status

Date: 2026-06-29

## Current Run Status

This run extends the existing Slides workbench with a shared release-readiness
health analyzer and wires the result into the already-mounted inspector and
status bar.

New/changed implementation files:

- `apps/web/src/components/office/slides/deckHealth.ts`
- `apps/web/src/components/office/slides/deckHealth.spec.ts`
- `apps/web/src/components/office/SlidesEditor.tsx`
- `apps/web/src/components/office/SlideInspectorPanel.tsx`
- `apps/web/src/components/office/SlideStatusBar.tsx`

## Non-Redundant Slice

Existing capability found:

- `SlideInspectorPanel` already had a Deck health card and object inspector.
- `SlideStatusBar` already had readiness/PPTX/comment badges.
- `SlidesEditor` already tracked notes, sections, transitions, comments,
  animations, master objects, Smart Objects, and PPTX compatibility.
- `slides/sections.ts` already provided pure section counting/grouping.

What changed:

- Health calculation moved from inline React code into a pure helper.
- The same helper now counts missing notes, sections, animations, transition
  variety, auto-advance slides, hidden/locked objects, off-canvas objects,
  image alt text gaps, and AXOS Smart Objects that are contract-pending.
- The existing inspector now surfaces those counts and current-slide notes
  warnings.
- The existing status bar now exposes export readiness, notes, off-canvas, Smart
  Object pending state, and animation count.

What was intentionally not duplicated:

- No new Slides editor.
- No new Fabric canvas.
- No new OfficeShell.
- No duplicate comments model.
- No separate Deck Health panel outside the existing inspector/status-bar path.
- No fake live AXOS data fetches.

## Phase Status

| Phase | Status | Evidence | Next practical step |
| --- | --- | --- | --- |
| Phase 0 audit + visible fix | In review | This doc, capability audit, `slides/deckHealth.ts`, inspector/status bar wiring | Merge after CI, then keep docs updated per Slides PR |
| Phase 1 workbench | Strong seed | `OfficeShell.tsx`, `SlidesEditor.tsx` full-screen shell | Improve collapsible panels/focus mode |
| Phase 2 ribbon | Usable | `OfficeRibbon` tabs mounted in `SlidesEditor.tsx` | Reorganize Review/AXOS/Design tabs around existing actions |
| Phase 3 layouts | Usable | `SLIDE_LAYOUTS` in `slideAssets.ts` | Add richer industrial master metadata |
| Phase 4 themes | Partial | `SLIDE_THEMES` and theme remapping | Add premium industrial theme set |
| Phase 5 inspector | Usable | `SlideInspectorPanel.tsx` | Add multi-select actions and alt text edit |
| Phase 6 arrange/group | Usable | `SlidesEditor.tsx` Fabric align/distribute/group handlers | Add selection presets and shortcut help |
| Phase 7 guides/grid | Seed | Grid toggle exists | Add snap/guides without heavy dependency |
| Phase 8 typography | Partial | Text controls and bullets exist | Add font replacement/find typography tools |
| Phase 9 assets | Partial | `SlideAssetLibrary` | Add favorites/recent and expanded categories |
| Phase 10 tables | Usable | `slides/table.ts`, `SlideTableEditor.tsx` | Add industrial table presets |
| Phase 11 charts | Usable | `slides/chart.ts`, `SlideChartEditor.tsx` | Add industrial chart presets and health |
| Phase 12 SmartArt | Partial | `slides/smartart.ts`, `SlideSmartArtEditor.tsx` | Add node editing UI |
| Phase 13 Smart Objects | Partial | `slides/smartObjects.ts`, inspector smart-object section | Add explicit static/contract/live source state |
| Phase 14 generator | Partial | `lib/office/deckGen.ts` | Add generator wizard and contract markers |
| Phase 15 visual aids | Seed | visual aid layout/assets exist | Add visual-aid mode and print/export path |
| Phase 16 comments/review | Partial | `SlideCommentsPanel.tsx`, generic `office_comments` backend | Persist Slides comments through existing generic model |
| Phase 17 presenter | Strong seed | Presenter mode in `SlidesEditor.tsx` | Add preflight/rehearsal readiness |
| Phase 18 animations | Usable | `SlideAnimationPanel.tsx` | Add issue navigation and preset application |
| Phase 19 transitions | Usable | `SLIDE_TRANSITIONS`, presenter transitions | Add section/all consistency workflow |
| Phase 20 sorter/outline/reuse | Usable | `SlideSorter.tsx`, `SlideOutline.tsx`, `SlideReusePanel.tsx` | Add section collapse and bulk operations |
| Phase 21 import review | Partial | `pptxCompatibility.ts`, `pptxImport.ts` | Add dedicated import review panel |
| Phase 22 export | Usable | `pptx.ts`, status/inspector warnings | Add export options dialog |
| Phase 23 media | Partial | image effects/crop helpers | Add alt text/edit compression warnings |
| Phase 24 layers | Usable | `SlideLayersPanel.tsx` | Add filter/search/object health badges |
| Phase 25 deck health | Usable | `slides/deckHealth.ts` and UI wiring | Add jump-to-issue/fix actions |
| Phase 26 accessibility | Seed | Alt text gaps now counted | Add contrast/font-size/readability checks |
| Phase 27 keyboard | Partial | key handlers in `SlidesEditor.tsx` | Add shortcut help and more commands |
| Phase 28 performance | Pending | No dedicated optimization in this PR | Memoize health/thumbnails for large decks |
| Phase 29 CIDE contract | Pending | CIDE docs not yet created for Slides | Draft safe tool schemas after generator stabilizes |
| Phase 30 templates | Partial | `TemplateGallery`, deck generators | Expand industrial templates |
| Phase 31 Office/AXOS integration | Partial | deck generation and Smart Object sources | Add safe source freshness contracts |
| Phase 32 QA harness | Improving | `deckHealth.spec.ts` added | Add more pure helper specs |
| Phase 33 docs | Improving | This file and capability audit | Keep docs tied to code PRs |
