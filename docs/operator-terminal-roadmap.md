# Operator Terminal — Shop Floor Experience Roadmap

## Session slice — Programa 03 / Fases 1-3

This slice starts the AXOS MES operator terminal redesign on the connected `plans → mes-execution → /dashboard/operador` flow. It intentionally avoids creating new backend modules and reuses the existing `/mes/executions`, `/mes/board`, confirmation, incident, and andon endpoints.

### Delivered

- Industrial fixed top bar for the operator terminal with operator, shift, line, station, WO, model, machine state, quality state, connectivity, alerts, and live clock.
- Touch-first / glove-friendly controls with larger scan, order, station, and action targets.
- Dark industrial and light industrial toggles local to the terminal.
- Offline/connectivity visibility: the terminal now labels connected state as `Online` and degraded socket state as `Offline / cola local` so future offline queue work has a stable UI slot.
- Real-time production KPI panel for target, actual, remaining, takt placeholder, UPH placeholder, OEE proxy, yield, scrap, rework, downtime, and WIP using the current `/mes/board` payload.

### Next slices

1. Fase 4 — Scanner hardening: keyboard-wedge buffering, symbology hints, validation states, sound/haptic hooks, and scan history.
2. Fase 5 — Embedded work instructions: keep PDF/Office/video/image/CAD aids inside the station panel instead of opening a new screen.
3. Fase 6 — Quality side panel: richer defect capture, photos, signature, evidence, and quick NCR path.
4. Fase 7 — Andon expansion: supervisor, quality, materialist, maintenance, engineering, tooling response timers.
5. Fase 12 — Offline queue: local pending actions, retries, cache freshness, and sync conflict messaging without adding backend unless required.
