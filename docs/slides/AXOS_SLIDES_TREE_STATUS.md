# AXOS Slides Tree Status

Last updated: 2026-06-29

## Current tree

AXOS Slides is built on the existing Office surface:

- Main editor: `apps/web/src/components/office/SlidesEditor.tsx`
- Workbench panels: `SlideInspectorPanel.tsx`, `SlideStatusBar.tsx`, `SlideAnimationPanel.tsx`, `SlideLayersPanel.tsx`, `SlideCommentsPanel.tsx`
- Navigation: `SlideSorter.tsx`, `SlideOutline.tsx`, `SlideReusePanel.tsx`
- Slide foundations: `apps/web/src/components/office/slides/**`, `slideAssets.ts`
- Import/export/generation: `apps/web/src/lib/office/pptx.ts`, `pptxImport.ts`, `pptxCompatibility.ts`, `deckGen.ts`
- Persistent Office comments and lifecycle: `apps/api/src/modules/office/**`

## Status by product area

| Area | Status | Evidence | Next non-redundant step |
| --- | --- | --- | --- |
| Workbench shell | Usable | Editor already mounts ribbon, thumbnail rail, canvas, notes, inspector and status bar | Collapse/resize inspector and focus mode polish |
| Release readiness | Improved in this PR | `slides/deckHealth.ts`, inspector issue list, status badges | Export readiness report download and one-click safe fixes |
| Review/comments | Usable | Persistent generic `office_comments`, threaded slide comments UI | Jump directly to object anchors and reviewer summary |
| PPTX import review | Usable | Compatibility scanner and imported report metadata | Dedicated import review panel with feature categories |
| PPTX export | Usable | Native export for text/shapes/images/tables/charts/notes | Export options for selected slides, comments, hidden slides and warnings |
| Slide sections/navigation | Usable | Sections helper, sorter section headers, outline editor | Collapse sections, bulk move/delete and structure health |
| Layers/selection | Usable | Visibility, locking, reorder and inspector metadata | Rename objects, badges for comments/animations/links |
| Animations/transitions | Partial | Animation panel and transition controls exist | Native PPTX timing mapping or explicit export approximation report |
| Smart Objects | Partial | Fabric groups with AXOS source hints | Static vs contract-pending/live mode, freshness metadata and refresh contracts |
| Industrial templates/generator | Usable seed | Line, Quality, Executive Ops and Launch decks | More manufacturing deck types with source freshness markers |
| Accessibility/visual aid quality | Seed | Release readiness now checks missing image labels and notes | Low contrast, font size, reading order and visual aid readability audit |

## Collision note

`gh pr list --repo Sergiovalle3121/axos-os --state open --limit 100` on 2026-06-29 showed no open PRs touching Slides files. The only local dirty work in the base checkout was unrelated MES/dashboard/docs work on another branch, so this run used a fresh worktree from `origin/main`.

## Next Slides PR

The next safe slice is a dedicated PPTX export workflow panel that reuses the new release-readiness scanner before export. It should offer selected/all slides, include notes, include hidden slides, include comments if supported, and show the same warning categories without duplicating export helpers.
