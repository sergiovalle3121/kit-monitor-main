# AXOS Slides Capability Audit

Date: 2026-06-29

This audit records the current AXOS Slides tree after inspecting the live editor,
Office shell, Slides panels, Slides helpers, PPTX helpers, and the Office backend
module. It is intentionally tied to real files so future Codex runs extend the
existing implementation instead of creating parallel editors or helper-only work.

## Open PR Collision Check

`gh pr list --repo Sergiovalle3121/axos-os --state open --limit 100` showed
Slides PR #831 (`codex/night-slides-reuse-search-correction`) touching
`SlideOutline.tsx`, `SlideSorter.tsx`, `SlideReusePanel.tsx`, and
`components/office/slides/slideNavigation*` / `slideReuse*`. This run avoided
those files and focused on deck quality/readability health instead.
`gh pr list --repo Sergiovalle3121/axos-os --state open --limit 100` showed open
Slides draft PR #831 touching `SlideOutline.tsx`, `SlideReusePanel.tsx`,
`SlideSorter.tsx`, `slides/slideNavigation.*`, and `slides/slideReuse.*`. This
run avoided those files and scoped the change to presenter readiness in the
existing `SlidesEditor.tsx` presentation path.

## Capability Matrix

| Capability | Exists? | Files | Maturity | Gap | Next non-redundant PR | Owner files | Collision risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Full-screen Office workbench | Yes | `OfficeShell.tsx`, `SlidesEditor.tsx` | strong | Slides still has dense internal panels on smaller desktop widths | Improve collapse/focus ergonomics without replacing OfficeShell | `components/office/SlidesEditor.tsx` | medium |
| PowerPoint-style ribbon | Yes | `SlidesEditor.tsx`, `components/office/ribbon/**` | usable | Tabs are broad; Inicio/Insertar/Formato/Vista exist but not full PowerPoint tab taxonomy | Reorganize into dedicated Design/Review/AXOS actions using existing buttons | `SlidesEditor.tsx`, `ribbon/**` | medium |
| Fabric slide canvas | Yes | `SlidesEditor.tsx` | strong | Large-deck render performance still relies on full JSON sync in several flows | Memoize health/thumbnails and debounce expensive scans | `SlidesEditor.tsx`, `slides/deckHealth.ts` | medium |
| Status bar | Yes | `SlideStatusBar.tsx`, `SlideInspectorPanel.tsx`, `slides/deckHealth.ts` | usable | Needs jump-to-issue actions and export report | Add issue navigation from health metrics | `SlideStatusBar.tsx`, `SlideInspectorPanel.tsx` | low |
| Deck health / release readiness | Yes | `SlideInspectorPanel.tsx`, `SlideStatusBar.tsx`, `slides/deckHealth.ts` | usable | No jump/fix workflow for every issue yet | Build dedicated issue list inside existing inspector | `SlideInspectorPanel.tsx`, `slides/deckHealth.ts` | low |
| Accessibility / presentation quality | Yes | `slides/presentationQuality.ts`, `slides/deckHealth.ts`, `SlideInspectorPanel.tsx`, `SlideStatusBar.tsx` | usable | Detects title, notes, contrast, small text, dense slides, alt text, and off-canvas issues; no auto-fix/jump workflow yet | Add jump-to-issue and safe quick fixes for alt text/title/contrast | `slides/presentationQuality.ts`, `SlideInspectorPanel.tsx`, `SlideStatusBar.tsx`, `SlidesEditor.tsx` | low |
| Slide sections | Yes | `slides/sections.ts`, `SlideSorter.tsx`, `SlidesEditor.tsx` | usable | Sections are visible but not collapsible in thumbnail rail | Add collapsible sections/reorder affordances | `SlidesEditor.tsx`, `SlideSorter.tsx`, `slides/sections.ts` | medium |
| Slide sorter | Yes | `SlideSorter.tsx`, `SlidesEditor.tsx` | usable | Drag reorder exists; bulk actions are limited | Add bulk delete/move-to-section with confirmation | `SlideSorter.tsx` | low |
| Outline view | Yes | `SlideOutline.tsx`, `SlidesEditor.tsx` | usable | Edits titles only; no find/filter integration | Add outline search and section grouping | `SlideOutline.tsx` | low |
| Reuse slides | Yes | `SlideReusePanel.tsx`, `SlidesEditor.tsx` | usable | Reuses AXOS JSON, not PPTX source slides | Connect imported PPTX review output to reuse workflow | `SlideReusePanel.tsx`, `lib/office/pptxImport.ts` | medium |
| Comments/review | Yes | `SlideCommentsPanel.tsx`, `apps/api/src/modules/office/entities/office-comment.entity.ts` | partial | Client comments exist; backend generic Office comments also exists; convergence remains incomplete | Persist Slides comments through generic `office_comments` without adding a third model | `SlideCommentsPanel.tsx`, `apps/api/src/modules/office/**` | high |
| Layers/selection | Yes | `SlideLayersPanel.tsx`, `SlideInspectorPanel.tsx` | usable | Rename/filter/group metadata is still thin | Add layer search/filter and object health badges | `SlideLayersPanel.tsx` | low |
| Object inspector | Yes | `SlideInspectorPanel.tsx` | usable | Multi-select operations and alt text edits are incomplete | Add multi-select inspector actions and alt text field | `SlideInspectorPanel.tsx`, `SlidesEditor.tsx` | medium |
| Animations | Yes | `SlideAnimationPanel.tsx`, `slideAssets.ts`, `SlidesEditor.tsx` | usable | Timeline exists but lacks full issue health/jump support | Add animation health, clear/apply presets per slide | `SlideAnimationPanel.tsx` | low |
| Transitions | Yes | `slideAssets.ts`, `SlidesEditor.tsx`, presenter mode | usable | Transition consistency is counted, but no apply-to-section | Add section-level transition apply workflow | `SlidesEditor.tsx`, `slides/sections.ts` | medium |
| Presenter mode | Yes | `SlidesEditor.tsx`, `slides/presenterReadiness.ts` | strong | Presenter now has readiness preflight, but rehearsal recording/export is not surfaced | Add rehearsal capture/export summary after presenter run | `SlidesEditor.tsx`, `slides/presenterReadiness.ts` | low |
| Slide layouts | Yes | `slideAssets.ts`, `SlidesEditor.tsx` | usable | Layout gallery is seeded; no true master metadata model | Add master/layout metadata and reset placeholders | `slideAssets.ts`, `SlidesEditor.tsx` | medium |
| Themes | Yes | `slideAssets.ts`, `SlidesEditor.tsx` | partial | Theme slots exist, but industrial premium themes are incomplete | Add AXOS Executive/Quality/NPI/Supplier theme variants | `slideAssets.ts` | low |
| Tables | Yes | `slides/table.ts`, `SlideTableEditor.tsx`, `lib/office/pptx.ts` | usable | Industrial table presets are limited | Add action register/risk matrix/supplier scorecard presets | `slides/table.ts`, `SlideTableEditor.tsx` | low |
| Charts | Yes | `slides/chart.ts`, `SlideChartEditor.tsx`, `lib/office/pptx.ts` | usable | Industrial presets and chart health are thin | Add OEE/Pareto/supplier score presets and warnings | `slides/chart.ts`, `SlideChartEditor.tsx` | low |
| SmartArt | Yes | `slides/smartart.ts`, `SlideSmartArtEditor.tsx` | partial | Editable node operations are text-list only | Add node add/remove/reorder UI | `slides/smartart.ts`, `SlideSmartArtEditor.tsx` | low |
| AXOS Smart Objects | Yes | `slides/smartObjects.ts`, `SlidesEditor.tsx`, `SlideInspectorPanel.tsx` | partial | Contract-pending/live data state is now counted, but no endpoint refresh contract | Add explicit static/contract-pending/live badges and safe refresh adapter | `slides/smartObjects.ts`, `SlideInspectorPanel.tsx` | medium |
| Industrial asset library | Yes | `slides/AssetLibrary.tsx`, `slideAssets.ts` | partial | Categories are seeded; favorites/recent metadata absent | Add favorites/recent plus alt text persistence | `slides/AssetLibrary.tsx`, `SlidesEditor.tsx` | low |
| PPTX export | Yes | `lib/office/pptx.ts`, `SlidesEditor.tsx` | usable | Export preflight is visible but selected-slide/options flow is limited | Add export dialog with include notes/comments/hidden slides | `lib/office/pptx.ts`, `SlidesEditor.tsx` | medium |
| PPTX import review | Yes | `lib/office/pptxCompatibility.ts`, `lib/office/pptxImport.ts` | partial | Compatibility report is surfaced as warnings, but review panel is not dedicated | Add import review panel reusing compatibility scanner | `lib/office/pptxCompatibility.ts`, `SlidesEditor.tsx` | medium |
| Deck generation | Yes | `lib/office/deckGen.ts`, `GenerateDeckButton.tsx` | partial | Generators exist for several reviews, but AXOS contract-pending markers need better UI | Add generator wizard with source/contract status per slide | `lib/office/deckGen.ts`, `GenerateDeckButton.tsx` | medium |
| Visual aids mode | Seeded | `slideAssets.ts`, `slides/AssetLibrary.tsx`, `lib/office/slidesPdf.ts` | seed | Templates and export snapshots exist in pieces, not a mode | Add visual-aid template workflow and print/export readiness | `slideAssets.ts`, `SlidesEditor.tsx` | medium |
| Office backend persistence | Yes | `apps/api/src/modules/office/**` | usable | Slides comments still need generic persistent comment convergence | Extend existing Office comments, do not add new table | `apps/api/src/modules/office/**` | high |

## Files Inspected

- `AGENTS.md`
- `README.md`
- `AXOS_OS_ARCHITECTURE.md`
- `docs/design/**`
- `docs/AADS/**`
- `docs/codex-night-log.md`
- `apps/web/src/components/office/OfficeShell.tsx`
- `apps/web/src/components/office/SlidesEditor.tsx`
- `apps/web/src/components/office/SlideAnimationPanel.tsx`
- `apps/web/src/components/office/SlideLayersPanel.tsx`
- `apps/web/src/components/office/SlideCommentsPanel.tsx`
- `apps/web/src/components/office/SlideInspectorPanel.tsx`
- `apps/web/src/components/office/SlideStatusBar.tsx`
- `apps/web/src/components/office/SlideChartEditor.tsx`
- `apps/web/src/components/office/SlideTableEditor.tsx`
- `apps/web/src/components/office/SlideSmartArtEditor.tsx`
- `apps/web/src/components/office/SlideSorter.tsx`
- `apps/web/src/components/office/SlideOutline.tsx`
- `apps/web/src/components/office/SlideReusePanel.tsx`
- `apps/web/src/components/office/slideAssets.ts`
- `apps/web/src/components/office/slides/**`
- `apps/web/src/components/office/slides/presentationQuality.ts`
- `apps/web/src/lib/office/**`
- `apps/api/src/modules/office/**`
