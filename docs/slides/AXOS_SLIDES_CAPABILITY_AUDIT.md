# AXOS Slides Capability Audit

Last updated: 2026-06-29

This audit records the current Slides implementation inspected during the release-readiness workstream. It is intentionally scoped to AXOS Slides and avoids proposing parallel editors, comment systems, canvases, or export stacks.

| Capability | Exists? | Files | Maturity | Gap | Next non-redundant PR | Owner files | Collision risk with open PRs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fabric Slides editor | Yes | `apps/web/src/components/office/SlidesEditor.tsx` | strong | Large file; shared health logic was inline | Continue extracting pure helpers only when wired to UI | `SlidesEditor.tsx`, `slides/**` | Low: no open Slides PRs found on 2026-06-29 |
| Office ribbon shell | Yes | `apps/web/src/components/office/ribbon/**`, `SlidesEditor.tsx` | usable | Ribbon is broad, but not yet full PowerPoint parity | Group review/export actions around readiness | `SlidesEditor.tsx`, `ribbon/**` | Low |
| Status bar | Yes | `SlideStatusBar.tsx` | usable | Needed export/readiness badges beyond raw score | Add release/export readiness badges | `SlideStatusBar.tsx` | Low |
| Deck health | Yes | `SlideInspectorPanel.tsx`, `SlidesEditor.tsx` | partial | Score only covered empty slides, titles, comments and PPTX issue count | Add pure release-readiness scanner with notes, off-canvas, alt text, locks, Smart Objects and export warnings | `slides/deckHealth.ts`, `SlideInspectorPanel.tsx`, `SlideStatusBar.tsx` | Low |
| PPTX compatibility scanner | Yes | `apps/web/src/lib/office/pptxCompatibility.ts`, `pptxImport.ts` | usable | Import report existed, but release readiness did not include AXOS-native export gaps | Surface PPTX/import issues inside deck health | `pptxCompatibility.ts`, `SlideInspectorPanel.tsx` | Low |
| PPTX export | Yes | `apps/web/src/lib/office/pptx.ts` | usable | Animations/transitions are not native PPTX timing yet | Pre-export warnings and export workflow options | `pptx.ts`, `SlidesEditor.tsx` | Low |
| Comments/review | Yes | `SlideCommentsPanel.tsx`, `apps/api/src/modules/office/**` | usable | Threads exist; release readiness needed unresolved counts and navigation | Jump from health issue to comments panel | `SlideCommentsPanel.tsx`, `SlidesEditor.tsx` | Low |
| Slide sections | Yes | `slides/sections.ts`, `SlideSorter.tsx`, `SlidesEditor.tsx` | usable | Status visibility was limited | Count sections in status/health | `slides/sections.ts`, `SlideStatusBar.tsx` | Low |
| Layers/selection | Yes | `SlideLayersPanel.tsx`, `SlideInspectorPanel.tsx` | usable | Hidden/locked/off-canvas risks were not summarized | Add layer/object release-readiness diagnostics | `SlideLayersPanel.tsx`, `slides/deckHealth.ts` | Low |
| Animations | Yes | `SlideAnimationPanel.tsx`, `slideAssets.ts`, `SlidesEditor.tsx` | usable | AXOS playback exists; PPTX timing export still needs compatibility warnings | Include animation export review in deck health | `SlideAnimationPanel.tsx`, `slides/deckHealth.ts` | Low |
| Tables | Yes | `SlideTableEditor.tsx`, `slides/table.ts`, `pptx.ts` | usable | More industrial presets pending | Add table presets/action register hardening | `SlideTableEditor.tsx`, `slides/table.ts` | Low |
| Charts | Yes | `SlideChartEditor.tsx`, `slides/chart.ts`, `pptx.ts` | strong | Chart health/status could be richer | Add chart health and export warnings per chart type | `SlideChartEditor.tsx`, `slides/chart.ts` | Low |
| SmartArt | Yes | `SlideSmartArtEditor.tsx`, `slides/smartart.ts` | usable | Editable node workflow is basic | Add node add/remove/order UX | `SlideSmartArtEditor.tsx`, `slides/smartart.ts` | Low |
| Smart Objects | Yes | `slides/smartObjects.ts`, `SlidesEditor.tsx`, `deckGen.ts` | partial | Data binding is metadata/contract pending | Add explicit static vs contract-pending metadata and refresh state | `slides/smartObjects.ts`, `SlideInspectorPanel.tsx` | Low |
| Industrial asset library | Yes | `slides/AssetLibrary.tsx`, `slideAssets.ts` | partial | Categories/search exist, governance/favorites pending | Favorites/recently used and alt text metadata | `slides/AssetLibrary.tsx`, `slides/deckHealth.ts` | Low |
| Deck generation | Yes | `apps/web/src/lib/office/deckGen.ts`, `GenerateDeckButton.tsx` | usable | More deck types and source contracts pending | Expand generators with contract-pending Smart Objects | `deckGen.ts`, `GenerateDeckButton.tsx` | Low |
| Presenter mode | Yes | `SlidesEditor.tsx` | usable | Pen/laser/advanced controls remain pending | Presenter tools without breaking existing mode | `SlidesEditor.tsx` | Low |

## Visible fix delivered in this PR

- Added `slides/deckHealth.ts` as the pure release-readiness scanner.
- Wired readiness issues into the existing `SlideInspectorPanel` and `SlideStatusBar`.
- Added jump-to-issue actions that reuse `SlidesEditor` navigation and existing comments/layers/animations panels.
- Added a focused spec for the new scanner.
