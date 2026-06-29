# AXOS Slides Capability Audit

Last updated: 2026-06-29

Scope: AXOS Slides only. This audit was created from the current implementation in `apps/web/src/components/office`, `apps/web/src/components/office/slides`, `apps/web/src/lib/office`, and `apps/api/src/modules/office`.

## Open PR collision scan

`gh pr list --repo Sergiovalle3121/axos-os --state open --limit 100` showed open work in Sheets, CAD, MES, platform, packing, import, planning, Docs comments, and shared Office helpers. No open PR directly touched `SlidesEditor.tsx`, `SlideAnimationPanel.tsx`, `SlideLayersPanel.tsx`, `SlideCommentsPanel.tsx`, `SlideInspectorPanel.tsx`, `SlideStatusBar.tsx`, `apps/web/src/components/office/slides/**`, or Slides PPTX import/export files.

## Capability matrix

| Capability | Exists? | Files | Maturity | Gap | Next non-redundant PR | Owner files | Collision risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Full-screen Slides workbench | Yes | `SlidesEditor.tsx`, `OfficeShell.tsx`, route chrome docs | usable | Dense editor still needs more PowerPoint-style view controls | Improve focus/read-only/view modes | `SlidesEditor.tsx`, `OfficeShell.tsx` | Medium |
| Ribbon/tool organization | Yes | `SlidesEditor.tsx`, `components/office/ribbon/**` | usable | Tabs exist but are still compact and mixed | Split review/export/view actions into clearer tabs | `SlidesEditor.tsx`, `ribbon/**` | Medium |
| Layouts and slide master | Yes | `slideAssets.ts`, `SlidesEditor.tsx` | usable | Master presets exist, placeholder governance is partial | Expand layout gallery and reset/apply rules | `slideAssets.ts`, `SlidesEditor.tsx` | Medium |
| Theme system | Yes | `slideAssets.ts`, `SlidesEditor.tsx` | usable | Theme slots exist; preview/variant system is partial | Add industrial theme variants and preservation controls | `slideAssets.ts`, `SlidesEditor.tsx` | Medium |
| Object inspector | Yes | `SlideInspectorPanel.tsx`, `SlidesEditor.tsx` | usable | Needed richer deck health and release readiness signals | This PR extends health without duplicating the inspector | `SlideInspectorPanel.tsx`, `SlidesEditor.tsx` | Low |
| Arrange/align/group | Yes | `SlidesEditor.tsx`, `SlideLayersPanel.tsx` | usable | Needs keyboard productivity and locked-object UX polish | Add shortcut help and selection safety states | `SlidesEditor.tsx`, `SlideLayersPanel.tsx` | Medium |
| Guides/grid/snap | Partial | `SlidesEditor.tsx` | partial | Grid exists; object snap/guides are not robust | Add alignment guides and snap feedback | `SlidesEditor.tsx`, `slides/**` | Medium |
| Text typography tools | Yes | `SlidesEditor.tsx` | usable | Needs styles and find/replace depth | Add text style presets and replace fonts | `SlidesEditor.tsx`, `SlideFindReplace.tsx` | Low |
| Industrial assets | Yes | `slides/AssetLibrary.tsx`, `slideAssets.ts`, `SlidesEditor.tsx` | usable | Needs favorites/recent/assets governance | Add favorites and recent industrial assets | `AssetLibrary.tsx`, `SlidesEditor.tsx` | Low |
| Tables | Yes | `slides/table.ts`, `SlideTableEditor.tsx`, `pptx.ts` | usable | Needs industrial table preset gallery | Add table presets and export warnings | `slides/table.ts`, `SlideTableEditor.tsx` | Low |
| Charts | Yes | `slides/chart.ts`, `SlideChartEditor.tsx`, `pptx.ts` | usable | Needs chart health and more industrial presets | Add chart health and presets | `slides/chart.ts`, `SlideChartEditor.tsx` | Low |
| SmartArt/diagrams | Yes | `slides/smartart.ts`, `SlideSmartArtEditor.tsx` | partial | Nodes are editable only through basic spec editing | Add node-level edit controls | `slides/smartart.ts`, `SlideSmartArtEditor.tsx` | Low |
| AXOS Smart Objects | Yes | `slides/smartObjects.ts`, `SlidesEditor.tsx` | partial | Live contracts are metadata-only | Add contract-pending refresh UX | `slides/smartObjects.ts`, `SlideInspectorPanel.tsx` | Medium |
| Deck generator | Yes | `GenerateDeckButton.tsx`, `lib/office/deckGen.ts`, `SlidesEditor.tsx` | partial | More deck types and contract status are needed | Expand industrial deck generator types | `deckGen.ts`, `SlidesEditor.tsx` | Medium |
| Visual aids mode | Partial | `slideAssets.ts`, `SlidesEditor.tsx`, roadmap docs | seed | Needs operator-readable templates and export path | Add visual aid templates and snapshot workflow | `slideAssets.ts`, `SlidesEditor.tsx` | Medium |
| Comments/review | Yes | `SlideCommentsPanel.tsx`, `office-comments` API | usable | Needs review summary and jump-to-thread | Add review summary and object jump actions | `SlideCommentsPanel.tsx`, `SlidesEditor.tsx` | Medium due Docs comment PRs |
| Presenter mode | Yes | `SlidesEditor.tsx` | strong | Presenter mode has notes, timer, navigator, ink, black/white screen | Add presenter rehearsal/readiness view | `SlidesEditor.tsx` | Medium |
| Animations | Yes | `SlideAnimationPanel.tsx`, `slideAssets.ts`, `SlidesEditor.tsx` | usable | Timeline exists; export compatibility needs more warnings | Add animation export review | `SlideAnimationPanel.tsx`, `pptx.ts` | Low |
| Transitions | Yes | `slideAssets.ts`, `SlidesEditor.tsx` | usable | Needs consistency/readiness surfacing | This PR adds transition variety health | `SlidesEditor.tsx`, `deckHealth.ts` | Low |
| Sorter/outline/reuse | Yes | `SlideSorter.tsx`, `SlideOutline.tsx`, `SlideReusePanel.tsx`, `slides/sections.ts` | usable | Drag/bulk management can improve | Add bulk deck structure actions | `SlideSorter.tsx`, `SlideOutline.tsx` | Low |
| PPTX import review | Yes | `pptxImport.ts`, `pptxCompatibility.ts`, `SlideInspectorPanel.tsx` | usable | Import warnings exist but are not full release health | Add import review panel | `pptxCompatibility.ts`, `SlidesEditor.tsx` | Low |
| PPTX export | Yes | `SlideActions.tsx`, `pptx.ts` | usable | Export preflight options are minimal | Add export modal with selected slides/options | `SlideActions.tsx`, `pptx.ts` | Low |
| Media/image tools | Yes | `slides/imageEffects.ts`, `ImageEffectsPanel.tsx`, `SlidesEditor.tsx` | usable | Alt text and large-image warnings are incomplete | Add image metadata inspector | `ImageEffectsPanel.tsx`, `SlideInspectorPanel.tsx` | Low |
| Layers/selection | Yes | `SlideLayersPanel.tsx`, `SlidesEditor.tsx` | usable | Rename/filter/group health still basic | Add layer health and filters | `SlideLayersPanel.tsx` | Low |
| Deck health/release readiness | Partial | `SlideInspectorPanel.tsx`, `SlideStatusBar.tsx` | partial | Existing score covered only titles, empties, comments, PPTX warnings | This PR adds pure release-readiness health and UI badges | `deckHealth.ts`, `SlidesEditor.tsx`, `SlideInspectorPanel.tsx`, `SlideStatusBar.tsx` | Low |
| Accessibility/presentation quality | Partial | `SlideInspectorPanel.tsx`, `deckHealth.ts` | seed | Low contrast/reading order are not checked | Add accessibility quality audit | `deckHealth.ts`, `SlideInspectorPanel.tsx` | Low |
| Keyboard productivity | Partial | `SlidesEditor.tsx` | partial | Some shortcuts exist; help panel missing | Add shortcut help and conflict guards | `SlidesEditor.tsx` | Low |
| Performance for large decks | Partial | `SlidesEditor.tsx` | partial | Health scans are lightweight but not memoized | Memoize deck health and lazy panels | `SlidesEditor.tsx`, `deckHealth.ts` | Low |
| CIDE/NL Slides contract | No | Roadmap only | seed | No formal tools contract | Create CIDE Slides contract doc and schemas | `docs/slides/**`, contracts | Low |
| Industrial templates | Yes | `TemplateGallery.tsx`, `deckGen.ts`, `slideAssets.ts` | partial | More manufacturing decks needed | Expand template library | `TemplateGallery.tsx`, `deckGen.ts` | Low |
| Office/AXOS integration | Partial | `deckGen.ts`, `axosConnectors.ts`, `GenerateDeckButton.tsx` | partial | Data contracts are not live for Slides | Add metadata-first AXOS source contracts | `deckGen.ts`, `axosConnectors.ts` | Medium |
| Slides QA harness | Partial | `slides/*.spec.ts`, `lib/office/*.spec.ts` | usable | Deck health lacked tests | This PR adds `deckHealth.spec.ts` | `slides/*.spec.ts` | Low |

## Non-redundant slice chosen

This PR extends the existing deck health block instead of creating another panel. It reuses the current `SlideInspectorPanel`, `SlideStatusBar`, `slides/sections.ts`, comment metadata, transition arrays, notes arrays, Smart Object metadata, and PPTX compatibility report.
