# ADR-003: Advisory-Only Hook Architecture

**Status:** Accepted  
**Date:** 2026-03-31  
**Deciders:** Mario Jauvin  
**Supersedes:** —  
**Superseded by:** —

---

## Context

Claude Code executes hook scripts and interprets their exit codes. A non-zero exit code from a `PreToolUse` hook blocks the tool call. This gives hooks the ability to enforce hard constraints — for example, blocking a `Bash` command that matches a dangerous pattern.

The hook system in `.claude/settings.json` covers eleven event types and routes all events through `.claude/helpers/hook-handler.cjs`. An early design considered using blocking hooks for ADR compliance checks, DDD validation, and security scanning — exiting non-zero to prevent edits that violated governance rules.

---

## Decision

All hooks unconditionally exit with code `0`. No hook blocks a Claude Code operation. Governance helpers (`adr-compliance.sh`, `ddd-tracker.sh`, `security-scanner.sh`) are invoked by hooks for data collection only; their output goes to metrics files and console, never to exit codes.

The `pre-bash` handler in `hook-handler.cjs` maintains a small blocklist of catastrophically dangerous commands (`rm -rf /`, fork bomb patterns) — but even here, the intent is to log and warn, not to block indefinitely.

The `check-ruflo.cjs` global `SessionStart` hook emits a `[RUFLO]` system reminder when a project is not configured but does not abort the session.

---

## Decision Rationale

The primary risk of blocking hooks is that a misconfigured or unavailable governance tool silently prevents all development activity. Because the governance helpers depend on external tools (`jq`, directory structures, daemon services) that may not be present in all environments, a blocking model would make the development environment fragile.

Graceful degradation is more valuable than hard enforcement for a developer tooling bootstrapper.

---

## Consequences

**Positive:**
- Claude Code is never blocked by a governance check failure.
- The hook infrastructure degrades gracefully when helper scripts or dependencies are missing.
- Developers can always override governance signals and continue working.

**Negative:**
- Hooks cannot enforce hard constraints. A developer can ignore ADR compliance warnings.
- Security scans triggered by `PostToolUse[Write]` are informational only; a dangerous edit is not preventable via this mechanism.

**Risks:**
- If a stricter enforcement model is needed in the future (e.g. for regulated environments), the exit-zero guarantee must be revisited. The hook handler's `process.exit(0)` call is the single point to change.

---

## Alternatives Considered

### Blocking hooks for security checks only
Partially accepted as a future option. The `pre-bash` blocklist is a minimal version of this, but full blocking for security patterns is deferred (see Recommendation R1 in `docs/research/governance.md`).

### Per-hook configuration for blocking vs. advisory
Rejected for now. Adds complexity to `hook-handler.cjs` for a use case that does not yet exist in this project.

---

## Related

- `.claude/helpers/hook-handler.cjs` — line containing `process.exit(0)`
- `.claude/settings.json` — hook table with eleven event types
- `docs/research/governance.md` § 5.2 — Hook Enforcement analysis
