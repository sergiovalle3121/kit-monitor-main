# AXOS Slides Tree Status

Last updated: 2026-06-29

## Current tree

| Area | Current files | Status |
| --- | --- | --- |
| Main editor | `apps/web/src/components/office/SlidesEditor.tsx` | Fabric-based editor with ribbon, slide rail, canvas, notes, sections, master mode, presenter mode, comments, layers, animations, charts, tables, SmartArt, Smart Objects, assets, import/export paths. |
| Workbench shell | `apps/web/src/components/office/OfficeShell.tsx`, route chrome docs | Office is treated as a full-screen workbench, matching AXOS shell taxonomy. |
| Status/health UI | `SlideInspectorPanel.tsx`, `SlideStatusBar.tsx`, `slides/deckHealth.ts` | Release readiness is now visible in both inspector and bottom status bar. |
| Review | `SlideCommentsPanel.tsx`, `apps/api/src/modules/office/**` | Threaded slide/object comments exist with optimistic persistence through generic Office comments. |
| Navigation | `SlideSorter.tsx`, `SlideOutline.tsx`, `SlideReusePanel.tsx`, `slides/sections.ts` | Sorter, outline, reuse, and sections are present. |
| Industrial authoring | `slides/AssetLibrary.tsx`, `slides/smartObjects.ts`, `TemplateGallery.tsx`, `lib/office/deckGen.ts` | Manufacturing assets, Smart Objects, templates, and generator foundations exist. |
| PPTX | `lib/office/pptx.ts`, `lib/office/pptxImport.ts`, `lib/office/pptxCompatibility.ts`, `SlideActions.tsx` | Import/export and compatibility scanning exist; export preflight still needs a modal. |
| Tests | `slides/sections.spec.ts`, `slides/shapes.spec.ts`, `slides/deckHealth.spec.ts`, `lib/office/pptx*.spec.ts` | Pure helper coverage exists for sections/shapes/PPTX and now deck health. |

## This run

- Added a pure deck release-readiness analyzer at `apps/web/src/components/office/slides/deckHealth.ts`.
- Reused `slides/sections.ts` for section counts instead of creating a second section model.
- Wired the analyzer into `SlidesEditor.tsx` where health was previously computed inline.
- Extended `SlideInspectorPanel.tsx` with missing notes, sections, animations, off-canvas objects, image alt text gaps, hidden/locked objects, Smart Object contract-pending counts, transition consistency, and export readiness.
- Extended `SlideStatusBar.tsx` with missing-notes and export-readiness badges.
- Added `deckHealth.spec.ts` covering title detection, background-only empties, notes, comments, PPTX warnings, Smart Objects, animation counts, off-canvas detection, alt text gaps, and export readiness.

## Next recommended Slides PR

Add a real export preflight modal in `SlideActions.tsx` that consumes `deckHealth.ts`, lets users choose all/selected slides, notes, comments, hidden slides, and shows the same blockers before writing PPTX/PDF/PNG/SVG.

## Collision notes

Open PR scan on 2026-06-29 found no active PR editing core Slides files. Existing open PRs do touch shared Office helpers for Sheets/Docs, so this run avoided generic Office comment backend changes and kept the implementation in Slides-specific components.
