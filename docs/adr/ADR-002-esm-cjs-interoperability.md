# ADR-002: ESM/CJS Interoperability Strategy

**Status:** Accepted  
**Date:** 2026-03-31  
**Deciders:** Mario Jauvin  
**Supersedes:** —  
**Superseded by:** —

---

## Context

`ruflo-setup` sets `"type": "module"` in `package.json`, making all `.js` files ES Modules by default. However, two hooks must be CJS:

1. `claude-hooks/check-ruflo.cjs` — the global `SessionStart` hook installed into `~/.claude/settings.json`. Claude Code executes this hook via `node`, and the hook must be a single self-contained file that does not rely on ESM import resolution in the user's global Node environment.
2. `.claude/helpers/hook-handler.cjs` — the local hook dispatcher that Claude Code invokes on every hook event. Same constraint: must work as a standalone CJS module regardless of the consuming project's module type.

The tension is: the main source (`src/`) is ESM for ergonomics and future-proofing, but the hook entry points must be CJS for compatibility.

---

## Decision

Use the `.cjs` extension exclusively for hook entry points that must be CJS. All other source files remain `.js` (ESM). No `"type": "commonjs"` override is used anywhere.

The CJS hook files use `require()` for their own internal dependencies and `module.exports` for any exports. They do not import from the ESM `src/` modules.

---

## Consequences

**Positive:**
- Source modules use modern ESM syntax with named imports/exports and top-level await.
- Hook files are clearly identified by their `.cjs` extension — any developer encountering them knows they are CJS for a reason.
- No build step or transpiler is needed; Node.js handles both natively.

**Negative:**
- Code sharing between `src/` and `.cjs` hook files is not straightforward. Utility functions needed in both must either be duplicated or extracted into a separate `.cjs`-compatible module.
- New contributors must understand the `.cjs` convention and why those two files diverge from the rest.

**Risks:**
- If additional hooks are added and a contributor accidentally uses `.js` (ESM), the hook may fail silently in environments where the project's `"type": "module"` propagates.

---

## Alternatives Considered

### Use CJS for everything (`"type": "commonjs"`)
Rejected. Would require rewriting all `import`/`export` syntax and forgo ESM ergonomics for the majority of the codebase.

### Use a bundler (esbuild/rollup) to produce CJS hook bundles
Rejected for now. Adds a build step and a dev dependency for a problem that the `.cjs` extension convention already solves adequately.

### Use dynamic `import()` inside CJS hook files to call ESM utilities
Rejected. `import()` inside CJS is async and requires careful error handling. The hook entry points need to be simple and robust; async wrapper complexity increases the chance of silent failure.

---

## Related

- `claude-hooks/check-ruflo.cjs` — global SessionStart hook
- `.claude/helpers/hook-handler.cjs` — per-project hook dispatcher
- `package.json` `"type": "module"` declaration
