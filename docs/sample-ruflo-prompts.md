# Sample RuFlo Prompts

Source: https://flo.ruv.io/

---

## Quick-Start Prompts (Chat Input Chips)

These appear as clickable chips above the chat input on the home screen.

### 1. Spawn a coding swarm

```
Spawn a hierarchical swarm with 5 agents (architect, coder, tester, reviewer, security-auditor) to refactor a Python CLI tool to TypeScript. Use ruflo__swarm_init then ruflo__agent_spawn for each role.
```

**Follow-ups:**
- *Show progress:* `Use ruflo__progress_summary to show the swarm's current state.`
- *Add tests:* `Spawn a tester agent to write integration tests for the swarm output.`

---

### 2. Save & recall memory

```
Use ruflo__memory_store to save: namespace='preferences', key='editor_theme', value='solarized-dark'. Then ruflo__memory_search query='theme' to verify.
```

**Follow-ups:**
- *List entries:* `List all entries in the 'preferences' namespace using ruflo__memory_list.`
- *Semantic search:* `Find related memories with ruvector__hooks_recall query='editor settings'.`

---

### 3. Route a task

```
Use ruvector__hooks_route on the task: 'add OAuth2 to a SvelteKit API'. Tell me which agent type and topology you'd recommend.
```

**Follow-ups:**
- *Spawn the agent:* `Spawn the recommended agent with ruflo__agent_spawn.`
- *Track trajectory:* `Begin a trajectory with ruvector__hooks_trajectory_begin to record the work.`

---

### 4. Analyze a diff

```
Use ruflo__analyze_diff to assess risk and ruflo__analyze_diff-reviewers to suggest reviewers for the PR at github.com/ruvnet/ruflo/pull/1687.
```

**Follow-ups:**
- *Repo metrics:* `Get repository metrics with ruflo__github_repo_analyze for ruvnet/ruflo.`
- *Open issues:* `List recent issues with ruflo__github_issue_track for ruvnet/ruflo.`

---

### 5. System health check

```
Run ruflo__system_status, ruflo__performance_metrics, and ruflo__performance_bottleneck. Summarize anything concerning.
```

**Follow-ups:**
- *Optimize:* `Use ruflo__performance_optimize on the slowest component identified.`
- *Benchmark:* `Run ruflo__performance_benchmark with --suite=all.`

---

### 6. Browse WASM gallery

```
Show me the templates in the WASM gallery (browser-side rvagent server) and explain what each one does.
```

**Follow-ups:**
- *Load a template:* `Load the most popular template into the local WASM MCP server.`

---

### 7. Plan with GOAP

```
Use the goal-planner pattern: I want to migrate a Postgres schema with zero downtime. Decompose into ruflo agents and tasks.
```

**Follow-ups:**
- *Risk analysis:* `Run ruflo__analyze_file-risk on the migration file.`

---

### 8. Train neural pattern

```
Use ruvector__neural_train to learn from this successful pattern: 'JWT auth with refresh tokens — store refresh in httpOnly cookie, access in memory'.
```

**Follow-ups:**
- *Predict:* `Use ruvector__neural_predict for the task 'add session-based auth'.`

---

## Conceptual / Exploratory Prompts

A second set of prompts found on the page — these focus on understanding RuFlo concepts rather than directly invoking MCP tools.

### 1. Build a coding swarm

```
Design a 5-agent coding swarm to refactor a Python CLI to TypeScript. Suggest topology, roles, and the order each agent should run.
```

**Follow-ups:**
- *Add tests:* `Add a tester agent and a security-auditor. What should each one own?`
- *Trade-offs:* `Compare hierarchical vs mesh topology for this swarm.`
- *Failure mode:* `What happens if the architect agent fails halfway through?`

---

### 2. Memory & recall

```
Explain how RuFlo's persistent memory works across sessions, and give me a 3-step example of saving a preference and recalling it later.
```

**Follow-ups:**
- *Namespaces:* `When should I use separate memory namespaces vs one shared namespace?`
- *Vector vs key:* `When should I use semantic search vs exact key retrieval?`

---

### 3. Plan a migration

```
Plan a zero-downtime Postgres schema migration. Use Goal-Oriented Action Planning to break it into phases with rollback points.
```

**Follow-ups:**
- *Risk scoring:* `Which phases are highest-risk and how would you mitigate them?`
- *Verification:* `How would you verify each phase before proceeding?`

---

### 4. Review a diff

```
What signals would you use to risk-score a code diff (size, files touched, hot paths) and how would you suggest reviewers?
```

**Follow-ups:**
- *Auto-classify:* `Classify a diff as feature/bugfix/refactor/docs from its file mix and message.`
- *Security focus:* `Which patterns in a diff should trigger a security review?`

---

### 5. Explain HNSW

```
Explain HNSW vector indexing in plain language, and why it's 150x-12,500x faster than brute-force similarity search at scale.
```

**Follow-ups:**
- *Quantization:* `What does Int8 quantization buy you, and what's the trade-off?`
- *Use case:* `When would you reach for HNSW vs a relational keyword index?`

---

### 6. Choose a topology

```
I have 12 agents to coordinate on a multi-step refactor. Compare hierarchical, mesh, hierarchical-mesh, and adaptive topologies — pick one and explain why.
```

**Follow-ups:**
- *Anti-drift:* `What's 'anti-drift' coordination and why does it matter for >8 agents?`
- *Consensus:* `Compare Raft, Byzantine, gossip, and CRDT consensus for this swarm.`

---

### 7. Track a long task

```
I'm starting a 4-week migration. How should I structure horizon tracking, milestone checkpoints, and drift detection in RuFlo?
```

**Follow-ups:**
- *Resume after break:* `What state should be persisted so I can resume next week?`

---

### 8. Local WASM tools

```
What's the difference between the in-browser WASM MCP server and the cloud bridge MCP servers? When should I use each?
```

**Follow-ups:**
- *Privacy:* `Which tools never leave my browser?`
- *Offline:* `What can RuFlo still do if my network drops?`
