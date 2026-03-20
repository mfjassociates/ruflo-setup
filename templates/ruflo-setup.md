# /ruflo-setup

Set up Ruflo + Claude Flow V3 in the current project directory.

## Requirements

- Node.js 20+
- pnpm 10.32.1+ installed and available on PATH

Quickest pnpm install by platform:

```bash
# Windows (recommended)
winget install -e --id pnpm.pnpm

# macOS (recommended)
brew install pnpm

# Linux (recommended)
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

Alternative (all platforms with recent Node.js):

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

## What this does

Runs `pnpm add -g @mfjjs/ruflo-setup` then `ruflo-setup` which:

1. Runs `pnpm add -g ruflo@latest` then `ruflo init --full` to install:
   - `.claude/settings.json` with hooks, permissions, and Claude Flow config
   - `.claude/helpers/` — hook-handler, statusline, auto-memory scripts
   - `.claude/agents/` — 120+ agent definitions
   - `.claude/skills/` — 30+ skill definitions
   - `.claude/commands/` — slash commands
2. Writes a platform-aware `.mcp.json` (MCP server registration for claude-flow, ruv-swarm, flow-nexus)
3. Installs a global `SessionStart` hook in `~/.claude/settings.json` that warns when Ruflo is not configured
4. May refresh `~/.claude/commands/ruflo-setup.md` from the latest packaged template when differences are detected

## Options

### cleanup

Removes all Ruflo-related packages from the **npm** global registry (does not touch pnpm globals).

Packages removed: `ruflo`, `@mfjjs/ruflo-setup`, `ruflo-setup`, `claude-flow`, `@claude-flow/cli`, `ruv-swarm`

## Instructions for Claude

When the user runs /ruflo-setup:

### Default (no arguments) — install

1. Confirm the current working directory with the user
2. Check if `.mcp.json` already exists — if so, warn and ask before overwriting
3. Check pnpm version is at least 10.32.1:
   ```bash
   pnpm --version
   ```
   If the version is lower than 10.32.1, stop and tell the user to upgrade pnpm before continuing.
4. Run the setup CLI and capture output to detect whether pnpm modified anything:
   ```bash
   pnpm add -g @mfjjs/ruflo-setup
   pnpm add -g ruflo@latest 2>&1 | tee /tmp/ruflo-pnpm-add.log
   ```
   After the `pnpm add -g ruflo@latest` step, inspect the output. If pnpm installed or updated any packages (i.e. the output does NOT contain "Already up to date" or an equivalent no-change message), run:
   ```bash
   pnpm approve-builds -g --all
   ```
   Skip `approve-builds` if nothing changed.
5. Run the setup tool:
   ```bash
   ruflo-setup
   ```
6. Report what was installed and remind the user to restart Claude Code to load the new MCP servers

### cleanup

When the user runs `/ruflo-setup cleanup`:

1. Warn the user that this will remove Ruflo packages from the **npm** global registry and ask for confirmation
2. On confirmation, run:
   ```bash
   ruflo-setup cleanup
   ```
3. Report which packages were removed and which were not found (not found is fine — it means they were already clean)
