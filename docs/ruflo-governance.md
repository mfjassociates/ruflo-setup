# Ruflo — Development Capabilities & ADR/DDD Governance

**Date:** 2026-03-31  
**Source:** Q&A session on ruflo-setup architecture and governance

---

## What Is Ruflo?

`@mfjjs/ruflo-setup` is a cross-platform Node.js CLI that bootstraps projects with **RuFlow** — a structured AI-assisted development framework built on top of Claude Code.

### What it sets up

- `.claude/` folder scaffolding (CLAUDE.md, hooks, commands, settings)
- `.mcp.json` with MCP server wiring (platform-aware, gitignored)
- Global `SessionStart` hook for Claude Code
- 60+ specialized agents across dev, security, swarm coordination, and GitHub workflows

---

## Development Capabilities

### Agents (80+)

Agents are the primary execution unit. They are spawned by Claude Code's Task tool and cover:

| Category | Examples |
|----------|---------|
| Core development | `coder`, `reviewer`, `tester`, `planner`, `researcher` |
| Specialized | `security-architect`, `security-auditor`, `memory-specialist`, `performance-engineer` |
| Swarm coordination | `hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator` |
| GitHub & repository | `pr-manager`, `code-review-swarm`, `issue-tracker`, `release-manager` |
| SPARC methodology | `sparc-coord`, `sparc-coder`, `specification`, `pseudocode`, `architecture` |

### Skills & Commands

- **33 skills** and **65 slash commands** callable directly from Claude Code chat
- Examples: `/ruflo-setup`, `/commit`, `/review-pr`, `/sparc`, `/swarm-orchestration`

### Swarm Orchestration

- Hierarchical, mesh, and adaptive topologies
- Up to 15 agents per swarm
- **Raft consensus** for hive-mind coordination (leader maintains authoritative state)
- Byzantine fault-tolerant consensus via the `byzantine-coordinator` agent
- Frequent checkpoints via `post-task` hooks

```bash
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 8 --strategy specialized
```

### TDD London School (Mock-First)

Ruflo enforces the **London School of Test-Driven Development** (also called mockist TDD) as the preferred testing methodology for new code, as declared in `CLAUDE.md`:

> "Prefer TDD London School (mock-first) for new code"

**What this means in practice:**

- Tests are written *before* the implementation, driving the design from the outside in.
- Collaborators (dependencies) are replaced with mocks/stubs at the boundary of the unit under test — you test the interaction, not the internals of dependencies.
- The approach scaffolds architecture as you build: each unit's interface emerges from how it is consumed by its callers, keeping modules small and decoupled.
- This is distinct from the **Detroit/Chicago School** (classicist TDD), which prefers real objects and tests state rather than interactions.

**In the ruflo ecosystem:**

- The `tdd-london-swarm` agent is the dedicated specialist for mock-driven development within swarm coordination.
- The `tester` agent generates tests; the `tdd-london-swarm` agent enforces the mock-first discipline specifically.
- For `ruflo-setup` itself, dependency injection (e.g. passing `spawnSync` as a parameter rather than importing it directly) is the preferred technique for making units testable without a full test framework. See `docs/plan/implementation-plan.md` Sprint 3, Task 3.2.

### 3-Tier Model Routing

Every task is routed through a cost/latency hierarchy before an agent is spawned:

| Tier | Handler | Latency | Cost | When used |
|------|---------|---------|------|-----------|
| 1 | Agent Booster (WASM) | < 1 ms | $0 | Simple transforms — skip LLM entirely |
| 2 | Haiku | ~ 500 ms | Low | Low-complexity tasks (< 30% score) |
| 3 | Sonnet / Opus | 2–5 s | High | Complex reasoning, architecture, security |

Before spawning any agent, check for `[AGENT_BOOSTER_AVAILABLE]` or `[TASK_MODEL_RECOMMENDATION]` signals in hook output.

### Memory (AgentDB)

- HNSW-indexed vector store for approximate nearest-neighbour semantic search
- Cross-session persistence
- Namespaced storage with TTL and tags
- Consolidation and pattern deduplication

```bash
npx @claude-flow/cli@latest memory store --key "auth-pattern" --value "JWT with refresh" --namespace patterns
npx @claude-flow/cli@latest memory search --query "authentication patterns"
```

### Neural / WASM Acceleration

- WASM SIMD for performance-critical paths (2.49×–7.47× speedup cited in performance-engineer agent)
- Flash Attention optimization
- Token usage optimization (50–75% reduction targets)

---

## ADR Governance

### What ADRs are

Architecture Decision Records (Nygard, 2011) are short documents capturing architecturally significant decisions — the context, the decision made, and its consequences. They survive personnel changes and prevent re-litigating settled decisions.

### ADRs in the ruflo ecosystem

The `.claude/helpers/adr-compliance.sh` script tracks ten ADRs targeting downstream `ruflo`/`claude-flow` consumer projects:

| ID | Title |
|----|-------|
| ADR-001 | agentic-flow as core foundation |
| ADR-002 | Domain-Driven Design structure |
| ADR-003 | Single coordination engine |
| ADR-004 | Plugin-based architecture |
| ADR-005 | MCP-first API design |
| ADR-006 | Unified memory service |
| ADR-007 | Event sourcing for state |
| ADR-008 | Vitest over Jest |
| ADR-009 | Hybrid memory backend |
| ADR-010 | Remove Deno support |

**ADR-026** (also documented as **ADR-006** in `docs/adr/`) covers the 3-tier model routing policy declared in `CLAUDE.md`.

### ADRs specific to ruflo-setup itself

Seven ADRs were created in `docs/adr/` to document decisions within this repository:

| File | Decision |
|------|---------|
| `ADR-001-procedural-cli-architecture.md` | ruflo-setup is intentionally procedural, not DDD-structured |
| `ADR-002-esm-cjs-interoperability.md` | Hook files use `.cjs`; source uses ESM (`"type": "module"`) |
| `ADR-003-advisory-only-hooks.md` | All hooks exit 0 — advisory only, never blocking |
| `ADR-004-native-test-runner.md` | `node:test` over Vitest (no dev dependencies) |
| `ADR-005-platform-aware-mcp-config.md` | `.mcp.json` generated per-platform and gitignored |
| `ADR-006-three-tier-model-routing.md` | 3-tier routing policy; current partial implementation |
| `ADR-007-hook-governance-wiring.md` | *Proposed* — wire governance helpers into post-edit hook |

### The `adr-compliance.sh` helper

- Checks ten ADRs, produces a JSON report at `.claude-flow/metrics/adr-compliance.json`
- Throttled to once per 15 minutes
- Supports `run`, `check`, `force`, `status`, `details` subcommands
- **Currently not wired into the hook system** — must be invoked manually or via daemon

---

## DDD Governance

### What DDD provides

Domain-Driven Design (Evans, 2003; Vernon, 2013) structures software around the business domain: bounded contexts isolate models, aggregates enforce consistency boundaries, and ubiquitous language keeps code and domain expert conversations aligned.

### Bounded contexts in the ruflo ecosystem

Five canonical bounded contexts govern downstream consumer projects:

| Context | Responsibility |
|---------|---------------|
| **Agent Lifecycle** | Spawning, monitoring, terminating, health-checking agents |
| **Task Execution** | Creating, assigning, tracking, completing tasks |
| **Session Management** | Saving, restoring, expiring development sessions |
| **Memory Management** | Storing, indexing, retrieving, consolidating memory |
| **Coordination** | Swarm topology, consensus, load balancing, inter-agent comms |

Full context descriptions, relationship diagrams, ubiquitous language, aggregates, and domain events are in `docs/ddd/bounded-context-map.md`.

### The `ddd-tracker.sh` helper

- Counts DDD artefacts (entities, aggregates, value objects, repositories, services, domain events) via `grep` across TypeScript files
- Produces a JSON progress report
- Throttled to once per 10 minutes
- Supports `run`, `check`, `force`, `status` subcommands
- **Currently not wired into the hook system**

### Important scope note

The DDD governance tooling targets **downstream consumer projects** that ruflo-setup installs into — not ruflo-setup itself. ruflo-setup is a procedural CLI bootstrapper with no domain model of its own. A near-zero DDD compliance score from `ddd-tracker.sh` run against this repository is expected and correct. See `docs/adr/ADR-001-procedural-cli-architecture.md`.

---

## Governance Evaluation Scores (as of v0.2.9)

From `docs/research/governance.md`:

| Dimension | Score | Summary |
|-----------|-------|---------|
| ADR Governance | 2 / 5 | Zero ADR documents existed; compliance script not hooked |
| DDD Adherence | 1 / 5 | Intentional — tool is procedural, DDD targets downstream |
| Security | 3 / 5 | Secrets excluded; safe paths; shallow blocklist |
| Hook Enforcement | 4 / 5 | 11 event types, graceful degradation, comprehensive table |
| 3-Tier Routing | 2 / 5 | Policy declared; `router.js` routes agent types only, not model tiers |
| Test Coverage | 3 / 5 | 11 CLI tests; no unit tests for utils/setup; no negative paths |

---

## Further Reading

| Document | Contents |
|----------|---------|
| `docs/research/governance.md` | Full academic evaluation with methodology and references |
| `docs/adr/` | 7 ADR documents for ruflo-setup itself |
| `docs/ddd/bounded-context-map.md` | Context map for downstream projects |
| `docs/ddd/domain-taxonomy.md` | Canonical domain list resolving script discrepancies |
| `docs/plan/implementation-plan.md` | 3-sprint improvement plan |
| `docs/governance-101.md` | Full session summary |
