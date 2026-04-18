# Ruflo Memory System — Explained for Dummies

## The Problem

Claude Code (the AI assistant) has **no built-in long-term memory**. Each conversation starts fresh. It can't remember your preferences, past decisions, or project context from last week.

Think of it like this:

- **Claude Code** = a smart person with amnesia
- **Ruflo's memory system** = a notebook they write in before forgetting, and read when they wake up

## The Three Packages

Ruflo's memory system is built from three npm packages, each with a distinct job:

| Package | What it does | Analogy |
|---------|-------------|---------|
| `@claude-flow/cli` | Stores and retrieves memories in a SQLite database | The filing cabinet |
| `@ruvector/core` | Provides fast HNSW vector search over those memories | The index tabs in the filing cabinet |
| `ruvector` | Turns text into numbers (embeddings) so search can work by meaning | The librarian who understands what you're looking for |

All three are optional — the system degrades gracefully if any are missing.

## How It Gets Wired In

### Step 1: Settings (`.claude/settings.json`)

Everything starts with Claude Code's **hooks** — shell commands that run automatically at specific moments. Ruflo registers these in `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [
        {
          "type": "command",
          "command": "node .claude/helpers/auto-memory-hook.mjs import",
          "timeout": 8000
        }
      ]
    }],
    "Stop": [{
      "hooks": [
        {
          "type": "command",
          "command": "node .claude/helpers/auto-memory-hook.mjs sync",
          "timeout": 10000
        }
      ]
    }]
  }
}
```

The memory-related settings are under `claudeFlow.memory`:

```json
{
  "claudeFlow": {
    "memory": {
      "backend": "hybrid",
      "enableHNSW": true,
      "learningBridge": { "enabled": true },
      "memoryGraph": { "enabled": true },
      "agentScopes": { "enabled": true }
    }
  }
}
```

### Step 2: Hooks (when things happen automatically)

| When | Hook fires | What it does |
|------|-----------|-------------|
| **You start a conversation** | `auto-memory-hook.mjs import` | Reads your saved `.md` memory files and loads them into a searchable database |
| **Claude stops responding** | `auto-memory-hook.mjs sync` | Writes new insights back to your `.md` memory files |
| **You type a message** | `hook-handler.cjs route` | Routes your task (decides complexity, suggests agent type) |
| **You edit a file** | `hook-handler.cjs post-edit` | Can learn patterns from your edits |
| **Session ends / compact** | `hook-handler.cjs session-end` | Saves session state for next time |

### Step 3: The Import Flow (what happens at session start)

```
YOU START A CONVERSATION
         |
         v
   SessionStart hook fires automatically
         |
         v
   auto-memory-hook.mjs "import"
         |
         v
   Reads ~/.claude/projects/*/memory/*.md
   (your saved memories from past sessions)
         |
         v
   Stores entries in .claude-flow/data/auto-memory-store.json
         |
         v  (if @claude-flow/memory package is available)
   Converts text -> 384-dimensional vectors
   using the ONNX neural model (all-MiniLM-L6-v2)
         |
         v
   NOW CLAUDE CAN SEARCH MEMORIES SEMANTICALLY
   (not just keyword match, but "find memories ABOUT authentication"
    even if the word "authentication" isn't in them)
```

## Where RuVector Fits

RuVector does **two separate jobs** in the memory system:

### Job 1: The Embedder (turning words into numbers)

When you store something like `"user prefers pnpm over npm"`, that text needs to become a list of numbers (a "vector") so the system can find it later by meaning, not just keywords.

The `ruvector` package provides an **ONNX neural model** (all-MiniLM-L6-v2) that does this conversion. But it's **not the only option** — there's a priority chain of fallbacks. The system tries each one in order until something works:

| Priority | Package | Dimensions | Notes |
|----------|---------|-----------|-------|
| 1 | AgentDB v3 bridge | varies | If the full AgentDB bridge is installed |
| 2 | `@xenova/transformers` | 384 | Standalone ONNX runtime |
| 3 | `agentic-flow/reasoningbank` | 768 | Part of agentic-flow |
| 4 | **`ruvector` ONNX embedder** | 384 | Bundled MiniLM-L6-v2 |
| 5 | `agentic-flow` core | 768 | Legacy fallback |
| 6 | Hash-based fallback | 128 | No AI, just math — last resort |

The embedding vectors are stored as a column **inside `.swarm/memory.db`** (the same SQLite database that holds the text):

```sql
-- Each memory entry row has these embedding columns:
embedding TEXT,               -- the vector as JSON: [0.023, -0.156, ...]
embedding_dimensions INTEGER, -- e.g. 384
embedding_model TEXT          -- 'onnx', 'ruvector/onnx', etc.
```

No separate file — embeddings live right next to the text.

### Job 2: The HNSW Index (fast vector search)

When you have thousands of memory entries, comparing your search query against every single vector is slow. HNSW (Hierarchical Navigable Small World) is a data structure that makes this fast — instead of checking all entries, it narrows down to the best matches in about 1ms.

`@ruvector/core` provides the `VectorDb` class that builds this index:

```typescript
const { VectorDb } = await import('@ruvector/core');

const db = new VectorDb({
  dimensions: 384,
  distanceMetric: 'Cosine',
  storagePath: '.swarm/hnsw.index'
});
```

This writes to two separate files:

| File | Contents |
|------|----------|
| `.swarm/hnsw.index` | The HNSW search tree (binary, from `@ruvector/core`) |
| `.swarm/hnsw.metadata.json` | Maps index entries back to memory keys/namespaces |

### Full picture of `.swarm/` directory

```
.swarm/
  memory.db            <-- SQLite: all memories + their embedding vectors
  hnsw.index           <-- @ruvector/core: fast search tree over vectors
  hnsw.metadata.json   <-- maps HNSW entries to memory.db rows
```

## The Search Flow

When you run `ruflo memory search --query "auth patterns"`:

```
1. Your query "auth patterns"
       |
       v
2. Embedding model turns it into [0.12, -0.34, 0.56, ...]
   (ruvector, xenova, or whatever is available)
       |
       v
3. HNSW index (@ruvector/core VectorDb) finds the
   nearest vectors in ~1ms instead of scanning all entries
       |
       v
4. Returns the matching memory entries from memory.db
```

## When Is Memory Used?

| When | How |
|------|-----|
| **Session start** | Hook loads previous memories so Claude has context |
| **Every conversation** | `MEMORY.md` index is loaded into Claude's system prompt automatically |
| **Explicit search** | `ruflo memory search --query "..."` via CLI or MCP tools |
| **Agent coordination** | Swarm agents share state through the same memory backend |
| **Session end / Stop** | New insights are written back for next time |
| **Cross-project** | `auto-memory-hook.mjs import-all` imports memories from ALL Claude Code projects |

## What Are the Benefits?

| Without ruflo memory | With ruflo memory |
|---------------------|-------------------|
| Claude forgets everything between sessions | Claude remembers preferences, decisions, project context |
| Can only search files by exact text | Can search by meaning ("find auth-related memories") |
| Each session is isolated | Sessions build on each other |
| Agents can't share knowledge | Agents coordinate through shared memory |
| No learning from past work | SONA learns patterns from successful/failed approaches |

## The Fallback Chain

If the full stack isn't available, the system degrades gracefully:

```
Best:   RuVector ONNX -> AgentDB SQLite -> HNSW vector search (semantic, ~1ms)
OK:     @claude-flow/memory -> JSON file backend (basic key-value, no semantic search)
Bare:   Claude Code's built-in ~/.claude/projects/*/memory/*.md (just markdown files)
```

You can tell which level you're running at from the session start output:

- `"Imported N entries... Vectorized N entries into AgentDB"` = full stack
- `"Imported N entries"` (no vectorized line) = JSON backend only
- `"Memory package not available -- skipping"` = bare mode (just `.md` files)

## How to Initialize Memory

```bash
# Initialize the SQLite database for the current project
ruflo memory init

# With verbose output to see which embedding model loads
ruflo memory init --verbose --force

# Store something
ruflo memory store --key "my-preference" --value "I prefer pnpm" --namespace patterns

# Search by meaning (not just keywords)
ruflo memory search --query "package manager preferences"

# List all entries
ruflo memory list
```

`ruflo memory init` creates `.swarm/memory.db` in your **current project directory only**. Each project gets its own isolated database.

## Troubleshooting

### Which embedding fallback is active?

```bash
ruflo memory init --verbose --force
```

The output shows which model loaded (e.g., `ruvector/onnx (384-dim)`).

### Check which packages are resolvable

```bash
node -e "import('@ruvector/core').then(m => console.log('ruvector/core: OK')).catch(() => console.log('ruvector/core: NOT FOUND'))"
node -e "import('ruvector').then(m => console.log('ruvector: OK')).catch(() => console.log('ruvector: NOT FOUND'))"
node -e "import('@xenova/transformers').then(() => console.log('@xenova/transformers: OK')).catch(() => console.log('@xenova/transformers: NOT FOUND'))"
```

That tells you which fallback will be used before you even run a command. The priority order from the code is:

1. AgentDB v3 bridge
2. `@xenova/transformers` (384-dim)
3. `agentic-flow/reasoningbank` (768-dim)
4. `ruvector` ONNX embedder (384-dim)
5. `agentic-flow` core (768-dim)
6. Hash-based fallback (128-dim, no semantic understanding)

Whichever is the first one that resolves successfully wins.

### Check stored entries and their embedding model

```bash
ruflo memory list --format json
```

Each entry has an `embedding_model` field showing which provider generated its vector.

### Check memory bridge status

```bash
node .claude/helpers/auto-memory-hook.mjs status
```

Shows whether AgentDB, SONA, and the learning bridge are active.

## Key Source Files

| File | Purpose |
|------|---------|
| `.claude/settings.json` | Hook definitions that wire memory into session lifecycle |
| `.claude/helpers/auto-memory-hook.mjs` | Session start/end memory bridge script |
| `v3/@claude-flow/cli/src/memory/memory-initializer.ts` | Database init, embedding model loading, HNSW index |
| `v3/@claude-flow/cli/src/commands/memory.ts` | CLI memory subcommands (store, search, list, etc.) |
| `.claude-flow/config.yaml` | Optional config for learning bridge, memory graph, agent scopes |
