# Implementation Plan — Ruflo-Setup Governance & Quality Improvements

**Version:** 1.0  
**Date:** 2026-03-31  
**Based on:** `docs/research/governance.md` recommendations R1–R6  
**Author:** Mario Jauvin

---

## Executive Summary

The governance evaluation (`docs/research/governance.md`) identified six recommendations across four priority levels. This plan organises them into three sprints. Each sprint is independently shippable — later sprints do not depend on earlier ones being complete, but they build in logical order.

| Sprint | Theme | Recs addressed | Estimated effort |
|--------|-------|----------------|-----------------|
| 1 | Governance wiring & taxonomy | R1, R3 | Small (2–4 sessions) |
| 2 | Router & routing ADR | R6, partial R2 | Medium (3–5 sessions) |
| 3 | Test coverage | R5 | Medium (2–4 sessions) |
| Ongoing | Architecture rationale ADRs | R4 | Trivial (1 session) |

---

## Sprint 1 — Governance Wiring & Taxonomy Reconciliation

**Goal:** Make the governance helpers actually run automatically, and eliminate the three-way domain taxonomy discrepancy that produces inconsistent compliance reports.

**Acceptance criteria:**
- After any file edit in the project, `adr-compliance.sh` and `ddd-tracker.sh` are invoked automatically (respecting their throttle windows).
- All three governance scripts (`adr-compliance.sh`, `ddd-tracker.sh`, `validate-v3-config.sh`) reference the same canonical domain list.
- No hook exits non-zero (ADR-003 maintained).

---

### Task 1.1 — Wire `adr-compliance.sh` into `post-edit`

**File:** `.claude/helpers/hook-handler.cjs`  
**ADR:** `docs/adr/ADR-007-hook-governance-wiring.md`

In the `post-edit` handler, after existing edit recording logic, add a fire-and-forget invocation:

```js
// After existing post-edit logic:
const { spawnSync } = require('child_process');
const adrScript = path.join(__dirname, 'adr-compliance.sh');
if (fs.existsSync(adrScript)) {
  spawnSync('bash', [adrScript, 'check'], {
    stdio: 'ignore',
    timeout: 5000,
    detached: false
  });
}
```

- Must be wrapped in try/catch.
- Must not affect exit code.
- Must check that `bash` is available before calling.

---

### Task 1.2 — Wire `ddd-tracker.sh` into `post-edit`

**File:** `.claude/helpers/hook-handler.cjs`  
**ADR:** `docs/adr/ADR-007-hook-governance-wiring.md`

Same pattern as Task 1.1, immediately after the `adr-compliance.sh` call:

```js
const dddScript = path.join(__dirname, 'ddd-tracker.sh');
if (fs.existsSync(dddScript)) {
  spawnSync('bash', [dddScript, 'check'], {
    stdio: 'ignore',
    timeout: 5000,
    detached: false
  });
}
```

---

### Task 1.3 — Reconcile domain taxonomy

**Files:**
- `.claude/helpers/ddd-tracker.sh`
- `.claude/helpers/validate-v3-config.sh`

**Reference:** `docs/ddd/domain-taxonomy.md`

Update `DOMAINS` array in `ddd-tracker.sh`:
```bash
# Old:
DOMAINS=("agent-lifecycle" "task-execution" "memory-management" "coordination" "shared-kernel")
# New:
DOMAINS=("agent-lifecycle" "task-execution" "session-management" "memory-management" "coordination")
```

Update expected directory list in `validate-v3-config.sh` to match the same five names.

**Test:** Run both scripts with `force` subcommand and confirm they report on the same domain set.

---

### Task 1.4 — Update `adr-compliance.sh` to track ADR-006

**File:** `.claude/helpers/adr-compliance.sh`  
**ADR:** `docs/adr/ADR-006-three-tier-model-routing.md`

Add ADR-006 to the `ADRS` array and write a `check_adr_006()` function that verifies:
1. `router.js` exists at `.claude/helpers/router.js`
2. `routeTask` function is exported
3. `CLAUDE.md` contains a reference to three-tier routing

Remove one of the hard-coded placeholder scores (ADR-004 or ADR-006) and replace with the new check.

---

## Sprint 2 — Router Tier Signal & ADR Closure

**Goal:** Close the gap between the three-tier routing *policy* (CLAUDE.md) and the *mechanism* (`router.js`). The router should emit a `[TASK_MODEL_RECOMMENDATION]` signal that downstream infrastructure can act on.

**Acceptance criteria:**
- `router.js` `routeTask()` returns a `tier` field (1, 2, or 3) alongside `agent`.
- `hook-handler.cjs` route handler echoes `[TASK_MODEL_RECOMMENDATION: tier=N]` to stdout when applicable.
- ADR-006 compliance check in `adr-compliance.sh` passes with score ≥ 50.

---

### Task 2.1 — Add complexity scoring to `router.js`

**File:** `.claude/helpers/router.js`

Add a `scoreComplexity(task)` function that returns a value 0–100 based on task text heuristics:

| Signal | Score contribution |
|--------|--------------------|
| Keywords: "implement", "create", "build" | +10 |
| Keywords: "architect", "design", "refactor" | +25 |
| Keywords: "security", "audit", "compliance" | +30 |
| Keywords: "test", "coverage" | +10 |
| Task length > 100 chars | +10 |
| Task length > 300 chars | +15 |
| Multiple sentences (> 2 periods) | +10 |

Tier mapping:
- Score 0–15 → Tier 1 (WASM booster, `[AGENT_BOOSTER_AVAILABLE]`)
- Score 16–40 → Tier 2 (Haiku)
- Score > 40 → Tier 3 (Sonnet/Opus)

Update `routeTask()` return value:
```js
return {
  agent,
  tier,          // 1 | 2 | 3
  confidence: 0.8,
  reason: `...`,
  recommendation: tier === 1
    ? '[AGENT_BOOSTER_AVAILABLE]'
    : `[TASK_MODEL_RECOMMENDATION: tier=${tier}]`
};
```

---

### Task 2.2 — Emit tier signal from `hook-handler.cjs`

**File:** `.claude/helpers/hook-handler.cjs`

In the `route` handler, after calling `router.routeTask()`, write the `recommendation` string to stdout if tier < 3:

```js
const result = router.routeTask(task);
if (result.recommendation) {
  process.stdout.write(result.recommendation + '\n');
}
```

This makes the signal visible to Claude Code, which scans hook stdout for `[AGENT_BOOSTER_AVAILABLE]` tokens.

---

### Task 2.3 — Update ADR-006 compliance check

**File:** `.claude/helpers/adr-compliance.sh`

Update `check_adr_006()` (added in Sprint 1, Task 1.4) to also verify the `recommendation` field is present in `router.js` output:

```bash
check_adr_006() {
  local score=0
  [ -f "$PROJECT_ROOT/.claude/helpers/router.js" ] && score=$((score + 30))
  grep -q "routeTask" "$PROJECT_ROOT/.claude/helpers/router.js" 2>/dev/null && score=$((score + 20))
  grep -q "recommendation\|TASK_MODEL_RECOMMENDATION" "$PROJECT_ROOT/.claude/helpers/router.js" 2>/dev/null && score=$((score + 30))
  grep -q "three.*tier\|3.*tier\|ADR-026\|ADR-006" "$PROJECT_ROOT/CLAUDE.md" 2>/dev/null && score=$((score + 20))
  echo "$score"
}
```

---

## Sprint 3 — Test Coverage Improvements

**Goal:** Increase test confidence for negative paths, utility functions, and the `pre-bash` security blocklist. Address the Test Coverage score of 3/5 from the governance evaluation.

**Acceptance criteria:**
- `parseArgs()` is unit-tested for all known flags and unknown flag handling.
- `toPlatformMcpConfig()` is tested for `win32` and non-win32 outputs.
- `semverGte()` is tested for equal, greater, and lesser version strings.
- At least two negative-path tests exist (corrupt settings.json, pnpm not found).
- The `pre-bash` blocklist is tested to confirm it detects the dangerous patterns it claims to block.

---

### Task 3.1 — Unit tests for `src/utils.js`

**File:** `tests/utils.test.mjs`

Test cases to write:
- `parseArgs(['--force'])` → `{ force: true }`
- `parseArgs(['--dry-run', '--yes'])` → `{ dryRun: true, yes: true }`
- `parseArgs(['--skip-init', '--no-hooks'])` → `{ skipInit: true, noHooks: true }`
- `parseArgs(['--unknown-flag'])` → unknown flag ignored gracefully
- `toPlatformMcpConfig('win32')` → commands use Windows-compatible format
- `toPlatformMcpConfig('linux')` → commands use Unix format
- `semverGte` — equal versions, minor upgrade, major upgrade, patch rollback

---

### Task 3.2 — Negative-path tests for `src/setup.js`

**File:** `tests/setup.test.mjs`

Test cases to write:
- `runSetup` with a directory containing a corrupt `.claude/settings.json` — should not throw; should log a warning.
- `ensurePnpmAvailable` when `pnpm` is not on PATH — should throw with an error message including platform-appropriate install suggestions.
- `runPnpmInit` where `pnpm add` exits non-zero — should throw with the exit code.

These require mocking `spawnSync`. Options:
- Inject a `spawnSync` dependency via parameter (preferred, avoids ESM mocking complexity).
- Use Node's `--experimental-vm-modules` for ESM mocking (if injecting proves too invasive).

---

### Task 3.3 — `pre-bash` blocklist tests

**File:** `tests/hook-handler.test.mjs` (new, CJS-compatible)

The `hook-handler.cjs` `pre-bash` handler should be extracted into a testable `isSafeCommand(cmd)` function. Test cases:
- `rm -rf /` → unsafe
- `:(){ :|:& };:` (fork bomb) → unsafe
- `git status` → safe
- `pnpm install` → safe
- `cat ~/.ssh/id_rsa` → should this be flagged? Decide and document.

---

## Ongoing — Architecture Rationale ADR

**Goal:** Record the deliberate choice to use a procedural CLI model, so future contributors do not attempt to apply DDD to this package.

**Status:** Already created as `docs/adr/ADR-001-procedural-cli-architecture.md`. No further implementation work needed — this is a documentation ADR only.

**Action:** Link ADR-001 from the project's main `README.md` in a new "Architecture Decisions" section.

---

## Summary Backlog

| Task | Sprint | File(s) | Effort | Rec |
|------|--------|---------|--------|-----|
| Wire `adr-compliance.sh` into post-edit | 1 | `hook-handler.cjs` | S | R1 |
| Wire `ddd-tracker.sh` into post-edit | 1 | `hook-handler.cjs` | S | R1 |
| Reconcile domain taxonomy | 1 | `ddd-tracker.sh`, `validate-v3-config.sh` | S | R3 |
| Add ADR-006 to compliance checker | 1 | `adr-compliance.sh` | S | R2 |
| Add complexity scoring to router | 2 | `router.js` | M | R6 |
| Emit tier signal from hook handler | 2 | `hook-handler.cjs` | S | R6 |
| Update ADR-006 compliance check | 2 | `adr-compliance.sh` | S | R2 |
| Unit tests for `utils.js` | 3 | `tests/utils.test.mjs` | M | R5 |
| Negative-path tests for `setup.js` | 3 | `tests/setup.test.mjs` | M | R5 |
| `pre-bash` blocklist tests | 3 | `tests/hook-handler.test.mjs` | S | R5 |
| Link ADR-001 from README | Ongoing | `README.md` | XS | R4 |

**Effort key:** XS = < 30 min, S = 30–90 min, M = 1–3 hrs

---

## Files Created by This Plan

```
docs/
  adr/
    ADR-001-procedural-cli-architecture.md      ✓ created
    ADR-002-esm-cjs-interoperability.md         ✓ created
    ADR-003-advisory-only-hooks.md              ✓ created
    ADR-004-native-test-runner.md               ✓ created
    ADR-005-platform-aware-mcp-config.md        ✓ created
    ADR-006-three-tier-model-routing.md         ✓ created
    ADR-007-hook-governance-wiring.md           ✓ created (Proposed)
  ddd/
    bounded-context-map.md                      ✓ created
    domain-taxonomy.md                          ✓ created
  plan/
    implementation-plan.md                      ✓ this file
  research/
    governance.md                               ✓ existing (source)
```
