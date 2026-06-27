# WORK PACKETS — parallel-safe execution for AADS

> AADS v2. Solves a specific problem: when several Codex agents run **in parallel**,
> they all want to edit the single [`../QUEUES/CODEX_QUEUE.md`](../QUEUES/CODEX_QUEUE.md)
> and often the same source files — producing merge conflicts and duplicated work.

A **Work Packet** is the unit of parallel work. One packet = one Codex agent = one
PR = its **own file** in this folder. Two packets that run at the same time **never
write the same files**, so their PRs never conflict and the queue never has a merge
race.

The linear `CODEX_QUEUE.md` stays as the *human-readable backlog*. Work Packets are
the *concurrency layer* on top of it.

---

## 1. Why packets (the conflict problem)

Launching N Codex tasks against the flat queue fails in two ways:

1. **Queue contention.** Every agent edits `CODEX_QUEUE.md` to flip a status →
   they collide on the same lines.
2. **Code contention.** Two agents independently touch
   `apps/api/src/modules/event-ledger` or `auth` → their PRs conflict at merge.

Packets remove both by making **file ownership explicit and disjoint**:

- Each packet owns its **own status file** (this folder) → no queue collisions.
- Each packet declares an **`Owns:` path set** it is allowed to modify → the
  scheduler only runs packets *concurrently* when their `Owns:` sets are disjoint.

---

## 2. Anatomy of a packet

Each packet is a single Markdown file `WP-XXX-<slug>.md` with this front matter:

| Field | Meaning |
|-------|---------|
| **Packet** | `WP-001` — stable id |
| **Title** | short name |
| **Program** | which roadmap program it serves |
| **Queue items** | the `CQ-xxx` items it bundles |
| **Owns (writable)** | glob paths this packet's PR MAY modify — its lock |
| **Reads (read-only)** | paths it may read but MUST NOT modify |
| **Depends on** | packets that must merge first (e.g. shared primitives) |
| **Concurrency** | which packets it is safe to run alongside |
| **Status** | `PENDING` → `IN PROGRESS` → `IN REVIEW` → `DONE` / `BLOCKED` |
| **Owner agent** | the Codex run currently holding it (or `—`) |

The body lists the bundled items, the acceptance criteria, and the checks.

See [`_TEMPLATE.md`](_TEMPLATE.md).

---

## 3. The disjoint-ownership rule (the core invariant)

> **Two packets may run in parallel iff their `Owns:` sets do not overlap.**

- A packet may only modify files inside its `Owns:` globs. Anything else is
  `Reads:` (read-only).
- Cross-cutting needs (audit to Event Ledger, RBAC checks) are satisfied by
  **reading** shared primitives, never editing them inside a feature packet. If a
  shared primitive must change, that change is its **own** platform packet that
  others `Depends on`.
- The scheduler (ChatGPT) computes overlaps before launching a wave. Overlapping
  packets are **serialized**, not parallelized.

This turns "avoid conflicts" from a hope into a checkable property: disjoint
`Owns:` ⇒ conflict-free parallel merge.

---

## 4. Lifecycle

```text
ChatGPT (Architect)
  └─ groups CQ items into packets with disjoint Owns: sets
        │
        ▼
  selects a WAVE of packets whose Owns: sets don't overlap
        │  (respecting Depends on)
        ▼
  Codex agent A ──► WP-002 (owns lib/cad + line-engineering)  ─┐
  Codex agent B ──► WP-003 (owns modules/office)              ─┤ run in parallel
  Codex agent C ──► WP-005 (owns .github/workflows)           ─┘
        │ each: inspect → build small PR → flip its OWN packet file status
        ▼
  Claude (Integrator) reviews each PR; squash-merge when green
        │
        ▼
  packet → DONE; next wave selected
```

Each agent only ever writes **its own packet file** for status — so even status
updates don't collide.

---

## 5. Rules (inherited + packet-specific)

- All the AADS critical rules still apply: inspect before create, no duplicate
  modules, no parallel screens, small/functional/green, never merge red to Railway.
- **Stay inside your `Owns:` set.** Touching another packet's files is a review
  rejection, even if the code is correct.
- **Need a shared primitive changed?** Don't — open/΅depend on a platform packet.
- **Blocked?** Flip your packet to `BLOCKED`, note it in
  [`../STATUS/BLOCKED.md`](../STATUS/BLOCKED.md), free the packet, take the next.
- A packet's status lives in its own file; `DONE` packets are also logged in
  [`../STATUS/DONE.md`](../STATUS/DONE.md).

---

## 6. Initial packets (derived from the 20-item CODEX_QUEUE)

The bootstrap queue is regrouped into 6 packets with disjoint ownership:

| Packet | Program | Owns (writable) | Items |
|--------|---------|-----------------|-------|
| [WP-001](WP-001-mes-operator.md) | MES | `apps/**/operator-terminal`, `dashboard/operador`, `defect-codes`, `material-requests` | CQ-001…005 |
| [WP-002](WP-002-cad-canvas.md) | CAD | `apps/web/**/lib/cad`, `components/line-engineering`, `dashboard/line-engineering`, api `line-engineering` | CQ-006…010 |
| [WP-003](WP-003-office-suite.md) | OFFICE | `apps/api/**/office`, `dashboard/office`, `components/office` | CQ-011…013, 015* |
| [WP-004](WP-004-platform-foundation.md) | PLATFORM | `apps/api/**/{auth,users,event-ledger}`, `packages/contracts` | CQ-016…019 |
| [WP-005](WP-005-ci-quality.md) | PLATFORM/CI | `.github/workflows` | CQ-020 |
| [WP-006](WP-006-search-integration.md) | OFFICE/PLATFORM | `components/{SearchPalette.tsx,searchSources.ts}` | CQ-013-search, CQ-014 |

\* Cross-cutting items that *read* `event-ledger`/`auth` (CQ-014 share-dialog,
CQ-015 audit) **depend on** WP-004 and only modify their own program's files.

**Concurrency map (a safe first wave):** WP-004 lands first (shared primitives).
Then WP-001, WP-002, WP-003, WP-005 run **fully in parallel** (disjoint `Owns:`).
WP-006 runs after WP-003/WP-004 (reads office + auth, owns only the search files).

---

## 7. Directory

```text
docs/AADS/WORK_PACKETS/
  README.md                      ← you are here
  _TEMPLATE.md                   ← copy to create a new packet
  WP-001-mes-operator.md
  WP-002-cad-canvas.md
  WP-003-office-suite.md
  WP-004-platform-foundation.md
  WP-005-ci-quality.md
  WP-006-search-integration.md
```
