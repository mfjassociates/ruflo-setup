# Ruflo: Complete Feature Enablement & Deep Dive

> Research date: 2026-03-14
> Source: ruvnet/ruflo (GitHub), ruvnet/claude-flow (GitHub), local codebase analysis

---

## Table of Contents

1. [What Ruflo Is](#what-ruflo-is)
2. [Complete Feature List](#complete-feature-list)
3. [Where Everything Runs](#where-everything-runs)
4. [How to Check Feature Status](#how-to-check-feature-status)
5. [Step-by-Step Enablement](#step-by-step-enablement)
6. [MinCut, RuVector, and RVF Deep Dive](#mincut-ruvector-and-rvf-deep-dive)
7. [Full Before/After: What the Combined Stack Changes](#full-beforeafter)
8. [Sources](#sources)
9. [Agents & Skills: Origin Reference](#agents--skills-origin-reference)
10. [How Agents and Skills Are Invoked](#how-agents-and-skills-are-invoked)

---

## What Ruflo Is

`ruflo`, `claude-flow`, and `@claude-flow/cli` are the **same codebase** at different abstraction levels:

- `ruflo` (npm) — thin wrapper, exposes the `ruflo` CLI binary
- `claude-flow` (npm) — alternate install path, same code
- `@claude-flow/cli` — the actual implementation

> "Claude Flow is now Ruflo — named by Ruv, who loves Rust, flow states, and building things that feel inevitable. The 'Ru' is the Ruv. The 'flo' is the flow. Underneath, WASM kernels written in Rust power the policy engine, embeddings, and proof system."
> — ruvnet/ruflo README

**Critical clarification:** There are **no Rust source files or Cargo.toml files** to compile. All Rust/WASM components ship as pre-compiled `.wasm` blobs inside `@ruvector/*` npm packages. No `cargo install` is needed.

---

## Complete Feature List

### Layer 0 — Prerequisites

| # | Feature | Notes |
|---|---|---|
| 0.1 | Node.js 20+ | Minimum requirement |
| 0.2 | pnpm | Package manager |
| 0.3 | Claude Code CLI (`@anthropic-ai/claude-code`) | Must be installed globally |
| 0.4 | `ANTHROPIC_API_KEY` | Required for all LLM calls |

### Layer 1 — Global npm Packages

```bash
pnpm add -g ruflo@latest
pnpm add -g @mfjjs/ruflo-setup
```

These are the only two packages needed globally. Everything else is either:
- Pulled in as optional dependencies of `ruflo@latest`, or
- Run ephemerally via `npx`/`pnpm dlx` from `.mcp.json`

### Layer 2 — Optional npm Packages (auto-pulled with full install)

These are `optionalDependencies` — installed unless you pass `--omit=optional`.

| Package | Purpose | Runs Where |
|---|---|---|
| `@claude-flow/aidefence` | Prompt injection / PII detection | Local (Node.js) |
| `@claude-flow/codex` | OpenAI Codex dual-mode | Local (Node.js) |
| `@claude-flow/embeddings` | ONNX vector embeddings (all-MiniLM-L6-v2) | Local (Node.js) |
| `@claude-flow/guidance` | CLAUDE.md compiled to governance gates | Local (Node.js) |
| `@claude-flow/memory` | AgentDB + HNSW vector index | Local (Node.js) |
| `agentic-flow` | Agent Booster WASM transforms + ReasoningBank | Local (WASM in Node.js) |
| `@ruvector/attention` | Flash Attention kernel | Local (WASM in Node.js) |
| `@ruvector/learning-wasm` | Neural training kernel | Local (WASM in Node.js) |
| `@ruvector/router` | Q-Learning semantic router | Local (WASM in Node.js) |
| `@ruvector/router-linux-x64-gnu` | Platform native binding (Linux x64 only) | Local (native) |
| `@ruvector/sona` | Self-Optimizing Neural Architecture (LoRA/EWC++) | Local (WASM in Node.js) |

> **Windows note:** `@ruvector/attention` has a NAPI native binding that requires the **Windows 11 SDK** to compile. Without it, the package falls back to WASM automatically — you do not need the SDK for basic operation.

**Install profiles:**

| Mode | Command | Approx. Size |
|---|---|---|
| Minimal (no ML) | `pnpm add -g ruflo@latest --omit=optional` | ~45 MB |
| Full (with ML/WASM) | `pnpm add -g ruflo@latest` | ~340 MB |

### Layer 3 — MCP Servers

Registered in `.mcp.json`, run ephemerally via `pnpm dlx`:

| MCP Server | npm Package | Required? | Auth? |
|---|---|---|---|
| `claude-flow` | `@claude-flow/cli@latest` | Yes | No |
| `ruv-swarm` | `ruv-swarm` | Optional | No |
| `flow-nexus` | `flow-nexus@latest` | Optional | Yes — account at Cognitum.One |

### Layer 4 — MCP Tool Groups (opt-in via env vars)

| Group | Env Var | Tool Count | Default |
|---|---|---|---|
| Intelligence | `MCP_GROUP_INTELLIGENCE=true` | 10 | On |
| Agents | `MCP_GROUP_AGENTS=true` | 50 | On |
| Memory | `MCP_GROUP_MEMORY=true` | 25 | On |
| DevTools | `MCP_GROUP_DEVTOOLS=true` | 60 | On |
| Security | `MCP_GROUP_SECURITY=true` | 25 | **On** (enabled by ruflo-setup) |
| Browser | `MCP_GROUP_BROWSER=true` | 23 | **On** (enabled by ruflo-setup) |
| Neural | `MCP_GROUP_NEURAL=true` | 20 | **On** (enabled by ruflo-setup) |
| Agentic Flow | `MCP_GROUP_AGENTIC_FLOW=true` | 15 | **On** (enabled by ruflo-setup) |
| Claude Code | `MCP_GROUP_CLAUDE_CODE=true` | varies | Needs `ANTHROPIC_API_KEY` |
| Gemini | `MCP_GROUP_GEMINI=true` | varies | Needs `GOOGLE_API_KEY` |
| Codex | `MCP_GROUP_CODEX=true` | varies | Needs `OPENAI_API_KEY` |

### Layer 5 — Environment Variables

| Variable | Required? | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | **Yes** | Claude model inference |
| `OPENAI_API_KEY` | Optional | GPT models + Codex |
| `GOOGLE_API_KEY` | Optional | Gemini models |
| `OPENROUTER_API_KEY` | Optional | Multi-provider proxy |
| `CLAUDE_FLOW_MODE` | Set by .mcp.json | Must be `v3` |
| `CLAUDE_FLOW_HOOKS_ENABLED` | Set by .mcp.json | `true` |
| `CLAUDE_FLOW_TOPOLOGY` | Set by .mcp.json | `hierarchical-mesh` |
| `CLAUDE_FLOW_MAX_AGENTS` | Set by .mcp.json | `15` |
| `CLAUDE_FLOW_MEMORY_BACKEND` | Set by .mcp.json | `hybrid` |
| `CLAUDE_FLOW_LOG_LEVEL` | Optional | `debug` / `info` / `warn` / `error` |
| `CLAUDE_FLOW_CONTEXT_WINDOW` | Optional | Default `200000` |

### Layer 6 — Claude Code Hooks (global, one-time)

| Hook | File | Purpose |
|---|---|---|
| Global `SessionStart` | `~/.claude/settings.json` | `check-ruflo.cjs` warns when project is not configured |
| Global `/ruflo-setup` command | `~/.claude/commands/ruflo-setup.md` | Slash command available in all projects |

### Layer 7 — Project Scaffolding (`ruflo init --full`)

| File / Dir | Purpose |
|---|---|
| `.claude/settings.json` | Hooks, permissions, daemon config |
| `.claude/helpers/statusline.cjs` | Real-time statusline |
| `.claude/helpers/hook-handler.cjs` | Pattern learning handler |
| `.claude/helpers/intelligence.cjs` | Intelligence diagnostics |
| `.claude/agents/` | 120+ agent definitions |
| `.claude/skills/` | 30+ skill definitions |
| `.claude/commands/` | Slash commands |
| `CLAUDE.md` | Project governance rules |
| `.mcp.json` | MCP server registration |
| `.claude-flow/` | Runtime data (memory, sessions, neural, logs) |

### Layer 8 — Optional: Docker Chat UI Stack

| Component | Purpose |
|---|---|
| `ruvocal` (SvelteKit) | Local chat UI |
| MCP Bridge (Node.js, port 3001) | UI ↔ MCP bridge |
| MongoDB (or RVF) | Conversation persistence |
| Nginx (port 3000) | Reverse proxy |

---

## Where Everything Runs

```
┌─────────────────────────────────────────────────────────────────┐
│  ANTHROPIC CLOUD                                                │
│  • Claude model inference (all agent LLM calls)                 │
│  • Claude 3.5 Haiku (tier 2 routing, ~500ms, $0.0002)           │
│  • Claude Sonnet 4 / Opus 4 (tier 3, 2-5s, $0.003-0.015)        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  FLOW NEXUS CLOUD  (Cognitum.One — optional, auth required)     │
│  • User auth, E2B cloud sandboxes, distributed neural training  │
│  • App store, payment/credits (RUV tokens), storage uploads     │
│  • Real-time event subscriptions, swarm templates in cloud      │
└─────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  LOCAL COMPUTER — Node.js process                              │
│  • ruflo CLI (all 26 commands, 140+ subcommands)               │
│  • @claude-flow/cli MCP server (stdio / HTTP port 3000)        │
│  • ruv-swarm MCP server                                        │
│  • All agent spawning & swarm coordination (up to 15 agents)   │
│  • Memory: SQLite/RVF in .claude-flow/data/                    │
│  • HNSW vector index (AgentDB)                                 │
│  • ONNX embeddings: all-MiniLM-L6-v2                           │
│  • Background daemon (12 worker types)                         │
│  • All hooks (27 hooks + 12 workers)                           │
│  • Pattern learning, session persistence                       │
│  • Security scanning, code analysis                            │
│  • IPFS registry signing (@noble/ed25519)                      │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  LOCAL COMPUTER — Rust compiled to WASM                        │
│  (runs inside the Node.js process — no separate install)       │
│                                                                │
│  • Agent Booster (agentic-flow)                                │
│    Tier 1 routing: <1ms, $0 — skips LLM entirely               │
│    Transforms: var→const, add-types, add-error-handling,       │
│    async-await, add-logging, remove-console                    │
│    Throughput: 1,000 files/second                              │
│                                                                │
│  • Flash Attention (@ruvector/attention)                       │
│    2.49x–7.47x speedup for vector re-ranking                   │
│    O(N) memory via block tiling (block size: 32)               │
│    Sparse attention: top 12% of keys only                      │
│                                                                │
│  • Q-Learning semantic router (@ruvector/router)               │
│    Routes tasks to optimal agent without LLM call              │
│    Combines: SONA + Q-table + coverage signal + MinCut graph   │
│                                                                │
│  • SONA — Self-Optimizing Neural Architecture (@ruvector/sona) │
│    LoRA + EWC++ — learns from task outcomes across sessions    │
│    Confidence: +0.1 success / -0.15 failure / -0.01/day decay  │
│                                                                │
│  • Neural training kernel (@ruvector/learning-wasm)            │
│    JUDGE → DISTILL → CONSOLIDATE pipeline (background)         │
│                                                                │
│  Runtime selection order: NAPI native → WASM → TypeScript      │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  LOCAL COMPUTER — Docker (optional chat UI)                    │
│  ruvocal (SvelteKit) + MCP Bridge + MongoDB/RVF + Nginx        │
└────────────────────────────────────────────────────────────────┘
```

### 3-Tier Model Routing Summary

| Tier | Handler | Latency | Cost | Trigger |
|---|---|---|---|---|
| 1 | Agent Booster (WASM) | <1ms | $0 | Simple transforms — no LLM call |
| 2 | Claude Haiku | ~500ms | $0.0002 | Low complexity (<30%) |
| 3 | Claude Sonnet / Opus | 2–5s | $0.003–0.015 | Complex reasoning, architecture, security |

---

## How to Check Feature Status

Run the built-in status command to see which layers are enabled in the current project:

```bash
ruflo-setup status
```

This checks all 8 layers and prints a report with `[OK]`, `[--]`, and `[!!]` indicators:

- `[OK]` — feature is present and enabled
- `[--]` — not enabled (acceptable for optional features)
- `[!!]` — required feature is missing (needs attention)

The report covers:
- **Layer 0**: Node.js 20+, pnpm, Claude Code CLI, `ANTHROPIC_API_KEY`
- **Layer 1**: Global npm packages (`ruflo`, `@mfjjs/ruflo-setup`)
- **Layer 2**: Optional WASM/ML packages (`@ruvector/*`, `agentic-flow`, `@claude-flow/*`)
- **Layer 3**: MCP servers in `.mcp.json` (`claude-flow`, `ruv-swarm`, `flow-nexus`)
- **Layer 4**: MCP tool groups (`SECURITY`, `BROWSER`, `NEURAL`, `AGENTIC_FLOW` — enabled by default)
- **Layer 5**: Environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.)
- **Layer 6**: Claude Code global hooks (SessionStart hook, `/ruflo-setup` command)
- **Layer 7**: Project scaffolding (`.mcp.json`, `CLAUDE.md`, `.claude/agents/`, etc.)
- **Layer 8**: Docker chat UI stack (`ruvocal`)

A summary line shows `X/Y features enabled` and flags any required items that need action.

---

## Step-by-Step Enablement

```bash
# 1. Install Node.js 20+
winget install OpenJS.NodeJS.LTS          # Windows
brew install node                          # macOS

# 2. Install pnpm
winget install -e --id pnpm.pnpm          # Windows
brew install pnpm                          # macOS

# 3. Install ruflo globally (full, with WASM/ML packages)
pnpm add -g ruflo@latest

# 4. Install ruflo-setup bootstrapper
pnpm add -g @mfjjs/ruflo-setup

# 5. Set your Anthropic API key (required)
# Windows (permanent):
setx ANTHROPIC_API_KEY "your-key-here"
# macOS/Linux:
echo 'export ANTHROPIC_API_KEY="your-key-here"' >> ~/.zshrc

# 6. From each project directory — run full setup:
ruflo-setup
#   This automatically does:
#     pnpm add -g ruflo@latest
#     ruflo init --full
#     writes .mcp.json (3 MCP servers)
#     installs global SessionStart hook (~/.claude/settings.json)
#     installs global /ruflo-setup command (~/.claude/commands/)

# 7. MCP tool groups — already enabled by ruflo-setup
# SECURITY, BROWSER, NEURAL, and AGENTIC_FLOW are now on by default.
# To disable any group, set its value to "false" in .mcp.json env.

# 8. (Optional) Authenticate with Flow Nexus
# Sign up at Cognitum.One, then use /flow-nexus-auth in Claude Code

# 9. Run diagnostics
ruflo doctor --fix

# 10. Restart Claude Code to load new MCP servers
```

---

## MinCut, RuVector, and RVF Deep Dive

### MinCut — Codebase Graph Partitioning

MinCut is a real implementation using the **Stoer-Wagner algorithm**, exposed as the MCP tool `hooks_graph_mincut`. It is not a swarm feature — it is a static analysis pass that feeds agent routing decisions.

**What it does:**

Builds a directed dependency graph from your codebase's import/export statements, then finds the minimum set of edges to cut to split the graph into two natural groups:

```
partition1: ["src/auth/", "src/users/"]
partition2: ["src/payments/", "src/orders/"]
bridges: [{ from: "src/auth/index.ts", to: "src/payments/gateway.ts" }]
articulationPoints: ["src/auth/index.ts"]
suggestion: "Natural boundary: auth/users vs payments/orders"
```

**What changes in the workflow:**

| Without MinCut | With MinCut |
|---|---|
| Agent assignment by file extension + keywords only | Agent assignment uses graph community membership |
| Generic refactoring suggestions | Human-readable `suggestion` output: "split here" |
| Arbitrary task parallelization | Swarm splits tasks along the MinCut boundary — no agent collisions |
| No structural risk awareness | Articulation points flagged as high-risk for edits |

**Relation to sublinear agents:** MinCut is O(V³) and runs *before* the sublinear solvers. It reduces the graph first, then the `consensus-coordinator` runs the Neumann series solver on the smaller partition adjacency matrices. `pagerank-analyzer` scores nodes within each partition for voting influence.

---

### RuVector (`@ruvector/*`) — Four WASM Kernels

#### `@ruvector/attention` — Flash Attention

Solves O(N²) memory for naive attention over large context.

- Processes attention in blocks of 32 vectors (fits CPU L1 cache)
- Sparse attention: only top 12% of keys (min 16, max 96)
- 8x loop unrolling for dot products
- Pre-allocated `Float32Array` buffers — zero GC pressure
- Runs *after* HNSW returns top-K candidates — re-ranks them

| Operation | Without | With | Improvement |
|---|---|---|---|
| Re-ranking 1,000 patterns | ~350ms | ~47–140ms | 2.49x–7.47x |
| Memory for full attention | O(N²) | O(N) via tiling | — |

---

#### `@ruvector/sona` — Self-Optimizing Neural Architecture

Learns which agent works best for each task class in *your* codebase, persisting across sessions.

- On task completion (`hooks_trajectory_end`): extracts keywords, updates routing confidence
- Success: `+0.1` confidence. Failure: `-0.15`. Time decay: `-0.01/day`
- **EWC++**: old patterns not overwritten when new ones are learned
- **LoRA**: fine-tunes routing weights with minimal compute
- Persists to `.swarm/sona-patterns.json`

| Session 1 | After 20+ sessions |
|---|---|
| Routes by keyword heuristic every time | High-confidence routes resolve in ~0.045ms |
| "implement auth" → `coder` (always) | "implement auth" in this codebase → `security-architect` (learned) |
| No failure learning | Failed routes reduce confidence; alternatives promoted |
| Cold start every session | Learned context persists across sessions |

---

#### `@ruvector/router` — Q-Learning Semantic Router

Blends four signals to pick the optimal agent from 60+ options:

1. **SONA pattern match** — learned keyword → agent mappings
2. **Q-learning table** — `(task_type, file_context)` → best agent, updated by reward
3. **Coverage signal** — if test coverage below threshold, `tester` gets priority
4. **MinCut graph signal** — file's community membership and articulation-point status

```
Without router: "implement OAuth" → coder (always)
With router:    "implement OAuth" in src/auth/ (articulation point, 34% coverage)
                → security-architect (SONA: 0.87) + tester spawned in parallel
```

The returned result includes `confidence`, `reason`, and `alternates` — the routing decision is inspectable.

---

#### `@ruvector/learning-wasm` — Neural Training Kernel

Powers the background `ultralearn` worker and `ruflo neural train`. Runs the four-step pipeline:

1. **RETRIEVE** — HNSW pattern search
2. **JUDGE** — success/failure verdict stored with embedding
3. **DISTILL** — reusable pattern extracted via LoRA weight extraction
4. **CONSOLIDATE** — merged into long-term memory via EWC++ (no catastrophic forgetting)

Runs in the background. Does not block agent execution.

---

### RVF (RuVector Format) — Two Distinct Uses

#### RVF as a Database (Chat UI)

A zero-dependency JSON document store replacing MongoDB for the local `ruvocal` chat UI:

```json
{
  "rvf_version": "2.0",
  "format": "rvf-database",
  "collections": {
    "conversations": { "id1": { ... } }
  },
  "metadata": { "created_at": "...", "doc_count": 1847 }
}
```

- In-memory `Map<id, Record>` → O(1) lookup by ID
- Writes debounced 500ms — no write thrash
- Implements the full MongoDB Collection interface — 56 UI files work without modification
- Supports 15 MongoDB operators (`$set`, `$push`, `$or`, `$regex`, etc.)
- Cold start: ~1.2s vs ~3.5s with MongoDB driver

#### RVF as a Package Format (Deployment)

The `rvf.manifest.json` describes ruflo's MCP deployment artifact as a segmented container:

| Segment | Contents | Security Role |
|---|---|---|
| `WASM` | MCP bridge entrypoint | Microkernel runtime boundary |
| `TOOL_GROUPS` | Active MCP tools per profile | Access control surface |
| `CRYPTO` | Request signing keys (`@noble/ed25519`) | Every MCP tool call is signed |
| `META_IDX` | Tool registry cache | Prevents tool substitution attacks |
| `OVERLAY` | Per-project customization | Tenant isolation |

---

## Full Before/After

```
WITHOUT ruvector/mincut/rvf:
────────────────────────────────────────────────────────────────────
  Task → keyword match → pick agent → Anthropic API call
  Memory search → linear scan → ~400ms per query
  Each session starts cold — no learned patterns
  Agent routing is static, project-agnostic
  Test gaps, boundary files, articulation points: invisible
  Simple edits ("var→const") still hit the LLM

WITH full stack enabled:
────────────────────────────────────────────────────────────────────
  Task arrives
    → MinCut: which community is this file in? Is it a bridge?
    → SONA: confidence-weighted learned route (cross-session)
    → Q-learning: historical reward signal for (task, context)
    → Coverage signal: spawn tester in parallel if needed?
    → Route decision with confidence score + human-readable reason

  Memory search
    → HNSW: top-K candidates in ~0.045ms (vs ~400ms linear)
    → Flash Attention: re-rank in O(N) memory with no GC pauses
    → Semantically re-ranked results in <1ms total

  Simple edit ("var→const", "add types", "add error handling")
    → Agent Booster (WASM): no LLM call at all
    → 1ms per file, 1,000 files/second, $0 cost

  Session ends
    → SONA: update confidence table from outcomes
    → LearningBridge: JUDGE → DISTILL → CONSOLIDATE (background)
    → EWC++: new patterns stored without overwriting old ones
    → Next session starts with learned context
```

### Performance Numbers (Verified)

| Metric | Baseline | With Stack | Improvement |
|---|---|---|---|
| HNSW vector search (1M vectors) | ~400ms | ~0.045ms | ~8,800x |
| Memory cache hit | — | ~0.01ms | — |
| Flash Attention re-ranking | ~350ms | ~47–140ms | 2.49–7.47x |
| Graph build (1k nodes) | — | 2.78ms | 71.9x under 200ms target |
| PageRank (1k nodes) | — | 12.21ms | 8.2x under 100ms target |
| Insight recording | — | 0.12ms | 41x under 5ms target |
| Knowledge transfer | — | 1.25ms | 80x under 100ms target |
| Agent Booster edit | ~352ms (Haiku) | <1ms (WASM) | ~350x |

---

## Sources

| # | Source | What Was Verified |
|---|---|---|
| 1 | `ruvnet/ruflo` GitHub — README | Identity: ruflo = claude-flow, WASM architecture |
| 2 | `ruflo/package.json` (upstream) | `ruflo` delegates entirely to `@claude-flow/cli` |
| 3 | `v3/@claude-flow/cli/package.json` | Complete optional dependencies list |
| 4 | `v3/@claude-flow/cli/src/ruvector/graph-analyzer.ts` | MinCut in agent routing context |
| 5 | `v3/@claude-flow/cli/src/ruvector/flash-attention.ts` | Block size 32, sparse top 12%, 8x unrolling |
| 6 | `v3/@claude-flow/cli/src/memory/sona-optimizer.ts` | Confidence ±values, decay rate, EWC++ |
| 7 | `v3/@claude-flow/cli/src/ruvector/README.md` | `hooks_graph_mincut` API, HNSW benchmark table |
| 8 | `ruflo/src/ruvocal/src/lib/server/database/rvf.ts` | RVF database implementation (1,079 lines) |
| 9 | `ruflo/rvf.manifest.json` + ADR-032 | RVF package segments, CRYPTO signing |
| 10 | `v2/docs/integrations/agent-booster/AGENT-BOOSTER-INTEGRATION.md` | Agent Booster transforms, 1ms/1000 files/sec |
| 11 | `ruflo/docs/adr/ADR-002-WASM-CORE-PACKAGE.md` | MinCut algorithms, WASM packaging decision |
| 12 | Local `.claude-flow/CAPABILITIES.md` | Performance targets, agent types, hook system |
| 13 | Local `.claude-flow/config.yaml` | Runtime config: HNSW, SONA, LearningBridge, MemoryGraph |
| 14 | Local `.mcp.json` | Three MCP servers, env vars |
| 15 | Local `.claude-flow/data/auto-memory-store.json` | Windows SDK requirement for `@ruvector/attention` |
| 16 | npmjs.com — `ruflo` | Version confirmation (3.5.15) |

---

## Agents & Skills: Origin Reference

> `[Claude]` = built into Claude Code by Anthropic — always available, no install needed.
> `[Ruflo]` = installed by `ruflo init --full` into `.claude/agents/` or `.claude/skills/`.

---

### Agents

#### Claude Code Built-in Agents

| Agent | Description |
|---|---|
| `general-purpose` | Default multi-step task agent; used when no specialized type is specified |
| `Explore` | Fast read-only codebase exploration; searches files, patterns, and answers structure questions |
| `Plan` | Software architect agent; designs implementation plans and identifies critical files |
| `statusline-setup` | Configures the Claude Code status line setting in user config |
| `claude-code-guide` | Answers questions about Claude Code CLI features, hooks, MCP, and the Anthropic API |

#### Ruflo Agents — Core Development

| Agent | Description |
|---|---|
| `coder` | Implementation specialist for writing clean, efficient code with self-learning capabilities |
| `planner` | Strategic planning and task orchestration agent with AI-powered resource optimization |
| `researcher` | Deep research and information gathering specialist with AI-enhanced pattern recognition |
| `reviewer` | Code review and quality assurance specialist with AI-powered pattern detection |
| `tester` | Comprehensive testing and quality assurance specialist with AI-powered test generation |

#### Ruflo Agents — Analysis & Architecture

| Agent | Description |
|---|---|
| `code-analyzer` | Advanced code quality analysis agent for comprehensive code reviews and improvements |
| `system-architect` | Expert agent for system architecture design, patterns, and high-level technical decisions |

#### Ruflo Agents — Swarm Coordination

| Agent | Description |
|---|---|
| `hierarchical-coordinator` | Queen-led hierarchical swarm coordination with specialized worker delegation |
| `mesh-coordinator` | Peer-to-peer mesh network swarm with distributed decision making and fault tolerance |
| `adaptive-coordinator` | Dynamic topology switching coordinator with self-organizing swarm patterns and real-time optimization |
| `smart-agent` | Intelligent agent coordination and dynamic spawning specialist |
| `swarm-init` | Swarm initialization and topology optimization specialist |
| `task-orchestrator` | Central coordination agent for task decomposition, execution planning, and result synthesis |
| `memory-coordinator` | Manage persistent memory across sessions and facilitate cross-agent memory sharing |
| `perf-analyzer` | Performance bottleneck analyzer for identifying and resolving workflow inefficiencies |

#### Ruflo Agents — Consensus & Distributed

| Agent | Description |
|---|---|
| `byzantine-coordinator` | Coordinates Byzantine fault-tolerant consensus protocols with malicious actor detection |
| `raft-manager` | Manages Raft consensus algorithm with leader election and log replication |
| `gossip-coordinator` | Coordinates gossip-based consensus protocols for scalable eventually consistent systems |
| `crdt-synchronizer` | Implements Conflict-free Replicated Data Types for eventually consistent state synchronization |
| `quorum-manager` | Implements dynamic quorum adjustment and intelligent membership management |
| `security-manager` | Implements comprehensive security mechanisms for distributed consensus protocols |
| `performance-benchmarker` | Implements comprehensive performance benchmarking for distributed consensus protocols |
| `consensus-coordinator` | Distributed consensus agent that uses sublinear solvers for fast agreement protocols in multi-agent systems |

#### Ruflo Agents — SPARC Methodology

| Agent | Description |
|---|---|
| `specification` | SPARC Specification phase specialist for requirements analysis with self-learning |
| `pseudocode` | SPARC Pseudocode phase specialist for algorithm design with self-learning |
| `architecture` | SPARC Architecture phase specialist for system design with self-learning |
| `refinement` | SPARC Refinement phase specialist for iterative improvement with self-learning |
| `sparc-coord` | Strategic planning and task orchestration agent with AI-powered resource optimization |
| `sparc-coder` | Implementation specialist for writing clean, efficient code with self-learning capabilities |
| `sparc-orchestrator` | V3 SPARC methodology orchestrator that coordinates all five SPARC phases with ReasoningBank learning |

#### Ruflo Agents — GitHub & Repository

| Agent | Description |
|---|---|
| `pr-manager` | Comprehensive pull request management with swarm coordination for automated reviews, testing, and merge workflows |
| `code-review-swarm` | Deploy specialized AI agents to perform comprehensive, intelligent code reviews that go beyond traditional static analysis |
| `issue-tracker` | Intelligent issue management and project coordination with automated tracking, progress monitoring, and team coordination |
| `release-manager` | Automated release coordination and deployment with ruv-swarm orchestration for seamless version management, testing, and deployment across multiple packages |
| `release-swarm` | Orchestrate complex software releases using AI swarms that handle everything from changelog generation to multi-platform deployment |
| `repo-architect` | Repository structure optimization and multi-repo management with ruv-swarm coordination for scalable project architecture and development workflows |
| `workflow-automation` | GitHub Actions workflow automation agent that creates intelligent, self-organizing CI/CD pipelines with adaptive multi-agent coordination and automated optimization |
| `github-modes` | Comprehensive GitHub integration modes for workflow orchestration, PR management, and repository coordination with batch optimization |
| `multi-repo-swarm` | Cross-repository swarm orchestration for organization-wide automation and intelligent collaboration |
| `project-board-sync` | Synchronize AI swarms with GitHub Projects for visual task management, progress tracking, and team coordination |
| `sync-coordinator` | Multi-repository synchronization coordinator that manages version alignment, dependency synchronization, and cross-package integration with intelligent swarm orchestration |
| `swarm-issue` | GitHub issue-based swarm coordination agent that transforms issues into intelligent multi-agent tasks with automatic decomposition and progress tracking |
| `swarm-pr` | Pull request swarm management agent that coordinates multi-agent code review, validation, and integration workflows with automated PR lifecycle management |

#### Ruflo Agents — Specialized Development

| Agent | Description |
|---|---|
| `backend-dev` | Specialized agent for backend API development with self-learning and pattern recognition |
| `ml-developer` | ML developer with self-learning hyperparameter optimization and pattern recognition |
| `mobile-dev` | Expert agent for React Native mobile application development across iOS and Android |
| `cicd-engineer` | Specialized agent for GitHub Actions CI/CD pipeline creation and optimization |
| `api-docs` | Expert agent for creating OpenAPI documentation with pattern learning |
| `base-template-generator` | Creates foundational templates, boilerplate code, or starter configurations for new projects, components, or features |
| `test-long-runner` | Test agent that can run for 30+ minutes on complex tasks |

#### Ruflo Agents — Performance & Optimization

| Agent | Description |
|---|---|
| `Benchmark Suite` | Comprehensive performance benchmarking, regression detection and performance validation |
| `Load Balancing Coordinator` | Dynamic task distribution, work-stealing algorithms and adaptive load balancing |
| `Performance Monitor` | Real-time metrics collection, bottleneck analysis, SLA monitoring and anomaly detection |
| `Resource Allocator` | Adaptive resource allocation, predictive scaling and intelligent capacity planning |
| `Topology Optimizer` | Dynamic swarm topology reconfiguration and communication pattern optimization |
| `goal-planner` | Goal-Oriented Action Planning (GOAP) specialist that dynamically creates intelligent plans to achieve complex objectives |
| `sublinear-goal-planner` | Goal-Oriented Action Planning specialist using sublinear solvers for large-scale distributed planning |
| `matrix-optimizer` | Expert agent for matrix analysis and optimization using sublinear algorithms |
| `pagerank-analyzer` | Expert agent for graph analysis and PageRank calculations using sublinear algorithms |
| `performance-optimizer` | System performance optimization agent that identifies bottlenecks and optimizes resource allocation using sublinear algorithms |
| `trading-predictor` | Advanced financial trading agent that leverages temporal advantage calculations to predict and execute trades before market data arrives |

#### Ruflo Agents — V3 Security & Intelligence

| Agent | Description |
|---|---|
| `security-architect` | V3 Security Architecture specialist with ReasoningBank learning, HNSW threat pattern search, and zero-trust design capabilities |
| `security-architect-aidefence` | Enhanced V3 Security Architecture specialist with AIMDS integration combining ReasoningBank learning with real-time prompt injection detection and behavioral analysis |
| `security-auditor` | Advanced security auditor with self-learning vulnerability detection, CVE database search, and compliance auditing |
| `aidefence-guardian` | AI Defense Guardian agent that monitors all agent inputs/outputs for manipulation attempts using AIMDS |
| `injection-analyst` | Deep analysis specialist for prompt injection and jailbreak attempts with pattern learning |
| `pii-detector` | Specialized PII detection agent that scans code and data for sensitive information leaks |
| `claims-authorizer` | V3 Claims-based authorization specialist implementing ADR-010 for fine-grained access control across swarm agents and MCP tools |

#### Ruflo Agents — V3 Memory & Learning

| Agent | Description |
|---|---|
| `memory-specialist` | V3 memory optimization specialist with HNSW indexing, hybrid backend management, vector quantization, and EWC++ for preventing catastrophic forgetting |
| `sona-learning-optimizer` | SONA-powered self-optimizing agent with LoRA fine-tuning and EWC++ memory preservation |
| `reasoningbank-learner` | V3 ReasoningBank integration specialist for trajectory tracking, verdict judgment, pattern distillation, and experience replay using HNSW-indexed memory |
| `swarm-memory-manager` | V3 distributed memory manager for cross-agent state synchronization, CRDT replication, and namespace coordination across the swarm |
| `collective-intelligence-coordinator` | Hive-mind collective decision making with Byzantine fault-tolerant consensus, attention-based coordination, and emergent intelligence patterns |

#### Ruflo Agents — V3 Architecture & Domain

| Agent | Description |
|---|---|
| `adr-architect` | V3 Architecture Decision Record specialist that documents, tracks, and enforces architectural decisions with ReasoningBank integration for pattern learning |
| `ddd-domain-expert` | V3 Domain-Driven Design specialist for bounded context identification, aggregate design, domain modeling, and ubiquitous language enforcement |
| `v3-integration-architect` | V3 deep agentic-flow@alpha integration specialist implementing ADR-001 for eliminating duplicate code and building claude-flow as a specialized extension |
| `performance-engineer` | V3 Performance Engineering Agent specialized in Flash Attention optimization, WASM SIMD acceleration, token usage optimization, and comprehensive performance profiling with SONA integration |

#### Ruflo Agents — Flow Nexus (cloud)

| Agent | Description |
|---|---|
| `flow-nexus-app-store` | Application marketplace and template management specialist that handles app publishing, discovery, deployment, and marketplace operations within Flow Nexus |
| `flow-nexus-auth` | Flow Nexus authentication and user management specialist that handles login, registration, session management, and user account operations |
| `flow-nexus-challenges` | Coding challenges and gamification specialist that manages challenge creation, solution validation, leaderboards, and achievement systems within Flow Nexus |
| `flow-nexus-neural` | Neural network training and deployment specialist that manages distributed neural network training, inference, and model lifecycle using Flow Nexus cloud infrastructure |
| `flow-nexus-payments` | Credit management and billing specialist that handles payment processing, credit systems, tier management, and financial operations within Flow Nexus |
| `flow-nexus-sandbox` | E2B sandbox deployment and management specialist that creates, configures, and manages isolated execution environments for code development and testing |
| `flow-nexus-swarm` | AI swarm orchestration and management specialist that deploys, coordinates, and scales multi-agent swarms in the Flow Nexus cloud platform |
| `flow-nexus-user-tools` | User management and system utilities specialist that handles profile management, storage operations, real-time subscriptions, and platform administration |
| `flow-nexus-workflow` | Event-driven workflow automation specialist that creates, executes, and manages complex automated workflows with message queue processing and intelligent agent coordination |

#### Ruflo Agents — Testing & Validation

| Agent | Description |
|---|---|
| `tdd-london-swarm` | TDD London School specialist for mock-driven development within swarm coordination |
| `production-validator` | Production validation specialist ensuring applications are fully implemented and deployment-ready |
| `agentic-payments` | Multi-agent payment authorization specialist for autonomous AI commerce with cryptographic verification and Byzantine consensus |

---

### Skills

#### Claude Code Built-in Skills

| Skill | Invoke | Description |
|---|---|---|
| `keybindings-help` | `/keybindings-help` | Customize keyboard shortcuts and chord bindings in `~/.claude/keybindings.json` |
| `simplify` | `/simplify` | Review recently changed code for quality and efficiency, then fix issues found |
| `loop` | `/loop` | Run a prompt or slash command on a recurring interval (e.g. `/loop 5m /foo`) |
| `claude-api` | `/claude-api` | Build applications with the Claude API or Anthropic SDK |

#### Ruflo Skills — AgentDB & Vector Search

| Skill | Invoke | Description |
|---|---|---|
| `agentdb-advanced` | `/agentdb-advanced` | Master advanced AgentDB features including QUIC synchronization, multi-database management, custom distance metrics, hybrid search, and distributed systems integration |
| `agentdb-learning` | `/agentdb-learning` | Create and train AI learning plugins with AgentDB's 9 reinforcement learning algorithms |
| `agentdb-memory-patterns` | `/agentdb-memory-patterns` | Implement persistent memory patterns for AI agents using AgentDB including session memory, long-term storage, pattern learning, and context management |
| `agentdb-optimization` | `/agentdb-optimization` | Optimize AgentDB performance with quantization, HNSW indexing, caching, and batch operations |
| `agentdb-vector-search` | `/agentdb-vector-search` | Implement semantic vector search with AgentDB for intelligent document retrieval, similarity matching, and context-aware querying |

#### Ruflo Skills — ReasoningBank & Learning

| Skill | Invoke | Description |
|---|---|---|
| `reasoningbank-agentdb` | `/reasoningbank-agentdb` | Implement ReasoningBank adaptive learning with AgentDB's 150x faster vector database including trajectory tracking, verdict judgment, memory distillation, and pattern recognition |
| `reasoningbank-intelligence` | `/reasoningbank-intelligence` | Implement adaptive learning with ReasoningBank for pattern recognition, strategy optimization, and continuous improvement |

#### Ruflo Skills — Swarm Orchestration

| Skill | Invoke | Description |
|---|---|---|
| `swarm-orchestration` | `/swarm-orchestration` | Orchestrate multi-agent swarms with agentic-flow for parallel task execution, dynamic topology, and intelligent coordination |
| `swarm-advanced` | `/swarm-advanced` | Advanced swarm orchestration patterns for research, development, testing, and complex distributed workflows |
| `sparc-methodology` | `/sparc-methodology` | SPARC comprehensive development methodology with multi-agent orchestration covering all five phases |
| `stream-chain` | `/stream-chain` | Stream-JSON chaining for multi-agent pipelines, data transformation, and sequential workflows |
| `verification-quality` | `/verification-quality` | Comprehensive truth scoring, code quality verification, and automatic rollback system with 0.95 accuracy threshold |

#### Ruflo Skills — GitHub Workflows

| Skill | Invoke | Description |
|---|---|---|
| `github-code-review` | `/github-code-review` | Comprehensive GitHub code review with AI-powered swarm coordination |
| `github-multi-repo` | `/github-multi-repo` | Multi-repository coordination, synchronization, and architecture management with AI swarm orchestration |
| `github-project-management` | `/github-project-management` | Comprehensive GitHub project management with swarm-coordinated issue tracking, project board automation, and sprint planning |
| `github-release-management` | `/github-release-management` | Comprehensive GitHub release orchestration with AI swarm coordination for automated versioning, testing, deployment, and rollback management |
| `github-workflow-automation` | `/github-workflow-automation` | Advanced GitHub Actions workflow automation with AI swarm coordination, intelligent CI/CD pipelines, and comprehensive repository management |

#### Ruflo Skills — Development Tools

| Skill | Invoke | Description |
|---|---|---|
| `browser` | `/browser` | Web browser automation with AI-optimized snapshots for claude-flow agents |
| `hooks-automation` | `/hooks-automation` | Automated coordination, formatting, and learning from Claude Code operations using intelligent hooks with MCP integration |
| `pair-programming` | `/pair-programming` | AI-assisted pair programming with multiple modes, real-time verification, quality monitoring, and comprehensive testing |
| `skill-builder` | `/skill-builder` | Create new Claude Code Skills with proper YAML frontmatter, progressive disclosure structure, and complete directory organization |

#### Ruflo Skills — Flow Nexus (cloud)

| Skill | Invoke | Description |
|---|---|---|
| `flow-nexus-neural` | `/flow-nexus-neural` | Train and deploy neural networks in distributed E2B sandboxes with Flow Nexus |
| `flow-nexus-platform` | `/flow-nexus-platform` | Comprehensive Flow Nexus platform management covering authentication, sandboxes, app deployment, payments, and challenges |
| `flow-nexus-swarm` | `/flow-nexus-swarm` | Cloud-based AI swarm deployment and event-driven workflow automation with Flow Nexus platform |

#### Ruflo Skills — V3 Implementation

| Skill | Invoke | Description |
|---|---|---|
| `v3-cli-modernization` | `/v3-cli-modernization` | CLI modernization and hooks system enhancement for claude-flow v3 with interactive prompts, command decomposition, and intelligent workflow automation |
| `v3-core-implementation` | `/v3-core-implementation` | Core module implementation for claude-flow v3 implementing DDD domains, clean architecture patterns, dependency injection, and modular TypeScript codebase |
| `v3-ddd-architecture` | `/v3-ddd-architecture` | Domain-Driven Design architecture for claude-flow v3 implementing modular, bounded context architecture with clean separation of concerns and microkernel pattern |
| `v3-integration-deep` | `/v3-integration-deep` | Deep agentic-flow@alpha integration implementing ADR-001, eliminating 10,000+ duplicate lines by building claude-flow as a specialized extension |
| `v3-mcp-optimization` | `/v3-mcp-optimization` | MCP server optimization and transport layer enhancement for claude-flow v3 with connection pooling, load balancing, and sub-100ms response times |
| `v3-memory-unification` | `/v3-memory-unification` | Unify 6+ memory systems into AgentDB with HNSW indexing for 150x-12,500x search improvements implementing ADR-006 and ADR-009 |
| `v3-performance-optimization` | `/v3-performance-optimization` | Achieve aggressive v3 performance targets including 2.49x-7.47x Flash Attention speedup, 150x-12,500x search improvements, and 50-75% memory reduction |
| `v3-security-overhaul` | `/v3-security-overhaul` | Complete security architecture overhaul for claude-flow v3 addressing critical CVEs and implementing secure-by-default patterns |
| `v3-swarm-coordination` | `/v3-swarm-coordination` | 15-agent hierarchical mesh coordination for v3 implementation orchestrating parallel execution across security, core, and integration domains |

#### Ruflo Skills — Slash Commands (from `.claude/commands/`)

These are invoked directly as slash commands in Claude Code. All installed by `ruflo init --full`.

| Skill | Category | Description |
|---|---|---|
| `/claude-flow-help` | Claude Flow | Show Claude Flow commands and usage reference |
| `/claude-flow-memory` | Claude Flow | Interact with the Claude Flow persistent memory system |
| `/claude-flow-swarm` | Claude Flow | Coordinate multi-agent swarms for complex parallel tasks |
| `/ruflo-setup` | Setup | Bootstrap or reconfigure Ruflo + Claude Flow in the current project |
| `/analysis:bottleneck-detect` | Analysis | Detect performance bottlenecks in code or workflows |
| `/analysis:performance-bottlenecks` | Analysis | Analyze and report performance bottleneck patterns |
| `/analysis:performance-report` | Analysis | Generate a formatted performance analysis report |
| `/analysis:token-efficiency` | Analysis | Optimize Claude API token usage in prompts and responses |
| `/analysis:token-usage` | Analysis | Report current token consumption and usage patterns |
| `/automation:auto-agent` | Automation | Automatically select and spawn the best agent for a task |
| `/automation:self-healing` | Automation | Create self-healing workflows that recover from failures |
| `/automation:session-memory` | Automation | Persist and restore cross-session agent memory |
| `/automation:smart-agents` | Automation | Smart agent auto-spawning based on task classification |
| `/automation:smart-spawn` | Automation | Intelligently spawn agents with task-appropriate configuration |
| `/automation:workflow-select` | Automation | Select the optimal workflow template for the current task |
| `/github:code-review` | GitHub | Perform AI-assisted code review on changed files |
| `/github:code-review-swarm` | GitHub | Deploy a swarm of agents for comprehensive automated code review |
| `/github:github-modes` | GitHub | Switch between GitHub workflow modes (PR, issue, release, etc.) |
| `/github:github-swarm` | GitHub | Orchestrate GitHub operations using a coordinated agent swarm |
| `/github:issue-tracker` | GitHub | Track and manage GitHub issues with AI coordination |
| `/github:issue-triage` | GitHub | Automatically triage and prioritize incoming GitHub issues |
| `/github:multi-repo-swarm` | GitHub | Coordinate changes across multiple repositories simultaneously |
| `/github:pr-enhance` | GitHub | Enhance an existing pull request with AI-generated improvements |
| `/github:pr-manager` | GitHub | Full pull request lifecycle management and review coordination |
| `/github:project-board-sync` | GitHub | Sync project state with GitHub Projects boards |
| `/github:release-manager` | GitHub | Orchestrate versioned software releases end-to-end |
| `/github:release-swarm` | GitHub | Automated release pipeline using coordinated agent swarms |
| `/github:repo-analyze` | GitHub | Deep analysis of a repository's structure, quality, and health |
| `/github:repo-architect` | GitHub | Design and optimize repository structure and organization |
| `/github:swarm-issue` | GitHub | Convert GitHub issues into coordinated multi-agent tasks |
| `/github:swarm-pr` | GitHub | Manage pull request lifecycle with swarm agent coordination |
| `/github:sync-coordinator` | GitHub | Synchronize versions and dependencies across repositories |
| `/github:workflow-automation` | GitHub | Create and optimize GitHub Actions CI/CD pipelines |
| `/hooks:overview` | Hooks | Overview of the Claude Code hooks system and available hooks |
| `/hooks:pre-edit` | Hooks | Configure pre-edit hook for context injection before file edits |
| `/hooks:post-edit` | Hooks | Configure post-edit hook to record and learn from edit outcomes |
| `/hooks:pre-task` | Hooks | Configure pre-task hook for agent suggestions and risk checks |
| `/hooks:post-task` | Hooks | Configure post-task hook for learning and pattern storage |
| `/hooks:session-end` | Hooks | Configure session-end hook for state persistence |
| `/hooks:setup` | Hooks | Set up and configure the full ruv-swarm hooks system |
| `/monitoring:agent-metrics` | Monitoring | Display real-time metrics for all active agents |
| `/monitoring:agents` | Monitoring | List all active agents and their current status |
| `/monitoring:real-time-view` | Monitoring | Live dashboard view of swarm activity and performance |
| `/monitoring:status` | Monitoring | Check overall coordination and swarm health status |
| `/monitoring:swarm-monitor` | Monitoring | Continuous monitoring and alerting for swarm operations |
| `/optimization:auto-topology` | Optimization | Automatically select the optimal swarm topology for the task |
| `/optimization:cache-manage` | Optimization | Manage and optimize the pattern and response cache |
| `/optimization:parallel-execute` | Optimization | Execute independent tasks in parallel across multiple agents |
| `/optimization:parallel-execution` | Optimization | Configure and run parallel task execution workflows |
| `/optimization:topology-optimize` | Optimization | Optimize swarm topology based on current workload profile |
| `/sparc:sparc` | SPARC | SPARC orchestrator — break down large objectives into delegated phases |
| `/sparc:spec-pseudocode` | SPARC | Write full specification and pseudocode for a feature or system |
| `/sparc:architect` | SPARC | Design system architecture with component breakdown and ADRs |
| `/sparc:code` | SPARC | Generate clean, modular code from pseudocode and architecture |
| `/sparc:tdd` | SPARC | Test-Driven Development mode with red-green-refactor cycle |
| `/sparc:debug` | SPARC | Diagnose and fix runtime bugs, logic errors, and failures |
| `/sparc:security-review` | SPARC | Static and dynamic security audit with vulnerability reporting |
| `/sparc:docs-writer` | SPARC | Write concise Markdown documentation for APIs and systems |
| `/sparc:devops` | SPARC | Automate infrastructure deployment and CI/CD management |
| `/sparc:integration` | SPARC | Merge multi-phase outputs into a working production system |
| `/sparc:mcp` | SPARC | Integrate external MCP tools and services into a workflow |
| `/sparc:optimizer` | SPARC | Refactor and modularize code for performance and maintainability |
| `/sparc:ask` | SPARC | Task formulation guide for delegating to the right agent |
| `/sparc:tutorial` | SPARC | Interactive SPARC onboarding and guided walkthrough |

---

## How Agents and Skills Are Invoked

Agents and skills are fundamentally different mechanisms. One spawns a subprocess; the other expands a prompt.

---

### Agents

An agent is an **autonomous subprocess** — it gets its own context window, its own tool permissions, and runs independently from the conversation that spawned it.

#### Three ways agents are invoked

**1. Claude decides automatically**

When Claude encounters a task that matches an agent's `description:` field (from its `.claude/agents/` YAML frontmatter), it may spawn one without being asked. The description is the routing signal.

**2. You request one explicitly**

```
use the security-architect agent to audit src/auth/
spawn a tester agent for the payment module
```

Claude calls the `Agent` tool internally with the matching `subagent_type`.

**3. Ruflo swarm spawning (CLI or Task tool)**

```bash
ruflo agent spawn -t coder --name my-coder
```

In a swarm, agents are spawned in parallel via Claude Code's `Agent` tool, each receiving a full prompt with their instructions and tool list. They run concurrently and report results back to the orchestrator.

#### Agent lifecycle

```
Spawned → Runs its prompt autonomously → Returns one result message → Terminated
```

---

### Skills

A skill is **a prompt template** — it gets loaded into the *current* conversation as detailed instructions. No subprocess is created. Claude reads the skill content and acts on it within the same context window.

#### Two ways skills are invoked

**1. Slash command — typed by you**

```
/commit
/ruflo-setup
/sparc:tdd
/github:code-review
```

Claude Code resolves the slash command to the skill's Markdown file and injects its content as the task instructions for that turn.

**2. Claude triggers one automatically**

When a skill defines trigger conditions in its frontmatter (`TRIGGER when:`), Claude calls the `Skill` tool itself before responding. For example, the `claude-api` skill triggers automatically when it detects `import anthropic` in code you share.

---

### Side-by-Side Comparison

| | Agent | Skill |
|---|---|---|
| **What it is** | Subprocess with its own context window | Prompt template injected into the current context |
| **Invoked by** | `Agent` tool internally, or `ruflo agent spawn` CLI | Slash command `/name`, or `Skill` tool triggered automatically |
| **Runs where** | Separate context window, isolated | Same conversation, same context window |
| **Parallelism** | Yes — multiple agents run concurrently | No — one skill per turn |
| **Tool access** | Controlled by agent YAML `tools:` list | Same tools as the current conversation |
| **Defined in** | `.claude/agents/**/*.md` or `.yaml` | `.claude/skills/**/SKILL.md` or `.claude/commands/*.md` |
| **Returns** | One result message back to the spawner | Continues the conversation with expanded instructions |
| **Best for** | Long-running, isolated, parallel work | Workflow shortcuts and reusable multi-step procedures |
| **Source: Claude** | `general-purpose`, `Explore`, `Plan`, `statusline-setup`, `claude-code-guide` | `keybindings-help`, `simplify`, `loop`, `claude-api` |
| **Source: Ruflo** | All 80+ agents in `.claude/agents/` | All 33 skills + 65 slash commands in `.claude/skills/` and `.claude/commands/` |

---

### Mental Model

> **Skill** = "here are my detailed instructions for this task" — Claude reads it and does the work itself in the current conversation.
>
> **Agent** = "go do this task independently and come back with the answer" — Claude delegates to a subprocess and waits for the result.

A skill can instruct Claude to spawn agents. For example, `/swarm-orchestration` is a skill whose content tells Claude to initialize a swarm and spawn multiple parallel agents. **The skill is the recipe; the agents do the cooking.**
