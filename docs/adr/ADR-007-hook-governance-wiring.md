# ADR-007: Wire Governance Helpers into the Hook System

**Status:** Proposed  
**Date:** 2026-03-31  
**Deciders:** Mario Jauvin  
**Supersedes:** —  
**Superseded by:** —

---

## Context

The `.claude/helpers/` directory contains two fully functional governance workers:

- `adr-compliance.sh` — checks ten ADRs, produces a JSON compliance report, throttled to 15-minute intervals.
- `ddd-tracker.sh` — counts DDD artefacts (entities, aggregates, repositories, etc.), throttled to 10-minute intervals.

Both scripts are well-structured and capable of producing quantitative metrics. However, neither is wired into the Claude Code hook table in `.claude/settings.json`. They can only be invoked manually or via a separate daemon process.

The current `PostToolUse[Write|Edit|MultiEdit]` hook calls `post-edit` via `hook-handler.cjs`, which records edit metadata and feeds intelligence feedback — but does not invoke the governance helpers.

---

## Decision (Proposed)

Add `adr-compliance.sh check` and `ddd-tracker.sh check` invocations to the `post-edit` hook handler in `hook-handler.cjs`. Specifically:

1. After every write/edit event, call `adr-compliance.sh check` (which self-throttles to 15 minutes — no performance impact on rapid edits).
2. After every write/edit event, call `ddd-tracker.sh check` (self-throttles to 10 minutes).
3. Both calls must be fire-and-forget (non-blocking, exit 0 regardless of result — consistent with ADR-003).

This closes the gap identified in `docs/research/governance.md` Recommendation R1: "Wire governance helpers into the hook system."

---

## Consequences

**Positive:**
- Governance compliance metrics are automatically updated as code changes, without requiring manual invocation.
- The `adr-compliance.json` and DDD progress files stay current throughout a development session.
- The metrics feed into statusline display and intelligence feedback loops.

**Negative:**
- Two shell script invocations are added to every edit event. Even with throttling, there is a small overhead on the first edit after each throttle window.
- The governance scripts currently target a `v3/` tree that does not exist in this repo (see ADR-001). Until the scripts are updated to check this repo's actual structure, they will continue to produce low compliance scores.

**Risks:**
- If `bash` is not available (e.g. in a minimal container), the `spawnSync('bash', [...])` call in `hook-handler.cjs` will fail. The exit-0 guarantee (ADR-003) must be maintained even in this case.

---

## Prerequisites

- ADR-001 must be accepted (documenting that the governance tools target downstream projects, not this repo), so low scores do not cause confusion.
- The domain taxonomy discrepancy between `adr-compliance.sh`, `ddd-tracker.sh`, and `validate-v3-config.sh` should be reconciled (see `docs/ddd/domain-taxonomy.md` and Recommendation R3 in `docs/research/governance.md`).

---

## Alternatives Considered

### Separate daemon worker
The `daemon-manager.sh` and `worker-manager.sh` helpers support a daemon-based invocation model. However, this requires the daemon to be running — not guaranteed in all environments. Hook-based invocation is more reliable.

### Manual invocation only
Current state. Insufficient: developers do not run governance checks manually in practice.

### CI-only governance checks
Valuable as an additional layer but does not provide the real-time feedback loop that hook-based invocation enables.

---

## Related

- `.claude/helpers/adr-compliance.sh` — ADR compliance worker
- `.claude/helpers/ddd-tracker.sh` — DDD tracking worker
- `.claude/helpers/hook-handler.cjs` — `post-edit` handler (the integration point)
- `.claude/settings.json` — `PostToolUse[Write|Edit|MultiEdit]` hook entry
- `docs/adr/ADR-003-advisory-only-hooks.md` — exit-0 constraint
- `docs/plan/implementation-plan.md` Sprint 1
