# Bounded Context Map — Ruflo Ecosystem

**Version:** 1.0  
**Date:** 2026-03-31  
**Scope:** The Ruflo + Claude Flow V3 ecosystem as installed and configured by `ruflo-setup`

---

## Overview

This document describes the bounded contexts in the **downstream ecosystem** that `ruflo-setup` bootstraps. It does not describe bounded contexts within `ruflo-setup` itself (see `docs/adr/ADR-001-procedural-cli-architecture.md` — the tool is intentionally procedural, not DDD-structured).

The map reflects the domain model declared by the governance helpers (`.claude/helpers/ddd-tracker.sh`, `.claude/helpers/validate-v3-config.sh`) and the ADR compliance script, reconciled into a single authoritative taxonomy.

---

## Authoritative Domain Taxonomy

The following five bounded contexts are the canonical domains for downstream `ruflo`/`claude-flow` consumer projects:

| # | Bounded Context | Responsibility |
|---|----------------|----------------|
| 1 | **Agent Lifecycle** | Spawning, monitoring, terminating, and health-checking AI agents |
| 2 | **Task Execution** | Creating, assigning, tracking, and completing tasks across agents |
| 3 | **Session Management** | Saving, restoring, and expiring development sessions and their state |
| 4 | **Memory Management** | Storing, indexing, retrieving, and consolidating cross-session memory |
| 5 | **Coordination** | Swarm topology, consensus, load balancing, and inter-agent communication |

> **Note on taxonomy discrepancy:** `ddd-tracker.sh` declares `agent-lifecycle`, `task-execution`, `memory-management`, `coordination`, and `shared-kernel`. `validate-v3-config.sh` uses `task-management`, `session-management`, `health-monitoring`, `lifecycle-management`, and `event-coordination`. The table above is the reconciled canonical list. The governance scripts should be updated to reference this list (see `docs/adr/ADR-007-hook-governance-wiring.md` prerequisites).

---

## Context Relationships

```
┌─────────────────────────────────────────────────────┐
│                  Coordination                        │
│  (swarm topology, consensus, load balancing)         │
│                                                     │
│   orchestrates ──────────────────────────────┐      │
└─────────────────────────────────────────────┼──────┘
                                               │
        ┌──────────────────┐    ┌──────────────▼──────────┐
        │  Agent Lifecycle │◄───│    Task Execution        │
        │  (spawn/health)  │    │  (create/assign/track)   │
        └────────┬─────────┘    └──────────────┬──────────┘
                 │                             │
                 │ writes to                   │ reads from
                 ▼                             ▼
        ┌─────────────────────────────────────────────┐
        │            Memory Management                │
        │  (HNSW index, AgentDB, cross-session store) │
        └─────────────────────────────────────────────┘
                             │
                             │ persists to
                             ▼
        ┌─────────────────────────────────────────────┐
        │           Session Management                │
        │  (save/restore/expire session state)        │
        └─────────────────────────────────────────────┘
```

### Relationship types

| From | To | Relationship |
|------|-----|-------------|
| Coordination | Agent Lifecycle | **Orchestrates** — Coordination context directs agent spawning/termination |
| Coordination | Task Execution | **Orchestrates** — Coordination assigns tasks to agents |
| Agent Lifecycle | Memory Management | **Customer/Supplier** — Agents write observations to memory |
| Task Execution | Memory Management | **Customer/Supplier** — Tasks read context from memory |
| Memory Management | Session Management | **Conformist** — Memory persistence follows session lifecycle |

---

## Shared Kernel

A **Shared Kernel** exists for cross-cutting types used by multiple contexts:

- Agent identity (`AgentId`, `AgentType`)
- Task identity (`TaskId`, `TaskStatus`)
- Event envelope (`DomainEvent<T>`)
- Error types (`RufloError`, `TimeoutError`)

Changes to the shared kernel require coordination across all contexts that depend on it.

---

## Context: Agent Lifecycle

**Ubiquitous language:**
- **Agent** — an AI process instance with a defined role (coder, tester, reviewer, etc.)
- **Agent Pool** — a managed collection of agents available for task assignment
- **Health Check** — a periodic probe confirming an agent is responsive
- **Spawn** — creating and initialising a new agent instance
- **Terminate** — gracefully stopping an agent and releasing its resources

**Key aggregates:**
- `Agent` (root) — identity, type, status, health
- `AgentPool` — collection of active agents, lifecycle management

**Domain events:**
- `AgentSpawned`, `AgentTerminated`, `AgentHealthChanged`, `AgentPoolResized`

---

## Context: Task Execution

**Ubiquitous language:**
- **Task** — a unit of work assigned to one or more agents
- **Assignment** — the binding of a task to a specific agent
- **Completion** — a task reaching a terminal state (done, failed, cancelled)
- **Orchestration** — the coordination of multiple tasks into a workflow

**Key aggregates:**
- `Task` (root) — description, status, priority, assigned agent
- `Workflow` — ordered set of tasks with dependency edges

**Domain events:**
- `TaskCreated`, `TaskAssigned`, `TaskCompleted`, `TaskFailed`, `WorkflowStarted`

---

## Context: Session Management

**Ubiquitous language:**
- **Session** — a bounded period of development activity with saved state
- **Restore** — loading a previously saved session into the active context
- **Checkpoint** — a point-in-time snapshot of session state
- **Expiry** — automatic cleanup of stale sessions past a retention window

**Key aggregates:**
- `Session` (root) — id, created, last-active, state snapshot
- `Checkpoint` — timestamped snapshot, associated session

**Domain events:**
- `SessionStarted`, `SessionSaved`, `SessionRestored`, `SessionExpired`

---

## Context: Memory Management

**Ubiquitous language:**
- **Memory Entry** — a named, typed, optionally tagged piece of stored knowledge
- **Namespace** — a logical partition of the memory store
- **HNSW Index** — Hierarchical Navigable Small World graph for approximate nearest-neighbour semantic search
- **Consolidation** — merging and deduplicating related memory entries

**Key aggregates:**
- `MemoryEntry` (root) — key, value, namespace, tags, TTL, embedding vector
- `MemoryNamespace` — collection of entries, HNSW index state

**Domain events:**
- `MemoryStored`, `MemoryRetrieved`, `MemoryConsolidated`, `MemoryExpired`

---

## Context: Coordination

**Ubiquitous language:**
- **Swarm** — a coordinated group of agents working toward a shared goal
- **Topology** — the communication and authority structure of a swarm (hierarchical, mesh, adaptive)
- **Consensus** — agreement among agents on a shared decision (Raft for hive-mind)
- **Load Balance** — distributing work across agents to prevent bottlenecks

**Key aggregates:**
- `Swarm` (root) — topology, member agents, consensus state
- `CoordinationNode` — a single agent's view of the swarm

**Domain events:**
- `SwarmInitialised`, `TopologyChanged`, `ConsensusReached`, `LoadRebalanced`

---

## Anti-Corruption Layers

When the Coordination context invokes external infrastructure (Claude Code MCP servers, shell processes, file system), an **Anti-Corruption Layer** translates between the external model and the domain model:

- `McpAdapter` — translates MCP tool call results to domain events
- `ShellAdapter` — wraps `spawnSync` calls; maps exit codes to domain errors
- `FileSystemAdapter` — wraps Node.js `fs` calls; maps I/O errors to domain errors

---

## References

- Evans, E. (2003). *Domain-Driven Design*, Chapter 14: Maintaining Model Integrity.
- Vernon, V. (2013). *Implementing Domain-Driven Design*, Chapter 3: Context Maps.
- `.claude/helpers/ddd-tracker.sh` — automated DDD artefact tracking
- `docs/adr/ADR-001-procedural-cli-architecture.md` — why DDD is not applied to ruflo-setup itself
