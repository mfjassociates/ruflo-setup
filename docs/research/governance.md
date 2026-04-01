# ADR and DDD Governance Evaluation of the ruflo-setup Project

**Version:** 1.0  
**Date:** 2026-03-31  
**Evaluated Codebase:** `@mfjjs/ruflo-setup` v0.2.9  
**Evaluation Basis:** Static analysis of source files, helper scripts, configuration, and test suite

---

## Abstract

This document presents an academic evaluation of the `ruflo-setup` project against Architecture Decision Record (ADR) and Domain-Driven Design (DDD) governance standards. The project is a cross-platform Node.js CLI tool that installs and configures the Ruflo + Claude Flow V3 AI-assisted development toolchain. The evaluation examines six governance dimensions: ADR coverage, DDD adherence, security governance, hook-driven enforcement, 3-tier model routing, and test coverage. The central finding is that the project carries a substantial governance scaffold — most notably a comprehensive hook system wired into `.claude/settings.json`, dedicated helper scripts for ADR compliance and DDD tracking, and explicit declarations in the project configuration — but that the governance artefacts target a notional `v3/` and `src/domains/` architecture that does not yet exist within this repository. The result is a gap between declared intent and observable evidence: governance tooling is present and well-structured, but its preconditions are unmet. Scores and concrete recommendations follow.

---

## 1. Introduction

Architecture Decision Records and Domain-Driven Design represent two complementary disciplines for maintaining long-term architectural integrity in software systems. Michael Nygard's 2011 formulation of ADRs advocates capturing architecturally significant decisions in short, context-forward documents that survive personnel changes (Nygard, 2011). Eric Evans's foundational DDD work establishes bounded contexts, ubiquitous language, and rich domain models as defences against the "big ball of mud" antipattern (Evans, 2003). Vaughn Vernon later provided implementation guidance emphasising strategic design as the highest-leverage DDD activity (Vernon, 2013).

The `ruflo-setup` project occupies an unusual position: it is not an application domain in the classic DDD sense, but a deployment and configuration tool for an AI-assisted development platform. Its governance significance lies in two interrelated concerns. First, it installs governance artefacts into target projects (hooks, settings, agents, skills). Second, it is itself subject to governance norms embedded in `CLAUDE.md`, `.claude/settings.json`, and a suite of helper scripts under `.claude/helpers/`. Understanding how faithfully the project honours its own governance requirements is the primary focus of this evaluation.

---

## 2. Methodology

The evaluation was conducted entirely via static analysis of the repository at git commit `d0bfb17` (version 0.2.9). No runtime execution was performed. Artefact classes examined:

- **Source code** (`src/cli.js`, `src/setup.js`, `src/hooks.js`, `src/utils.js`, `src/status.js`)
- **Claude hook** (`claude-hooks/check-ruflo.cjs`) and **template** (`templates/ruflo-setup.md`)
- **Helper scripts** (`.claude/helpers/adr-compliance.sh`, `ddd-tracker.sh`, `validate-v3-config.sh`, `hook-handler.cjs`, `router.js`)
- **Configuration** (`package.json`, `.claude/settings.json`, `CLAUDE.md`)
- **Tests** (`tests/cli.test.mjs`) and **documentation** (`docs/`)

Each dimension was assessed against observable code evidence. Where a governance mechanism is configured but its target artefacts are absent, that discrepancy is noted explicitly.

---

## 3. ADR Governance Analysis

### 3.1 ADRs Referenced or Enforced

The project references ADR identifiers in two locations. `CLAUDE.md` cites **ADR-026** as the authority for the 3-tier model routing table (Agent Booster/WASM at <1ms, Haiku at ~500ms, Sonnet/Opus at 2–5s). The `.claude/helpers/adr-compliance.sh` script defines and checks ten ADRs identified as **ADR-001 through ADR-010**:

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

An eleventh decision, ADR-026 for 3-tier model routing, is documented in `CLAUDE.md` but not tracked by `adr-compliance.sh`. The numeric gap (ADR-011 through ADR-025) implies an external ADR repository whose artefacts are not present in this codebase.

### 3.2 Evidence of ADR Compliance in Source Code

**ADR-008 (Vitest over Jest)** is not applicable as written. The test runner is Node.js's native `node:test` module, not Vitest. `adr-compliance.sh` checks for a `vitest` entry in `package.json`; that check fails, yet the native runner is a legitimate choice that simply diverges from the ADR.

**ADR-005 (MCP-first API design)** is partially evidenced. The `toPlatformMcpConfig()` function generates MCP server registrations for `claude-flow`, `ruv-swarm`, and `flow-nexus`, and `status.js` has a dedicated Layer 3 for MCP server verification. This is the tooling *installing* an MCP-first system, not the MCP system itself.

**ADR-010 (Remove Deno support)** is trivially compliant: no Deno-specific code appears anywhere.

**ADR-001 through ADR-004 and ADR-006, ADR-007, ADR-009** all reference paths absent from this repository (`v3/`, `src/domains/`, domain-layered TypeScript packages). The compliance checks targeting those paths produce false-negative scores.

**ADR-026 (3-tier model routing)** is declared in `CLAUDE.md` and partially implemented in `router.js` and `hook-handler.cjs`. The module performs keyword-based task routing to agent types and is invoked on every `UserPromptSubmit` event. However, the three-tier latency hierarchy (Tier 1 WASM booster, Tier 2 Haiku, Tier 3 Sonnet/Opus) is not implemented here; actual model selection is deferred to the downstream claude-flow infrastructure.

### 3.3 The `adr-compliance.sh` Helper

The script at `.claude/helpers/adr-compliance.sh` is a well-structured Bash worker that throttles execution to once per 15 minutes, produces a structured JSON report at `.claude-flow/metrics/adr-compliance.json`, implements five active check functions (ADR-001, ADR-002, ADR-003, ADR-005, ADR-008), assigns hard-coded placeholder scores to the remaining five, and supports `run`, `check`, `force`, `status`, and `details` subcommands.

A critical observation is that this script is **not wired into the Claude Code hook system** defined in `.claude/settings.json`. The hook table covers `PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `SessionStart`, `SessionEnd`, `Stop`, `PreCompact`, `SubagentStart`, `SubagentStop`, and `Notification` — none of which invoke `adr-compliance.sh`. The script can be run manually or via daemon workers, but no automated trigger fires on code-change events.

### 3.4 Gaps in ADR Coverage

1. No ADR documents exist. The `adr.directory` setting points to `/docs/adr`, which does not exist.
2. ADR-026 (model routing) is not tracked by `adr-compliance.sh`.
3. The choice of Node's native test runner over Vitest is not captured in an ADR despite diverging from ADR-008.
4. The deliberate ESM/CJS interoperability strategy (`"type": "module"` with `.cjs` hooks) is not documented.

---

## 4. DDD Governance Analysis

### 4.1 Bounded Context Identification

The `ddd-tracker.sh` script targets five bounded contexts: `agent-lifecycle`, `task-execution`, `memory-management`, `coordination`, and `shared-kernel`. These are declared as the canonical `DOMAINS` array in the script and represent a plausible DDD decomposition of an AI agent orchestration platform.

No corresponding directories exist in the `ruflo-setup` repository under `v3/@claude-flow/` or `src/domains/`. The `validate-v3-config.sh` script checks for a `src/domains/` directory and lists five expected domain names (`task-management`, `session-management`, `health-monitoring`, `lifecycle-management`, `event-coordination`) — a different set from `ddd-tracker.sh`, which is itself a consistency gap between governance tools.

The actual source code of `ruflo-setup` does not follow a DDD layered structure. Instead it is a functional CLI application with four modules (`cli.js`, `setup.js`, `hooks.js`, `utils.js`, `status.js`) representing procedural orchestration rather than domain modelling. This is architecturally appropriate for a CLI setup tool but means DDD principles are not applied within this codebase.

### 4.2 Aggregate and Entity Design Evidence

No aggregate roots, entities, value objects, or domain events are present in `src/`. The `ddd-tracker.sh` script would count files matching patterns like `class.*Aggregate` or `class.*Entity`, and would find zero matches in this repository's TypeScript or JavaScript source files.

The closest analogue to a domain concept is the `McpConfig` structure produced by `toPlatformMcpConfig()`, but this is a plain data object returned from a pure function, not a DDD entity or value object with explicit identity or equality semantics.

### 4.3 Ubiquitous Language Consistency

The project's domain language is partially consistent. The term "hook" is used uniformly across `CLAUDE.md`, `src/hooks.js`, `claude-hooks/`, `.claude/settings.json`, and helper scripts. "Session" appears consistently in `SessionStart`, `SessionEnd`, and `session-restore`/`session-end` handler names. However, there is no ubiquitous language glossary, and terminology diverges in places: `check-ruflo` uses "configured" to mean `.mcp.json` or `.claude/settings.json` present, while `status.js` uses a layered readiness model with different semantics.

### 4.4 The `ddd-tracker.sh` Helper

The script checks six categories of DDD artefact via `grep` across TypeScript files: entities, value objects, aggregates, repositories, services, and domain events. It produces a JSON progress report and optionally updates a `v3-progress.json` file using `jq`. Like `adr-compliance.sh`, it is throttled (10-minute interval) and supports `run`, `check`, `force`, and `status` subcommands.

The script is similarly not wired into the Claude Code hook table. It would return a 0% progress score if run against this repository, because neither the `v3/` tree nor the `src/domains/` directories exist, and no TypeScript DDD patterns are present.

### 4.5 Gaps vs. DDD Best Practices

1. No bounded context map or context diagram exists in `docs/`.
2. The `ddd.directory` setting points to `/docs/ddd`, which does not exist.
3. The two governance scripts disagree on domain names, suggesting they were generated independently without cross-validation.
4. The project itself, being a CLI configuration tool, would not benefit from full DDD modelling — but this design rationale is not recorded anywhere.

---

## 5. Cross-Cutting Concerns

### 5.1 Security Governance

Security governance is evident at two levels. At the configuration level, `.claude/settings.json` denies `Read(./.env)` and `Read(./.env.*)` permissions, preventing hooks from leaking secrets. `CLAUDE.md` explicitly prohibits hardcoding API keys and committing `.env` files. The `.gitignore` entries for `.mcp.json` and `.claude/settings.json` (enforced by `setup.js`'s `updateGitignore()` function) prevent credential-bearing configuration from entering source control.

At the code level, `src/setup.js` constructs all paths from `process.cwd()` and `packageRoot` via `path.join()`, eliminating directory traversal risk. The `parseArgs()` function in `src/utils.js` matches known flag strings and discards unrecognised input. The `pre-bash` handler in `hook-handler.cjs` maintains a small blocklist of catastrophically dangerous shell patterns (e.g., `rm -rf /`, fork bomb) — shallow but non-zero protection. The `claudeFlow.security.autoScan: true` and `scanOnEdit: true` settings indicate scan intent; however, no evidence from static analysis confirms the `security-scanner.sh` helper is actively connected to the hook pipeline.

### 5.2 Hook-Driven Enforcement Mechanisms

The hook architecture in `.claude/settings.json` is the most mature governance mechanism in the project. Eleven event types are covered:

- `PreToolUse[Bash]` → `pre-bash` (command safety check); `PreToolUse[Write|Edit|MultiEdit]` → `pre-edit`
- `PostToolUse[Write|Edit|MultiEdit]` → `post-edit` (edit recording, intelligence feedback); `PostToolUse[Bash]` → `post-bash`
- `UserPromptSubmit` → `route` (agent routing)
- `SessionStart` → `session-restore`, `auto-memory-hook.mjs import`; `SessionEnd` → `session-end`, intelligence consolidation
- `Stop` → `auto-memory-hook.mjs sync`; `PreCompact[manual|auto]` → `compact-*`, `session-end`
- `SubagentStart` → `status`; `SubagentStop` → `post-task`; `Notification` → `notify`

All hooks route through `hook-handler.cjs`, which loads sub-modules (`router.js`, `session.js`, `memory.js`, `intelligence.cjs`) with graceful degradation when modules are absent. Critically, **all hooks exit with code 0** by design — the unconditional `process.exit(0)` in `hook-handler.cjs` ensures hooks never block Claude Code operation. This is a sound resilience choice, but it means hooks cannot enforce hard constraints; they can only advise.

The `check-ruflo.cjs` global `SessionStart` hook emits a `[RUFLO]` system reminder when a project lacks `.mcp.json` or `.claude/settings.json`. This is a discoverability aid rather than a blocking gate.

### 5.3 3-Tier Model Routing as an Architectural Constraint

`CLAUDE.md` specifies ADR-026's three-tier routing table as a normative constraint, instructing agents to check for `[AGENT_BOOSTER_AVAILABLE]` or `[TASK_MODEL_RECOMMENDATION]` signals before spawning agents. The `router.js` module implements a keyword-pattern matching system that maps task descriptions to agent roles (coder, tester, reviewer, architect, etc.) but does not implement the latency/cost hierarchy. The `hook-handler.cjs` `route` handler calls `router.routeTask()` on every `UserPromptSubmit` event and emits a formatted routing recommendation as console output.

The gap is that `router.js`'s output is agent-type strings, not model tier selections. The three-tier decision — whether to use the WASM booster, Haiku, or Sonnet — is left to the invoked claude-flow infrastructure. The constraint in `CLAUDE.md` is therefore a policy directive to the AI agent rather than a mechanically enforced rule.

---

## 6. Findings and Scoring

Each dimension is rated on a 1–5 scale, where 1 = no evidence, 3 = partial/aspirational, 5 = fully implemented with verification.

### 6.1 ADR Coverage — Score: 2 / 5

**Justification:** Ten ADRs are identified and a dedicated compliance checker exists. However, no ADR documents exist in the repository, five of the ten checks target artefacts that are absent, three checks use hard-coded placeholder scores (50, 75, 100) rather than dynamic verification, and `adr-compliance.sh` is not wired into the live hook system. ADR-026 — the most directly relevant ADR to this codebase — is not tracked by the compliance script.

### 6.2 DDD Adherence — Score: 1 / 5

**Justification:** No DDD structural patterns (bounded contexts, aggregates, entities, value objects, repositories, domain events) are present in the source code. The DDD tracking infrastructure exists but targets a codebase that does not yet exist in this repository. The two governance scripts disagree on domain taxonomy. This score does not penalise the project for making a pragmatic architecture choice appropriate to a CLI tool; it reflects the absence of correspondence between declared DDD intent and implementation reality.

### 6.3 Security Governance — Score: 3 / 5

**Justification:** Secrets are correctly excluded from source control via `.gitignore` automation and `CLAUDE.md` policy. Input handling follows safe patterns. The `pre-bash` blocklist provides minimal but non-trivial protection. The `permissions.deny` entries in `.claude/settings.json` prevent `.env` reads. Gaps include: the `security-scanner.sh` is unconfirmed to be active on edit events, no output encoding validation is evident in hook stdout handling, and the ADR for security policy (referenced indirectly through `CLAUDE.md`'s "Security Rules" section) is not formally captured.

### 6.4 Hook Enforcement — Score: 4 / 5

**Justification:** The hook table in `.claude/settings.json` is comprehensive, covers eleven event types, uses graceful degradation, and includes both a global `SessionStart` advisory check and per-session routing. The `hook-handler.cjs` orchestration layer is well-structured. The main limitation lowering the score is that hooks are advisory rather than blocking (by design), and several hook targets (`auto-memory-hook.mjs`, `intelligence.cjs`) depend on infrastructure whose operational state in this repository cannot be confirmed from static analysis alone.

### 6.5 3-Tier Model Routing — Score: 2 / 5

**Justification:** The routing concept is architecturally declared in `CLAUDE.md` and partially implemented in `router.js`. The `UserPromptSubmit` hook fires on every prompt and calls the router. However, the implementation performs pattern matching to agent types only; the tier-1 WASM booster, tier-2/tier-3 model selection, and the `[AGENT_BOOSTER_AVAILABLE]` signal are not implemented in this codebase. The constraint exists as a policy directive, not a mechanically enforced decision point.

### 6.6 Test Coverage — Score: 3 / 5

**Justification:** `tests/cli.test.mjs` contains 11 tests covering CLI flag parsing, dry-run operation, hook installation and status reporting, `status` layer headers, `.mcp.json` detection, MCP tool group env vars, and template synchronisation. This is meaningful functional coverage of the CLI surface. However, there are no unit tests for individual functions in `src/utils.js`, `src/hooks.js`, or `src/setup.js` in isolation; no negative-path tests for error conditions (e.g., pnpm missing, corrupt settings.json); and no tests for the governance helpers (`adr-compliance.sh`, `ddd-tracker.sh`).

---

## 7. Recommendations

The following recommendations are ordered from highest to lowest leverage.

### R1. Wire governance helpers into the hook system (Priority: High)

`adr-compliance.sh` and `ddd-tracker.sh` are fully functional workers that produce structured JSON output. Adding a `PostToolUse[Write|Edit|MultiEdit]` hook entry — or a `SubagentStop` hook entry — that invokes `adr-compliance.sh check` and `ddd-tracker.sh check` would close the gap between "tooling exists" and "tooling runs". The 15-minute and 10-minute throttles already prevent performance overhead.

### R2. Create ADR documents (Priority: High)

The four decisions most significant to the codebase — (a) ESM/CJS interoperability strategy, (b) native `node:test` over Vitest, (c) advisory-only hook architecture, (d) ADR-026 3-tier routing as policy vs. mechanism — should be captured as short Markdown documents in `docs/adr/`. This would bring the `adr.directory` setting into correspondence with reality and provide evidence for future compliance checks.

### R3. Reconcile DDD domain taxonomy (Priority: Medium)

`adr-compliance.sh`'s ADR-002 check and `ddd-tracker.sh`'s `DOMAINS` array use overlapping but distinct domain names. `validate-v3-config.sh` uses a third taxonomy. A single authoritative domain list should be extracted and referenced by all three scripts. Even if DDD is not actively applied to this tool's internal architecture, maintaining a consistent declared target prevents governance drift.

### R4. Add a note-to-self ADR for CLI architecture decision (Priority: Medium)

The deliberate choice to implement `ruflo-setup` as a procedural CLI rather than a DDD-structured service is architecturally significant and should be recorded. An ADR explaining that the bounded-context and DDD governance tooling targets downstream `ruflo`/`claude-flow` projects — not `ruflo-setup` itself — would clarify the governance intent and prevent the current misreading of zero DDD adherence as a defect.

### R5. Extend test coverage for negative paths and helper functions (Priority: Medium)

Unit tests for `parseArgs()`, `toPlatformMcpConfig()`, `semverGte()`, and the `pre-bash` blocklist would increase confidence in the utility and safety layers. A negative test confirming corrupt `.claude/settings.json` is handled gracefully is also warranted.

### R6. Stub ADR-026 tier selection in `router.js` (Priority: Low)

The `routeTask()` function could emit a `[TASK_MODEL_RECOMMENDATION]` signal alongside the agent type, mapping task complexity to a tier recommendation. This would close the gap between the policy declared in `CLAUDE.md` and the implemented routing mechanism.

---

## 8. Conclusion

The `ruflo-setup` project demonstrates a well-intentioned and technically sophisticated governance apparatus. The hook system wired into `.claude/settings.json` is the strongest governance artefact: comprehensive, resilient, and covering the full Claude Code event lifecycle. The ADR compliance and DDD tracking helpers are competently constructed and capable of producing quantitative metrics when their target codebase exists.

The central weakness is structural: the governance tooling carries assumptions about a `v3/` directory tree and `src/domains/` structure that do not exist in this repository. Automated compliance checks would report near-zero scores not because governance is poor but because the checks target the wrong codebase. Resolving this requires either redirecting the tools to the project's actual structure or documenting, via ADRs, that the tooling is advisory scaffolding targeting downstream consumer projects.

The project's security posture is sound for its scope. Its hook enforcement is the most mature governance dimension. The most significant gap is the absence of any written ADR documents — the mechanism's primary deliverable is missing from the repository it governs.

---

## References

Evans, E. (2003). *Domain-Driven Design: Tackling Complexity in the Heart of Software*. Addison-Wesley.

Nygard, M. (2011). "Documenting Architecture Decisions." *Cognitect Blog*. Retrieved from https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions

Vernon, V. (2013). *Implementing Domain-Driven Design*. Addison-Wesley.

Fowler, M. (2006). "BoundedContext." *martinfowler.com*. Retrieved from https://martinfowler.com/bliki/BoundedContext.html

Keeling, M. (2017). *Design It! From Programmer to Software Architect*. Pragmatic Bookshelf. (Chapter 19: Document Decisions.)
