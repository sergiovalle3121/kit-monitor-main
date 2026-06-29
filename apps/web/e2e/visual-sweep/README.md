# Visual + navigation sweep

Systematic look-&-feel sweep over every static app route, in two viewports
(desktop 1440 / mobile 390) and both themes (light / dark). For each combination
it screenshots the route and runs DOM detectors + axe-core, then writes
`e2e/__visual__/visual-findings.json` (sorted by severity) plus screenshots under
`e2e/__visual__/screenshots/<viewport>-<theme>/`.

It is **opt-in** (only defines tests when `SWEEP=1`) so the golden suite stays
fast, and **hermetic** (reuses the golden fixtures: forged owner session +
in-memory mock backend — no live API/DB).

## Run

Fastest is against a production build (every route is compiled once):

```bash
# 1) build with the client pointed at the intercepted mock origin
NEXT_PUBLIC_API_URL=http://localhost:4010 npm run build

# 2) start it on :3000 with the e2e cookie secret (Playwright reuses this server)
NEXT_PUBLIC_API_URL=http://localhost:4010 AXOS_SESSION_SECRET=axos-e2e-session-secret \
  PORT=3000 npm run start &

# 3) run the sweep
SWEEP=1 npx playwright test visual-sweep.spec.ts
```

Against the dev server, just run step 3 — Playwright's `webServer` boots `next dev`.

## Knobs (env)

| Var | Effect |
| --- | --- |
| `SWEEP=1` | required — enables the sweep tests |
| `SWEEP_LIMIT=N` | only the first N routes (smoke run) |
| `SWEEP_ROUTES=/a,/b` | only these routes |
| `SWEEP_VIEWPORTS=desktop` | restrict viewports (`desktop`,`mobile`) |
| `SWEEP_THEMES=dark` | restrict themes (`light`,`dark`) |
| `AXE=0` | skip axe-core (DOM detectors only) |

## Detectors

- `horizontal-overflow` — page wider than the viewport (+ the offending element)
- `offscreen-exit-control` — a close/exit/back control clipped or off-viewport (trap)
- `translucent-overlay` — a floating menu/popover/dialog whose own background reads through
- `invisible-text` / `near-invisible-text` / `low-contrast-text` — WCAG contrast vs effective bg
- `axe:*` — axe-core violations (color-contrast, names/labels, duplicate ids…)
- `navigation-error` — the route threw while loading

Dynamic detail routes (`[id]`/`[code]`/`[key]`) are skipped by discovery (they
need fixture ids); the static set is the bulk of the look-&-feel surface.
