# ADR-006: Three-Tier Model Routing (Policy Declaration)

**Status:** Accepted — partially implemented  
**Date:** 2026-03-31  
**Deciders:** Mario Jauvin  
**Supersedes:** —  
**Superseded by:** —  
**Originally referenced as:** ADR-026 in `CLAUDE.md`

---

## Context

Claude Code agent tasks vary enormously in computational complexity and cost. Simple transforms (rename a variable, add a type annotation) require no LLM reasoning. Moderate tasks (write a test, format output) can be handled by a fast, cheap model. Complex tasks (design an architecture, security review, multi-step reasoning) warrant a full-capability model.

Without routing, every task defaults to the most capable (and most expensive) model, wasting latency and cost budget on trivial operations.

The governance document `CLAUDE.md` declares a three-tier hierarchy as a normative constraint for this project and its downstream consumers.

---

## Decision

Adopt a three-tier model routing policy:

| Tier | Handler | Target Latency | Relative Cost | Trigger Condition |
|------|---------|---------------|---------------|-------------------|
| 1 | Agent Booster (WASM) | < 1 ms | $0 | Simple transforms; no LLM needed |
| 2 | Haiku | ~ 500 ms | Low | Low-complexity tasks (< 30% complexity score) |
| 3 | Sonnet / Opus | 2–5 s | High | Complex reasoning, architecture, security (≥ 30%) |

Before spawning any agent, check for `[AGENT_BOOSTER_AVAILABLE]` or `[TASK_MODEL_RECOMMENDATION]` signals. Use the Edit tool directly when the booster is available.

### Current implementation state

The `UserPromptSubmit` hook calls `.claude/helpers/router.js`, which routes by keyword pattern to an **agent type** (coder, tester, architect, etc.). This is Tier 3 routing only — the router does not currently emit tier-1 or tier-2 signals, nor does it produce a `[TASK_MODEL_RECOMMENDATION]` output.

Tier 1 (WASM booster) and Tier 2 (Haiku) selection are deferred to the downstream `claude-flow` and `ruflo` infrastructure installed by this tool.

---

## Consequences

**Positive:**
- The policy is declared in `CLAUDE.md` and enforced as a normative directive to the AI agent operating in this project.
- The routing hook provides agent-type recommendations on every prompt, enabling downstream infrastructure to act on them.
- The three-tier hierarchy reduces cost and latency for the majority of tasks that are handled by Tier 1 or Tier 2.

**Negative:**
- The tier-1/tier-2 selection is not mechanically enforced in this repository's `router.js`. It relies on downstream infrastructure and AI agent compliance with the `CLAUDE.md` policy.
- The compliance checker (`adr-compliance.sh`) does not track this ADR. It was originally numbered ADR-026 in an external ADR set and is not covered by the ten ADRs in the compliance script.

**Risks:**
- Without a `[TASK_MODEL_RECOMMENDATION]` signal from `router.js`, downstream consumers cannot automatically act on the tier policy. This is the most significant implementation gap (see Recommendation R6 in `docs/research/governance.md`).

---

## Implementation Gap — Next Steps

To close the gap between policy and mechanism:
1. `router.js` `routeTask()` should assess task complexity and append a `[TASK_MODEL_RECOMMENDATION: tier=N]` token to its JSON output.
2. The `hook-handler.cjs` `route` handler should echo this token so Claude Code can detect it.
3. Add ADR-006 to `adr-compliance.sh`'s check list.

See `docs/plan/implementation-plan.md` Sprint 2 for the planned implementation.

---

## Alternatives Considered

### Flat routing — always use Sonnet/Opus
Rejected. Wastes cost and latency on trivial tasks.

### Let the AI agent self-select model tier
Partially implemented via `CLAUDE.md` policy directive. Insufficient on its own because it depends on the agent reading and following the policy without mechanical reinforcement.

### Full tier selection in `router.js`
The target state. Not implemented yet due to the complexity of reliable complexity estimation from task text alone. Deferred to Sprint 2.

---

## Related

- `CLAUDE.md` — Three-Tier Model Routing table and `[AGENT_BOOSTER_AVAILABLE]` guidance
- `.claude/helpers/router.js` — current partial implementation
- `.claude/helpers/hook-handler.cjs` — `route` handler
- `docs/research/governance.md` § 3.1, § 5.3, § 6.5
- `docs/plan/implementation-plan.md` Sprint 2
