# TECH DEBT — known shortcuts to repay

Deliberate compromises accepted to ship a small green PR, plus structural issues
spotted during review that are out of scope to fix now. The goal is **visibility**:
nothing rots silently. The Architect (ChatGPT) periodically promotes high-value
debt back into a program backlog as a real PR.

**Format**

```
- <TD-ID> · <PROGRAM/area> · <short title>
  - Introduced: <DATE> (via <CQ-ID>/PR #<n>, or "pre-AADS")
  - What: <the shortcut / smell>
  - Why: <why it was accepted>
  - Risk: <low | medium | high> — <impact>
  - Repay: <what a proper fix looks like>
```

**What belongs here**
- "Good enough for now" implementations (e.g. in-memory where a table is wanted).
- Missing tests accepted to ship under time pressure.
- Duplication that couldn't be safely de-duped in the same small PR.
- Performance shortcuts (no index yet, N+1 left in place).
- Anything that violates a house rule but was consciously accepted.

**What does NOT belong here**
- Tenant-isolation gaps, auth bypasses, or red CI — those **block**, they are not debt.

---

## Open debt

_None recorded yet._

<!--
Example:
- TD-001 · OFFICE · Doc version snapshots stored as full copies
  - Introduced: 2026-07-03 (via CQ-012/PR #130)
  - What: each snapshot stores the whole document, not a diff
  - Why: kept the PR small; diffing needs its own design
  - Risk: medium — storage growth on large docs
  - Repay: delta-based snapshots + retention policy
-->
