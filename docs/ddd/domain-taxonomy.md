# Domain Taxonomy — Canonical Reference

**Version:** 1.0  
**Date:** 2026-03-31  
**Purpose:** Single authoritative domain list to eliminate discrepancies between governance scripts

---

## Problem

Three governance scripts in `.claude/helpers/` each declare a domain list, and they disagree:

| Script | Domain names declared |
|--------|-----------------------|
| `ddd-tracker.sh` | `agent-lifecycle`, `task-execution`, `memory-management`, `coordination`, `shared-kernel` |
| `validate-v3-config.sh` | `task-management`, `session-management`, `health-monitoring`, `lifecycle-management`, `event-coordination` |
| `adr-compliance.sh` ADR-002 | checks for `src/domains/` directory only (no names) |

This discrepancy causes:
- `validate-v3-config.sh` to look for directories that `ddd-tracker.sh` would never create
- Inconsistent reporting when both scripts are run
- Confusion for contributors trying to understand the intended architecture

---

## Canonical Domain List

The following is the single authoritative taxonomy. All governance scripts must reference this list.

```
agent-lifecycle
task-execution
session-management
memory-management
coordination
```

### Rationale for each name

| Canonical name | Replaces | Reason |
|----------------|----------|--------|
| `agent-lifecycle` | `lifecycle-management` | More specific: it is agent lifecycle, not generic lifecycle |
| `task-execution` | `task-management` | Execution is the active domain concept; management is too generic |
| `session-management` | _(new, from validate-v3-config.sh)_ | Session is a first-class concept in Claude Code context |
| `memory-management` | _(retained from ddd-tracker.sh)_ | Accurate and specific |
| `coordination` | `event-coordination` | Coordination is the broader concept; events are a mechanism, not the domain |

### Dropped names

| Dropped | Reason |
|---------|--------|
| `shared-kernel` | Not a bounded context — it is a cross-context pattern. Document as Shared Kernel in the bounded context map. |
| `health-monitoring` | A cross-cutting concern within Agent Lifecycle, not a standalone context |

---

## Required Script Updates

The following scripts must be updated to reference the canonical list:

### `ddd-tracker.sh`
```bash
# Change:
DOMAINS=("agent-lifecycle" "task-execution" "memory-management" "coordination" "shared-kernel")
# To:
DOMAINS=("agent-lifecycle" "task-execution" "session-management" "memory-management" "coordination")
```

### `validate-v3-config.sh`
Update the expected `src/domains/` subdirectory list to match the canonical names.

---

## Directory Structure Implication

When a downstream consumer project implements these bounded contexts, the directory structure should follow:

```
src/
  domains/
    agent-lifecycle/
      AgentAggregate.ts
      AgentPool.ts
      events/
    task-execution/
      TaskAggregate.ts
      Workflow.ts
      events/
    session-management/
      SessionAggregate.ts
      Checkpoint.ts
      events/
    memory-management/
      MemoryEntry.ts
      MemoryNamespace.ts
      events/
    coordination/
      SwarmAggregate.ts
      CoordinationNode.ts
      events/
    shared-kernel/
      AgentId.ts
      TaskId.ts
      DomainEvent.ts
```

---

## Related

- `docs/ddd/bounded-context-map.md` — full context descriptions, relationships, ubiquitous language
- `.claude/helpers/ddd-tracker.sh` — needs update (see above)
- `.claude/helpers/validate-v3-config.sh` — needs update (see above)
- `docs/plan/implementation-plan.md` Sprint 1, Task 1.3
