# RuFlo Enabled — Session Notes

**Date:** 2026-03-23
**Session ID:** 48bb7460-fa08-4589-a758-d0863b0eee31

---

## How to Know If You're Using All RuFlo Features

### Signals That RuFlo Is Active

1. **Startup hooks** fire on session start/resume (visible in system reminders):
   - `SessionStart:resume hook success` — hooks are running
   - `[INTELLIGENCE] Loaded X patterns, Y edges` — neural pattern matching active
   - `[TASK_MODEL_RECOMMENDATION]` or `[AGENT_BOOSTER_AVAILABLE]` — routing active

2. **Intelligence routing recommendations** appear before each task with agent, confidence, and model tier.

3. **MCP tools** — 200+ `mcp__claude-flow__*` tools are available (loaded via ToolSearch).

### Features: Automatic vs. On-Demand

| Feature | Activation |
|---------|-----------|
| Intelligence routing | Every prompt (automatic) |
| Hooks (pre-task, post-task, session) | Every task (automatic) |
| Pattern learning | After completed tasks (automatic) |
| Swarm orchestration | Complex multi-file tasks (you ask or auto-detect) |
| Agent teams | Requested or complexity-triggered |
| Memory / HNSW search | Context retrieval needed |
| Background workers | Requires daemon running |

### What Most People Miss

- **Daemon not running** — Start with `npx claude-flow@v3alpha daemon start`
- **Swarm not triggering** — Explicitly request for complex multi-file work
- **Memory not persisting** — Check `npx claude-flow@v3alpha memory search -q "recent"`
- **Plugins not installed** — `npx claude-flow@v3alpha plugins list`
- **Neural training not running** — `npx claude-flow@v3alpha neural status`

### Quick "Am I Using Everything?" Checklist

```bash
npx claude-flow@v3alpha doctor               # All systems healthy?
npx claude-flow@v3alpha daemon status        # Daemon running?
npx claude-flow@v3alpha hooks worker status  # Workers active?
npx claude-flow@v3alpha neural status        # Learning happening?
npx claude-flow@v3alpha plugins list         # Plugins installed?
npx claude-flow@v3alpha memory search -q "*" # Memory populated?
```

---

## Running RuFlo Status

```bash
npx claude-flow@v3alpha status
```

**Note:** If you see `[ERROR] RuFlo is not initialized in this directory`, it means the CLI can't find a ruflo project config in the current directory, even if `.claude/settings.json` exists. This is a known initialization detection issue — the MCP tools and hooks still work correctly via the MCP server.

### Status via MCP (always available)

Use the MCP tools directly instead of the CLI for status checks:

- `mcp__claude-flow__system_status` — overall system status
- `mcp__claude-flow__swarm_status` — active swarm status
- `mcp__claude-flow__mcp_status` — MCP server status
- `mcp__claude-flow__neural_status` — neural/learning status
- `mcp__claude-flow__system_health` — health check

---

## 3-Tier Model Routing

| Tier | Handler | Latency | Cost | Use Cases |
|------|---------|---------|------|-----------|
| 1 | Agent Booster (WASM) | <1ms | $0 | Simple transforms |
| 2 | Haiku | ~500ms | $0.0002 | Low complexity (<30%) |
| 3 | Sonnet/Opus | 2-5s | $0.003-0.015 | Complex reasoning (>30%) |
