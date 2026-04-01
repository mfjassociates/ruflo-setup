# ADR-004: Node.js Native Test Runner over Vitest

**Status:** Accepted  
**Date:** 2026-03-31  
**Deciders:** Mario Jauvin  
**Supersedes:** Governance helper ADR-008 (which prescribed Vitest — not applicable to this repo)  
**Superseded by:** —

---

## Context

The `.claude/helpers/adr-compliance.sh` governance script defines **ADR-008: Vitest over Jest** as a compliance requirement, checking for `vitest` in `package.json`. This ADR was authored for the downstream `ruflo`/`claude-flow` packages, not for `ruflo-setup`.

`ruflo-setup` has a small test suite (`tests/cli.test.mjs`, 11 tests) covering CLI flag parsing, dry-run behaviour, hook installation, status layer output, and template synchronisation. The tests are written using Node.js's built-in `node:test` module with `node:assert/strict`.

---

## Decision

Use Node.js's native `node:test` runner for `ruflo-setup`'s test suite. Do not add Vitest or any other test framework as a dependency.

The `adr-compliance.sh` check for Vitest will report a failing score for this repository. This is expected and documented (see ADR-001 and `docs/research/governance.md` § 3.2). The compliance script targets downstream projects, not this tool.

---

## Rationale

- `ruflo-setup` has zero runtime dependencies beyond Node.js itself (all imports are from `node:*` built-ins). Introducing Vitest as a dev dependency would be the only non-built-in dependency in the project — disproportionate for 11 tests.
- The native runner is available everywhere Node.js 20+ is installed, with no install step. This matters for CI environments and for contributors running `pnpm test` immediately after cloning.
- The test suite does not use features that would justify a test framework: no mocking of ESM modules, no snapshot testing, no test UI.

---

## Consequences

**Positive:**
- Zero additional dev dependencies for the test suite.
- Tests run with `node --test tests/*.mjs` — no framework bootstrap time.
- No version pinning or framework upgrade maintenance.

**Negative:**
- `adr-compliance.sh` reports a false-negative ADR-008 failure for this repository.
- If the test suite grows to require ESM mocking (e.g. mocking `spawnSync` in `setup.js`), the native runner's mocking capabilities are limited and Vitest may need to be reconsidered.

**Risks:**
- Node.js `node:test` API is stable from Node 20 but has fewer community resources than Vitest. Contributors may be less familiar with its assertion and TAP output format.

---

## Alternatives Considered

### Vitest
Rejected. Adds a dev dependency solely to satisfy a governance check that targets a different codebase. Governance checks should reflect reality, not drive unnecessary dependencies.

### Jest
Rejected for the same reason, and additionally because the project is ESM-first (`"type": "module"`) which requires extra Jest configuration.

### tap / ava
Rejected. External dependencies without meaningful benefit over the native runner for this scope.

---

## Related

- `tests/cli.test.mjs` — test suite
- `package.json` `"scripts": { "test": "node --test tests/*.mjs" }`
- `.claude/helpers/adr-compliance.sh` ADR-008 check — intentionally fails for this repo
- `docs/adr/ADR-001-procedural-cli-architecture.md` — explains governance scope mismatch
