# ADR-001: Procedural CLI Architecture for ruflo-setup

**Status:** Accepted  
**Date:** 2026-03-31  
**Deciders:** Mario Jauvin  
**Supersedes:** —  
**Superseded by:** —

---

## Context

`ruflo-setup` is a deployment and configuration bootstrapping tool. Its purpose is to install and wire the Ruflo + Claude Flow V3 AI-assisted development toolchain into target projects. It has no persistent application state, no multi-user concurrency requirements, no event-driven domain logic, and no rich business rules.

The project's governance scaffold (`.claude/helpers/ddd-tracker.sh`, `adr-compliance.sh`) assumes a Domain-Driven Design structure with bounded contexts, aggregates, and domain events — a model inherited from the downstream `claude-flow` and `ruflo` packages that `ruflo-setup` installs. There was a risk of cargo-culting that structure into a tool that does not warrant it.

---

## Decision

`ruflo-setup` is implemented as a procedural CLI with four flat modules (`cli.js`, `setup.js`, `hooks.js`, `utils.js`, `status.js`) rather than a DDD-layered domain model. No bounded contexts, aggregates, repositories, or domain events are introduced into this codebase.

The DDD and ADR governance tooling in `.claude/helpers/` targets downstream consumer projects scaffolded by this tool, not the tool itself.

---

## Consequences

**Positive:**
- The codebase remains small, understandable, and easy to onboard for contributors unfamiliar with DDD.
- There is no artificial complexity introduced to satisfy tooling that measures DDD artefact counts.
- The procedural model maps cleanly to the sequential setup steps the tool performs.

**Negative:**
- The governance helpers (`ddd-tracker.sh`, `adr-compliance.sh`) report near-zero compliance scores when run against this repository, because they target artefacts that do not and should not exist here. This is expected behaviour.
- Future contributors must be informed that the DDD infrastructure is for consumer projects, not this package.

**Risks:**
- If `ruflo-setup` grows substantially in scope (e.g., acquiring persistent state, user accounts, or multi-step orchestration), this decision should be revisited.

---

## Alternatives Considered

### Apply DDD to ruflo-setup itself
Rejected. The tool has no domain model that would benefit from bounded contexts or aggregates. It performs a linear sequence of file I/O and shell invocations. DDD would be overengineering.

### Hybrid: add a thin domain layer for `McpConfig` and `HookConfig`
Rejected at this stage. The value objects are simple enough that plain data objects and pure functions are sufficient. This can be revisited if configuration validation logic grows complex.

---

## Related

- See `.claude/helpers/ddd-tracker.sh` — targets downstream projects
- See `.claude/helpers/adr-compliance.sh` — ADR-002 check targets `src/domains/` which intentionally does not exist here
- See `docs/ddd/bounded-context-map.md` for the DDD model of downstream consumer projects
