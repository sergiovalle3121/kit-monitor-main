# WP-005 — CI / Quality

- **Packet:** WP-005
- **Program:** PLATFORM / CI
- **Queue items:** CQ-020
- **Owns (writable):** `.github/workflows/**`
- **Reads (read-only):** `package.json`, `turbo.json`, `infra/**`
- **Depends on:** none
- **Concurrency:** safe alongside every feature packet (disjoint Owns — only touches CI config)
- **Status:** PENDING
- **Owner agent:** —

> Owns only CI config, so it never conflicts with code packets. **Must not change
> the Railway deploy path** — caching/speed only. Verify the full
> `Build · Test · Lint · Smoke` stays green end-to-end. Never merge red.

## Scope

Speed up the CI gate without altering what it verifies or how `main` deploys to
Railway.

## Items

### CQ-020 — Cache build in CI
- **Objective:** Add dependency/build caching to `Build · Test · Lint · Smoke`.
- **Probable files:** `.github/workflows/*`
- **Acceptance criteria:** Cache hit on unchanged deps; CI green; deploy path untouched.

## Checks
- `git diff --check`; CI run green end-to-end on the PR.

## Definition of done
- [ ] Merged via small PR; only `.github/workflows` modified.
- [ ] Deploy/Railway path unchanged; gate semantics unchanged.
- [ ] Status → DONE; logged in `../STATUS/DONE.md`.
