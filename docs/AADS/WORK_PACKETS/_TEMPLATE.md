# WP-XXX — <title>

- **Packet:** WP-XXX
- **Program:** <ROADMAP program>
- **Queue items:** CQ-xxx, CQ-yyy
- **Owns (writable):** `path/glob/**`, `path/glob/**`
- **Reads (read-only):** `path/glob/**`
- **Depends on:** <WP-xxx | none>
- **Concurrency:** safe alongside <WP-aaa, WP-bbb | any with disjoint Owns>
- **Status:** PENDING
- **Owner agent:** —

> Stay inside `Owns:`. To change anything under `Reads:`, open/depend on its
> owning packet instead. Inspect before create. Small, functional, green. Never
> merge red — `main` deploys to Railway.

## Scope

<1-3 sentences: what this packet delivers and why it is one coherent unit.>

## Items

### CQ-xxx — <title>
- **Objective:** <small, concrete>
- **Probable files:** `...` (must be inside Owns)
- **Acceptance criteria:** <checks>

## Checks

- `git diff --check`
- `npm run build` for affected app(s); relevant tests
- CI `Build · Test · Lint · Smoke` green before merge

## Definition of done

- [ ] All items merged via one (or few) small PRs.
- [ ] Only `Owns:` files modified.
- [ ] No duplication; existing modules/screens extended.
- [ ] Packet status → DONE; logged in `../STATUS/DONE.md`.
