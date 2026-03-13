# /ruflo-setup

Set up Ruflo + Claude Flow V3 in the current project directory.

## Requirements

- Node.js 20+
- pnpm installed and available on PATH

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

## Instructions for Claude

When the user runs /ruflo-setup:

1. Confirm the current working directory with the user
2. Check if `.mcp.json` already exists — if so, warn and ask before overwriting
3. Run the setup CLI:
   ```bash
   pnpm add -g @mfjjs/ruflo-setup
   ruflo-setup
   ```
4. Report what was installed and remind the user to restart Claude Code to load the new MCP servers
