# Ruflo Init Questions

## 1. What is the purpose of initializing memory? What happens if you do not?

Creates the local database files used to store agent memory (key-value entries, vector embeddings, HNSW index). Without it, any command that tries to read or write memory will either fail or auto-initialize on demand (slower). You can skip it if you never use memory features. It writes to `.claude-flow/memory/` in your project directory (or the user data dir if no project).

## 2. What is the purpose of starting the daemon? What happens if you do not?

Launches 12 background workers (audit, optimize, consolidate, testgaps, map, etc.) as persistent processes. Without it, those workers never run — no background security audits, no performance optimizations, no continuous codebase mapping. All foreground CLI commands still work; you just lose the continuous background intelligence layer. It's optional for basic usage.

## 3. What is the purpose of initializing ONNX embeddings with hyperbolic support? What happens if you do not?

Configures the `all-MiniLM-L6-v2` (or `all-mpnet-base-v2`) sentence embedding model used for **semantic memory search** — finding stored memories by meaning rather than exact key match. The "hyperbolic" part (Poincaré ball model) improves search quality for hierarchical data like code structures and agent trees.

Without it: `memory search --query "..."` falls back to exact/keyword matching. The `ruflo memory stats` backend will still show `sql.js + HNSW` but semantic similarity search won't produce meaningful results. Loading ONNX eagerly also causes a process hang; see [PR #1441](https://github.com/ruvnet/ruflo/pull/1441) and [issue #1453](https://github.com/ruvnet/ruflo/issues/1453).

## 4. What is the purpose of initializing for OpenAI Codex? What happens if you do not?

Sets up the dual-mode orchestration config so ruflo can spawn **Codex workers in parallel** alongside Claude workers. It creates `.codex/` config files and installs the `@claude-flow/codex` package bridge.

Without it: all agents are Claude-only. You lose the parallel Claude + Codex collaboration (dual-mode templates: `feature`, `bugfix`, `security`, `refactor`). Completely optional — only needed if you have an OpenAI API key and want to run Codex workers alongside Claude.
