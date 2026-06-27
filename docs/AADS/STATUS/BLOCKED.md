# BLOCKED — items that can't proceed

When a queue item or PR can't move forward, mark it `BLOCKED`, record it here, and
**take the next item** — never stall the queue and never force a red merge to
"unblock".

**Format**

```
- <CQ-ID> · <PROGRAM> · <title>
  - Blocked since: <DATE>
  - Reason: <what is blocking>
  - Needs: <decision / dependency / fix required>
  - Owner: <ChatGPT (architecture) | Codex (rebuild) | Claude (fix) | User>
```

**Common block reasons**
- CI red for a cause outside the PR's scope (flaky infra / unrelated breakage).
- Needs an architecture decision (ChatGPT or the user).
- Depends on another unmerged PR.
- Would require a large refactor to do correctly and safely.

---

## Active blocks

_None. No items are currently blocked._

<!--
Example:
- CQ-018 · PLATFORM · Event Ledger query API
  - Blocked since: 2026-07-02
  - Reason: pagination contract undecided
  - Needs: API-standards decision on cursor vs offset pagination
  - Owner: ChatGPT
-->
