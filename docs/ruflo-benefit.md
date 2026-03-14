# Ruflo: Complete Feature Enablement & Deep Dive

> Research date: 2026-03-14
> Source: ruvnet/ruflo (GitHub), ruvnet/claude-flow (GitHub), local codebase analysis

---

## Table of Contents

1. [What Ruflo Is](#what-ruflo-is)
2. [Complete Feature List](#complete-feature-list)
3. [Where Everything Runs](#where-everything-runs)
4. [Step-by-Step Enablement](#step-by-step-enablement)
5. [MinCut, RuVector, and RVF Deep Dive](#mincut-ruvector-and-rvf-deep-dive)
6. [Full Before/After: What the Combined Stack Changes](#full-beforeafter)
7. [Sources](#sources)

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
