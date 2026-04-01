# Governance 101 — Ruflo-Setup Architecture & Governance Session

**Date:** 2026-03-31  
**Participants:** Mario Jauvin, Claude Code (claude-sonnet-4-6)  
**Session type:** Architecture evaluation + documentation sprint

---

## What This Document Is

This is a reconstructed transcript and reference summary of a working session that evaluated the `ruflo-setup` project's ADR and DDD governance posture, produced a research report, created ADR documents, DDD artefacts, and an implementation plan.

Use it as a "how we got here" companion to the documents produced.

---

## Part 1 — README Additions

### Windows vs Linux/WSL differences

The first task was adding a section to `README.md` covering platform-specific behaviour.

**Key points added:**

- `.mcp.json` and `.claude/settings.json` are **platform-specific** — they contain different commands depending on whether the tool runs on Windows or Linux/WSL.
- Both files are excluded from version control via `.gitignore` for this reason.
- Developers must rerun `ruflo-setup --force` after cloning into any new folder, especially when switching platforms.
- **Git file mode changes** (0644 → 0755): when switching from Windows to Linux/WSL, files may appear modified in `git status` with no content change. This is because Claude Code, git, or ruflo-setup may have updated Unix permission bits under the hood.

**Diagnostics:**
```bash
# See mode changes
git diff --summary

# Example output:
# mode change 100644 => 100755 some/file.js

# Discard unwanted mode changes
git checkout -- .

# Suppress mode tracking locally
git config core.fileMode false
```

> Note: `core.fileMode false` is a local-only setting — each developer must set it on their own clone.

---

## Part 2 — What Ruflo Is

### Overview

`@mfjjs/ruflo-setup` is a cross-platform Node.js CLI that bootstraps projects with **RuFlow** — a structured AI-assisted development framework built on Claude Code.

**What it sets up:**
- `.claude/` folder scaffolding (CLAUDE.md, hooks, commands, settings)
- `.mcp.json` with MCP server wiring (platform-aware)
- Global `SessionStart` hook for Claude Code
- 60+ specialized agents across dev, security, swarm coordination, and GitHub workflows

**Development capabilities:**
- 80+ agents: coding, review, testing, security, SPARC methodology, memory, performance
- 33 skills / 65 slash commands callable from Claude Code chat
- Swarm orchestration: hierarchical/mesh/adaptive topologies, up to 15 agents, Raft consensus for hive-mind
- 3-tier model routing: WASM booster (<1ms) → Haiku → Sonnet/Opus based on task complexity
- HNSW-indexed memory (AgentDB) with semantic search and cross-session persistence
- Neural/WASM acceleration for performance-critical paths

**ADR & DDD governance:**
- Architecture Decision Records track key architectural choices (e.g. ADR-026 for 3-tier routing, ADR-010 for claims-based auth)
- Domain-Driven Design enforced through bounded contexts, typed public APIs, aggregate design — supported by the `ddd-domain-expert` agent

---

## Part 3 — The Helpers

`.claude/helpers/` contains the glue layer between Claude Code hooks, swarm agents, memory, governance, and the shell/git environment. Most run invisibly via hooks; the V3 scripts are intended for manual invocation.

### V3 Dev Tools

| Script | Purpose |
|--------|---------|
| `v3.sh` | Master CLI — init, status, validate, metrics |
| `update-v3-progress.sh` | Update domain/agent/security/performance counters |
| `validate-v3-config.sh` | Validate dirs, JSON configs, Node.js, git, permissions |
| `v3-quick-status.sh` | Compact color-coded progress overview |
| `sync-v3-metrics.sh` | Sync V3 metrics across the environment |

### Hook Infrastructure

| File | Purpose |
|------|---------|
| `hook-handler.cjs` | Core hook dispatch/routing (CJS for broad Node compat) |
| `guidance-hook(s).sh` | Inject guidance context into hook events |
| `learning-hooks.sh` | Feed hook events into the learning pipeline |
| `swarm-hooks.sh` | Hook events for swarm coordination |
| `standard-checkpoint-hooks.sh` | Pre/post-task checkpoint hooks |
| `statusline-hook.sh` | Updates Claude Code status line on hook events |
| `auto-memory-hook.mjs` | Auto-saves memory entries on session events |
| `pre-commit` / `post-commit` | Git hooks wired into the workflow |

### Agent & Swarm Coordination

| File | Purpose |
|------|---------|
| `router.js` | 3-tier model routing (WASM → Haiku → Sonnet/Opus) |
| `swarm-comms.sh` | Inter-agent communication in swarms |
| `swarm-monitor.sh` | Real-time swarm health/status monitoring |
| `worker-manager.sh` | Spawn and manage background workers |
| `daemon-manager.sh` | Manage the claude-flow daemon lifecycle |

### Memory & Learning

| File | Purpose |
|------|---------|
| `memory.js` | Memory read/write/search wrappers |
| `intelligence.cjs` | Intelligence layer (pattern recognition, learning) |
| `learning-service.mjs` | Background learning service |
| `learning-optimizer.sh` | Optimize learning parameters over time |
| `pattern-consolidator.sh` | Consolidate and deduplicate learned patterns |
| `metrics-db.mjs` | Persist and query performance/usage metrics |

### Project Governance

| File | Purpose |
|------|---------|
| `adr-compliance.sh` | Check code changes against ADRs |
| `ddd-tracker.sh` | Track DDD bounded context adherence |
| `checkpoint-manager.sh` | Save/restore task checkpoints |

### Session & Status

| File | Purpose |
|------|---------|
| `session.js` | Session state save/restore |
| `statusline.js` / `statusline.cjs` | Claude Code status bar rendering |

### Setup & Security

| File | Purpose |
|------|---------|
| `setup-mcp.sh` | Configure MCP servers |
| `github-setup.sh` / `github-safe.js` | GitHub integration with safe credential handling |
| `security-scanner.sh` | Scan for secrets/vulnerabilities |
| `health-monitor.sh` | Overall environment health checks |
| `perf-worker.sh` | Performance measurement worker |
| `auto-commit.sh` | Automated commit workflows |
| `quick-start.sh` | Fast project bootstrap shortcut |

---

## Part 4 — Governance Evaluation (Summary)

A `goal-planner` agent performed a full static analysis of the codebase and produced `docs/research/governance.md`. Here is the headline scorecard:

| Dimension | Score | Key Finding |
|-----------|-------|-------------|
| ADR Governance | 2/5 | 10 ADRs referenced in scripts; zero ADR documents existed; `adr-compliance.sh` not hooked |
| DDD Governance | 1/5 | 5 bounded contexts declared in scripts; no corresponding code structure in repo |
| Security | 3/5 | Secrets correctly excluded; path traversal safe; `pre-bash` blocklist shallow |
| Hook Enforcement | 4/5 | Most mature artefact — 11 event types, graceful degradation |
| 3-Tier Routing | 2/5 | Policy declared in CLAUDE.md, partial `router.js` implementation, tier selection deferred downstream |
| Test Coverage | 3/5 | 11 tests covering CLI surface; no unit tests for utils/setup; no negative-path tests |

### Central insight

There is a **scope mismatch**: the DDD/ADR governance tooling in `.claude/helpers/` was designed to evaluate downstream `claude-flow`/`ruflo` consumer projects — not `ruflo-setup` itself. The governance infrastructure is a template installed into target projects, not a self-governing system.

A near-zero DDD compliance score is **expected and correct** for this repository; it does not indicate poor architecture.

### Top recommendations (from `docs/research/governance.md`)

| # | Recommendation | Priority |
|---|----------------|----------|
| R1 | Wire `adr-compliance.sh` and `ddd-tracker.sh` into the post-edit hook | High |
| R2 | Create ADR documents for the 4 most significant undocumented decisions | High |
| R3 | Reconcile domain taxonomy across all three governance scripts | Medium |
| R4 | Add an ADR explaining that DDD tooling targets downstream projects, not this tool | Medium |
| R5 | Extend test coverage for negative paths and utility functions | Medium |
| R6 | Stub ADR-026 tier selection in `router.js` to emit `[TASK_MODEL_RECOMMENDATION]` | Low |

---

## Part 5 — Documents Produced

### ADRs (`docs/adr/`)

| File | Decision |
|------|---------|
| `ADR-001-procedural-cli-architecture.md` | Why ruflo-setup is procedural, not DDD-structured |
| `ADR-002-esm-cjs-interoperability.md` | Why hook files use `.cjs` while source uses ESM |
| `ADR-003-advisory-only-hooks.md` | Why all hooks exit 0 and never block |
| `ADR-004-native-test-runner.md` | Why `node:test` is used instead of Vitest |
| `ADR-005-platform-aware-mcp-config.md` | Why `.mcp.json` is gitignored and regenerated per platform |
| `ADR-006-three-tier-model-routing.md` | The 3-tier routing policy, current state, and implementation gap |
| `ADR-007-hook-governance-wiring.md` | Proposed: wire governance helpers into post-edit hook *(Proposed)* |

### DDD (`docs/ddd/`)

| File | Contents |
|------|---------|
| `bounded-context-map.md` | 5 canonical contexts, relationship diagram, ubiquitous language, aggregates, domain events |
| `domain-taxonomy.md` | Resolves the 3-way naming discrepancy between governance scripts; exact diffs needed |

### Plan (`docs/plan/`)

| File | Contents |
|------|---------|
| `implementation-plan.md` | 3-sprint plan with tasks, file targets, code snippets, effort estimates |

### Research (`docs/research/`)

| File | Contents |
|------|---------|
| `governance.md` | Full academic evaluation (2,985 words) with methodology, scoring, and references |

---

## Part 6 — Implementation Plan Summary

See `docs/plan/implementation-plan.md` for full detail.

### Sprint 1 — Governance wiring & taxonomy (small, 2–4 sessions)
- Wire `adr-compliance.sh` into `hook-handler.cjs` post-edit handler
- Wire `ddd-tracker.sh` into `hook-handler.cjs` post-edit handler
- Reconcile domain taxonomy in `ddd-tracker.sh` and `validate-v3-config.sh`
- Add ADR-006 to `adr-compliance.sh` check list

### Sprint 2 — Router tier signal (medium, 3–5 sessions)
- Add `scoreComplexity()` to `router.js` → emit tier 1/2/3
- Emit `[TASK_MODEL_RECOMMENDATION: tier=N]` from `hook-handler.cjs`
- Update ADR-006 compliance check to verify signal presence

### Sprint 3 — Test coverage (medium, 2–4 sessions)
- Unit tests for `src/utils.js` (`parseArgs`, `toPlatformMcpConfig`, `semverGte`)
- Negative-path tests for `src/setup.js` (corrupt config, pnpm missing)
- `pre-bash` blocklist tests in `tests/hook-handler.test.mjs`

---

## Key Files Reference

```
src/
  cli.js           Command router and argument handling
  setup.js         Setup workflow (init, .mcp.json, .gitignore, hook install)
  hooks.js         Global check-ruflo hook install/status
  utils.js         Filesystem, args, platform config helpers
  status.js        Layer-by-layer feature status (Layers 0–8)

.claude/
  settings.json    Hook table (11 event types) — gitignored, not committed
  helpers/
    hook-handler.cjs     Central hook dispatcher
    router.js            Agent type routing (partial tier routing)
    adr-compliance.sh    ADR compliance checker (10 ADRs, 15-min throttle)
    ddd-tracker.sh       DDD artefact counter (10-min throttle)

docs/
  research/governance.md          Academic evaluation (source of truth)
  adr/                            7 ADR documents
  ddd/                            Bounded context map + domain taxonomy
  plan/implementation-plan.md     Sprint-by-sprint implementation guide
  governance-101.md               This file
```
