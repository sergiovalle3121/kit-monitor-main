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
