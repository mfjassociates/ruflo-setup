# Sample Downstream Project — DDD-Structured Task API

A concrete example of a project bootstrapped with `ruflo-setup` and built out with DDD structure, showing the exact commands, prompts, skills, and agents involved at each step.

---

## Step 1 — Bootstrap the project

```bash
mkdir my-task-api && cd my-task-api
git init
ruflo-setup
```

This installs `.claude/`, `.mcp.json`, hooks, CLAUDE.md. Nothing DDD-specific yet.

---

## Step 2 — Initialize the ruflo swarm

```bash
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 8 --strategy specialized
```

---

## Step 3 — Scaffold DDD structure via agents

Inside Claude Code chat:

```
/sparc architect "Design a Task Management API with bounded contexts for
task-execution, session-management, and agent-lifecycle. Use TypeScript,
event sourcing, Vitest."
```

This invokes the `sparc-orchestrator` → `architecture` agent, which creates:

```
src/domains/task-execution/
src/domains/session-management/
src/domains/agent-lifecycle/
src/shared-kernel/
```

---

## Step 4 — Implement domain by domain (TDD London School)

```
/sparc tdd "Implement TaskAggregate in task-execution bounded context
with mock-first tests"
```

Invokes `tdd-london-swarm` agent → writes `TaskAggregate.ts` and `TaskAggregate.test.ts` with mocked collaborators first.

```
/sparc coder "Implement TaskRepository interface and InMemoryTaskRepository
for task-execution"
```

---

## Step 5 — Governance checks now produce real output

At this point, run manually or wait for the post-edit hook (once Sprint 1 of the implementation plan is complete):

```bash
bash .claude/helpers/ddd-tracker.sh force
# ✓ DDD: 60% | Domains: 3/5 | Entities: 4 | Services: 6 | Aggregates: 2

bash .claude/helpers/adr-compliance.sh force
# ✓ ADR Compliance: 78% | Compliant: 8/10
```

Now the scripts find real things: `src/domains/` exists, `.ts` files match `class.*Aggregate`, `interface.*Repository`, `class.*Event`, and `vitest` is in `package.json`.

---

## Step 6 — Ongoing development loop

```
/sparc code "Add CreateTaskCommand handler in task-execution application layer"
/sparc security-review "Audit task-execution domain for input validation"
/code-review-swarm
```

The `/code-review-swarm` skill spawns 3–5 reviewer agents in parallel. The `ddd-domain-expert` agent enforces ubiquitous language, the `adr-architect` agent flags violations, and the `tdd-london-swarm` keeps tests mock-first throughout.

---

## Why governance scripts produce real output here

This downstream project has what `ruflo-setup` intentionally does not:

| What the scripts look for | Present in downstream project | Present in ruflo-setup |
|--------------------------|-------------------------------|------------------------|
| `src/domains/<name>/` directories | Yes | No (by design — see ADR-001) |
| TypeScript files matching `class.*Aggregate` etc. | Yes | No |
| `vitest` in `package.json` (ADR-008) | Yes | No (uses `node:test`) |
| `@claude-flow/mcp` wired as dependency (ADR-005) | Yes | No |
| `agentic-flow` imports (ADR-001) | Yes | No |

`ruflo-setup` is the tool that creates this environment — it is not itself a consumer of it. See `docs/adr/ADR-001-procedural-cli-architecture.md`.

---

## Related

- `docs/ddd/bounded-context-map.md` — the 5 canonical bounded contexts and their DDD artefacts
- `docs/ddd/domain-taxonomy.md` — canonical domain names used by governance scripts
- `docs/plan/implementation-plan.md` — Sprint 1 wires governance scripts into post-edit hook
- `docs/research/governance.md` — full evaluation of governance posture
