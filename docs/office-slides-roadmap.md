# AXOS Slides — Industrial Presentation Suite Roadmap

AXOS Slides is the presentation surface for AXOS Office. It should feel familiar
to PowerPoint users while adding manufacturing-native workflows that are only
possible because AXOS owns ERP, MES, quality, engineering and production data.

## Current foundation

- Office Hub and OfficeShell.
- Fabric-based SlidesEditor with shapes, images, tables, charts, SmartArt,
  connectors, notes, layers, reuse slides, backgrounds, crop/effects, basic slide
  master, animations, transitions, PPTX/PDF/PNG export and PPTX import.
- Autosave, version history, sharing and an Office-style ribbon.

## Delivery principles

1. Do not replace working Office components; extend them in small PRs.
2. Keep Docs and Sheets stable.
3. Preserve editable native objects for PPTX whenever possible.
4. Warn users when imported PPTX content contains unsupported features instead
   of silently pretending fidelity is perfect.
5. Every AXOS-connected object must be tenant-safe and refreshable.

## Phased roadmap

### Phase 1 — PowerPoint-grade UX

- Refine ribbon groups, sidebar, status bar, zoom controls and full-screen edit.
- Add dedicated panels for properties, comments and assets while reusing current
  layer and animation panels.

### Phase 2 — Professional canvas

- Expand alignment, distribution, grouping, z-order, locking, guides and snapping.
- Improve connector routing, arrow styles, SVG handling and visual effects.

### Phase 3 — Slide master v2

- Support reusable layouts, typed placeholders, theme variants, corporate logos,
  headers, footers, slide numbers and dates.
- Theme changes should remap deck-level theme slots without overwriting manually
  chosen colors.

### Phase 4 — AXOS smart objects

- Add KPI cards, OEE gauges, Pareto charts, risk matrices, BOM trees, value
  streams, kanban boards and manufacturing-cell diagrams.
- Each smart object stores a data binding descriptor and a last-refresh snapshot.

### Phase 5 — PPTX compatibility hardening

- Continue native export for text, shapes, images, tables, charts, notes,
  hyperlinks, connectors and slide furniture.
- Import masters, layouts, placeholders, theme colors and known shapes as native
  AXOS objects.
- Show compatibility warnings for macros, OLE/ActiveX, audio/video, comments,
  SmartArt, animations, transitions, custom geometry and gradients.

### Phase 6 — Presenter mode

- Complete presenter view with notes, timer, clock, next slide, laser pointer,
  pen/highlighter, black/white screen, jump-to-slide and search.

### Phase 7 — Collaboration and comments

- Persist enterprise comment threads with replies, resolve state, mentions,
  assignments and slide/object anchors.
- Prepare presence, remote cursors and locks without weakening autosave.

### Phase 8 — Industrial templates and live reports

- Maintain premium templates for daily production, executive ops, quality,
  supplier, customer, launch, 8D, CAPA, maintenance, safety and kaizen reviews.
- Generate refreshable decks from AXOS production, OEE, scrap, downtime, NCR,
  CAPA, inventory, MRP, customer and supplier data.

## First implementation slice

The first hardening slice adds a PPTX compatibility scanner. It inspects OOXML
parts client-side, never executes macros, and attaches a report to imported AXOS
decks so the Office Hub can warn users when a file contains features that AXOS
currently skips or approximates.

## Delivered slice — persistent Office comments foundation

- Added a tenant-scoped `office_comments` table for Docs, Sheets and Slides.
- Added generic anchors (`document`, `slide`, `object`, `cell`, `range`, `text`) so
  Slides comments can target a slide or Fabric object today, while Docs/Sheets can
  reuse the same model later.
- Added REST endpoints to list, create, resolve/reopen and delete comments.
- Wired SlidesEditor to load persistent comments when a document id is available,
  with optimistic local fallback so editing still works if the comments API is
  temporarily unavailable.

## Delivered slice — professional chart types

- Added Slides chart support for Pareto, Waterfall and Gauge visuals on top of
  the existing bar, horizontal bar, line, area, pie and doughnut chart engine.
- The new chart types remain Fabric-native for editing/presentation/PDF/PNG and
  keep `chartSpec` persistence so they can be regenerated and exported.
- PPTX export approximates these new industrial chart types with editable native
  PowerPoint chart primitives where direct native equivalents are unavailable.

## Delivered slice — presenter navigation hardening

- Added white-screen mode alongside black-screen mode for live presenting.
- Added searchable jump-to-slide overlay in thumbnail navigator, filtering by
  slide title and speaker notes.
- Added Home/End keyboard navigation for first/last slide and `/` as a quick
  shortcut into the searchable navigator.

## Delivered slice — animation timeline controls

- Expanded object animation choices with motion-path effects for directional and looped movement.
- Added per-object repeat controls (1×, 2×, 3× and continuous) in the ribbon and animation pane.
- Added a compact timeline bar in the animation pane so authors can see delay, duration and repeat density before previewing.
- Updated presenter/preview playback so repeat and motion-path metadata is honored without changing the stored deck format.

## Delivered slice — industrial asset library foundation

- Added a reusable Slides asset library component with searchable manufacturing, Lean, Quality, Safety and Engineering symbols.
- Wired the asset library into the existing Insert ribbon next to the icon picker, reusing the current SVG-to-Fabric import path instead of duplicating canvas logic.
- Persisted inserted asset metadata (`assetId`, `assetCategory`) inside slide JSON so future enterprise asset governance and PPTX mapping can identify symbols.

## Delivered slice — AXOS smart objects foundation

- Added a reusable Smart Objects engine for KPI cards, OEE gauges, risk matrices, Gantt blocks, Kanban boards and value-stream diagrams.
- Wired Smart Objects into the Insert ribbon as AXOS-ready objects with persisted `smartObject` metadata and default data-source hints.
- Built the objects as Fabric groups so they remain editable, presentable and exportable through existing slide rendering flows.

## Delivered slice — automated executive and launch decks

- Added automatic Executive Operations Review generation with AXOS Smart Objects for revenue, margin, OEE, OTD, cash and backlog.
- Added automatic Launch Readiness Review generation with Gantt, risk matrix, PPAP/tooling/supply scorecards, milestones, risks and SOP open-items.
- Reused the existing native table/chart builders and the new Smart Objects engine so generated decks remain editable and exportable.

## Delivered slice — PPTX compatibility scanner expansion

- Expanded PPTX compatibility analysis to report slide masters, layouts, theme variants, embedded fonts, speaker notes, native charts, tables, grouped objects and connectors.
- Extended the compatibility smoke spec with synthetic OOXML coverage for these PowerPoint features.
- Kept the scanner conservative and non-executing: it only inspects ZIP part names and XML strings, never macros or embedded code.

## Delivered slice — PPTX comments import bridge

- Added a best-effort PPTX comments reader that imports PowerPoint slide comments into AXOS Slides comment metadata.
- Attached imported comments to the correct slide index with PowerPoint authorship fallback, unresolved status and timestamps when OOXML provides them.
- Kept import safe and non-blocking: malformed comment XML is skipped without failing the deck import.

## Delivered slice — SVG export

- Added SVG export for individual/all slides using the existing Fabric static render pipeline.
- Exposed a new "Vectores (SVG)" export option beside PPTX, PDF and PNG.
- SVG output preserves vector geometry where Fabric can serialize it and remains independent from server-side export infrastructure.

## Delivered slice — threaded slide comments

- Added reply support to the Slides comments panel so review conversations can continue inside a single thread.
- Wired optimistic replies through the existing Office comments API using `parentId`, preserving slide/object anchors.
- Updated local deletion to remove a thread and its replies together, keeping the panel consistent before backend sync completes.

## Delivered slice — comment assignments via mentions

- Added lightweight assignment extraction from `@email` mentions in slide comments and replies.
- Sent detected assignees to the persistent Office comments API through `assignedTo` while preserving optimistic local comments.
- Displayed assignment badges in the Slides comments panel so review owners are visible during deck collaboration.

## Delivered slice — comment search and filters

- Added comment-panel search across root comments, replies, authors, assignments and object labels.
- Added quick filters for all, open, assigned and resolved threads.
- Updated empty-state copy so reviewers understand whether the slide has no comments or the current filter has no matches.

## Delivered slice — advanced chart families

- Added Fabric-native Scatter, Bubble and Radar chart families to the Slides chart engine for engineering, quality and multi-axis operational reviews.
- Exposed the new chart types in the existing chart editor without adding new dependencies or duplicating chart insertion flows.
- Mapped the new families to editable native PowerPoint line-chart approximations during PPTX export so round-trip decks remain usable even when a direct equivalent is unavailable.

## Delivered slice — slide master presets

- Added reusable slide-master presets for executive, plant-floor and minimal corporate decks using the existing Fabric master pipeline.
- Presets include shared logo, header/footer furniture, date/slide-number placeholders and theme-aware colors/fonts.
- Master preset metadata is persisted with the deck-level master JSON so future layout governance can distinguish logo, footer and numbering furniture.

## Delivered slice — Presentation Workbench inspector

- Added a persistent right-side Workbench inspector that unifies deck health, object properties, metadata and quick access to layers/comments/animation panels.
- Object properties now expose label, type, object/comment anchor id, geometry, rotation, opacity, lock and hide actions directly from the workspace.
- Smart Objects now expose editable data-source fields in the inspector and persist a binding contract (`source`, `metric`, `params`, `lastUpdatedAt`) for manual/static/future-live AXOS refresh flows.
- Layout application now persists `layoutId` metadata on slide JSON so the inspector can show the active layout and future reset-to-layout flows have a stable hook.

## Delivered slice — live report entry points and PPTX review

- Added Office Hub quick-start cards for four industrial report decks: Daily Production Meeting, Quality Review, Executive Ops Review and Launch Readiness.
- Each entry point uses the existing editable deck generators with demo AXOS-shaped data, creating native Slides decks that can be edited, reviewed and exported.
- Expanded the Workbench inspector with a PPTX review section that lists top compatibility warnings directly inside the editor instead of only showing a warning count.

## Delivered slice — industrial layout placeholders

- Expanded Slide Master/Layout v2 with industrial layout presets for KPI dashboards, chart commentary, visual aids, timelines, risk matrices and action registers.
- Added typed placeholder roles for charts, images, KPIs, timelines, risk matrices, action registers, logos, dates, footers and slide numbers.
- Layout application now renders non-text placeholders as themed Fabric objects with persisted `ph` roles, giving authors visible drop zones while preserving existing editable slide JSON.

## Delivered slice — layout reset and placeholder materialization

- Added a reset-to-layout action so slides with `layoutId` metadata can be rebuilt from their assigned industrial layout.
- Added Workbench actions that convert typed placeholders into editable chart and AXOS Smart Object instances using existing builders.
- This closes the loop between Slide Master/Layout v2 and the object authoring toolchain: layouts now guide authors and can become real editable objects without duplicate canvas models.

## Delivered slice — presenter annotation tools

- Expanded presenter mode with a real highlighter tool, selectable pen colors and commands to clear ink for the current slide or the full session.
- Presenter ink now stores stroke metadata (color, width, opacity) instead of anonymous point arrays, allowing pen and highlighter annotations to coexist during live reviews.
- Keyboard flow now includes `H` for highlighter while retaining `L` laser, `P` pen and `E` erase, supporting plant-floor and executive presentation workflows.

## Delivered slice — presenter control room

- Upgraded Presenter Mode with top-level controls for searchable navigation, black screen and white screen so live presenters can recover or redirect without leaving the presenter workspace.
- Added a quick-jump slide keypad and a full searchable presenter navigator that filters by title or notes and resets animation reveal state when jumping.
- Added an in-view shortcut strip for critical presenter actions, reducing training friction for operators and executives using AXOS Slides in live meetings.

## Delivered slice — workbench status bar

- Added a persistent Slides status bar that keeps deck health visible while editing: current slide, object count, theme, aspect ratio, layout, selected object summary, zoom and PPTX warning count.
- Wired the status bar to real Workbench actions for comments, layers, animation pane and presenting from the current slide, reducing round trips through the ribbon.
- The status bar reuses existing inspector health and selection state instead of creating a parallel document model.

## Delivered slice — inspector appearance controls

- Extended the Workbench object inspector with real appearance controls for fill, stroke color and stroke width using the active Fabric object instead of a parallel model.
- The properties panel now covers geometry, visibility, metadata and core visual styling in one place, making object editing closer to PowerPoint/Figma workflows.
- These controls reuse existing editor mutation paths (`setColor`, outline color and outline width) so saves, autosync and export paths keep the same behavior as ribbon edits.

## Delivered slice — inspector shape effects

- Extended the object inspector appearance section with corner radius and shadow toggles so basic shape effects are editable outside the ribbon.
- Radius editing is safely scoped to Fabric rectangles while shadow toggling reuses the existing editor effect path for consistent save/export behavior.
- This moves AXOS Slides closer to a full object-properties workflow where geometry, style and effects are handled in one Workbench panel.

## Delivered slice — asset library preview workflow

- Upgraded the industrial asset library from a click-only picker into a searchable preview workflow with quick-search chips, selected symbol preview, keyword context and an explicit insert action.
- Asset cards now support selection plus double-click insertion, giving users a safer way to inspect manufacturing symbols before placing them on the slide.
- The feature keeps the existing `SlideAssetLibrary` insertion contract, so symbol metadata and Fabric insertion remain compatible with existing decks and exports.

## Delivered slice — deck-wide review mode

- Expanded the slide comments panel with a deck-wide scope toggle so reviewers can switch between the current slide and all presentation threads without leaving the editor.
- Added review metrics for current-slide threads, open items, assigned items and resolved items to make enterprise review status visible at a glance.
- Comment cards now show their slide number, making deck-wide review useful for executive and quality-review walkthroughs.

## Delivered slice — review-to-slide navigation

- Added a direct jump action from deck-wide comment cards to their source slide, turning review threads into navigation anchors during walkthroughs.
- The navigation action remains available in read-only review mode while resolve/delete actions stay gated by edit permissions.
- This closes the loop between deck-wide review visibility and slide authoring: reviewers can find a thread, jump to its slide and continue editing or presenting context immediately.

## Delivered slice — deck health diagnostics

- Expanded the Workbench inspector deck-health model with empty-slide, missing-title and Smart Object counts so authors can spot presentation quality issues while editing.
- The inspector now surfaces these diagnostics beside comments and PPTX warnings, turning the right rail into a lightweight readiness checklist.
- The diagnostics are computed from existing slide JSON and Fabric metadata, preserving compatibility with autosave, import and export flows.

## Delivered slice — presentation readiness score

- Added a deck readiness score that combines empty slides, missing titles, open review threads and PPTX compatibility warnings into a visible quality signal.
- Surfaced the score as a progress bar in the Workbench inspector and as a compact status indicator in the bottom status bar.
- This turns deck health from passive counts into an actionable readiness signal for executive, customer and launch-review presentations.

## Delivered slice — readiness action guidance

- Added actionable readiness guidance under the Workbench readiness score so authors see why a deck is not ready and what to fix next.
- Guidance is generated from existing diagnostics: empty slides, missing titles, open comments and PPTX warnings.
- This moves the inspector from passive health display toward an active presentation-quality coach for industrial review decks.

## Delivered slice — one-click title remediation

- Added a Workbench readiness action that inserts a proper title placeholder on the current slide when the deck health model detects a missing title.
- The remediation uses the active theme typography and existing Fabric/capture/sync paths, keeping autosave and export behavior consistent.
- This turns readiness guidance into a concrete one-click fix instead of only reporting a problem.

## Delivered slice — one-click empty-slide remediation

- Added a Workbench readiness action that applies the base title/content layout when the current slide is empty.
- The remediation reuses the existing layout engine, theme-aware placeholders and capture/sync flow instead of creating a separate slide builder.
- Empty-slide diagnostics can now be resolved directly from the inspector, improving readiness workflows for large imported or generated decks.

## Delivered slice — Smart Object binding editor

- Expanded the Workbench Smart Object Data section with editable binding source, metric key, refresh mode, unit and last snapshot visibility.
- Binding edits patch the existing SmartObject metadata (`source`, `binding`, `refreshMode`, `unit`) so generated AXOS visual objects remain editable without introducing a second data model.
- This moves Smart Objects closer to live AXOS report objects while preserving today’s manual/static/future-live contract.
