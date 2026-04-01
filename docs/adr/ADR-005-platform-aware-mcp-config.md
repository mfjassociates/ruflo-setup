# ADR-005: Platform-Aware MCP Configuration Generation

**Status:** Accepted  
**Date:** 2026-03-31  
**Deciders:** Mario Jauvin  
**Supersedes:** —  
**Superseded by:** —

---

## Context

Claude Code reads MCP server definitions from `.mcp.json` in the project root. Each server entry specifies a `command` and `args` array that Claude Code uses to spawn the MCP server process. The commands differ across platforms:

- On **Windows**, shell resolution requires `cmd.exe` shims or explicit `.cmd` extensions for globally installed npm packages invoked via `npx`.
- On **Linux/WSL**, the same packages are invoked via POSIX shell without wrappers.
- Path separators, environment variable syntax, and process spawning behaviour differ between platforms.

Similarly, `.claude/settings.json` contains hook definitions with `command` fields that may use platform-specific paths (e.g. the resolved path to `check-ruflo.cjs`).

Committing either file to version control creates a conflict: a Windows-generated `.mcp.json` breaks on Linux, and vice versa.

---

## Decision

1. `ruflo-setup` generates `.mcp.json` using a `toPlatformMcpConfig(platform)` function in `src/utils.js` that branches on `process.platform` (`win32` vs. other) to produce the correct command format for the current platform.

2. Both `.mcp.json` and `.claude/settings.json` are added to `.gitignore` by `updateGitignore()` in `src/setup.js`. They are never committed.

3. Developers must rerun `ruflo-setup --force` (or `ruflo-setup --yes`) after cloning into a new environment, especially when switching platforms.

4. All MCP server commands use `npx` as the cross-platform invocation mechanism (rather than `pnpm dlx` or direct binary paths), because `npx` is available wherever Node.js is installed and handles `.cmd` shimming on Windows automatically.

---

## Consequences

**Positive:**
- No platform-specific committed files that break cross-platform clones.
- Developers on Windows and Linux/WSL always have a correctly configured `.mcp.json` for their environment.
- The `npx`-based invocation reduces platform-specific branching in the generated config.

**Negative:**
- New developers must know to run `ruflo-setup` after cloning — this is not self-evident from the repository state (no `.mcp.json` present).
- The `check-ruflo.cjs` global hook installs a path to the hook file in `~/.claude/settings.json` using the resolved path at install time. This path may be incorrect if the package is reinstalled to a different location.

**Risks:**
- Git mode changes (0644 → 0755) on files may appear as spurious diffs when switching between Windows and Linux/WSL. Developers should be aware of `git config core.fileMode false` as a local mitigation. See `README.md` § "Windows vs Linux/WSL differences".

---

## Alternatives Considered

### Commit a platform-neutral `.mcp.json` using only `npx` commands
Partially done — `npx` is used for all commands. However, Windows still requires shell-specific handling for some edge cases, so the platform branch is retained.

### Provide separate `.mcp.win.json` and `.mcp.unix.json` and let developers symlink
Rejected. Too much manual ceremony for a one-command bootstrap tool.

### Use a single `Makefile`/`justfile` target to regenerate `.mcp.json` on demand
Rejected. Adds a dependency (`make`/`just`) and ceremony that `ruflo-setup --force` already handles cleanly.

---

## Related

- `src/utils.js` — `toPlatformMcpConfig()` function
- `src/setup.js` — `writeMcpJson()`, `updateGitignore()`
- `.gitignore` — `.mcp.json`, `.claude/settings.json` entries
- `README.md` § "Windows vs Linux/WSL differences"
- `docs/research/governance.md` § 5.1 — Security: gitignore automation
