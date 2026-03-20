# @mfjjs/ruflo-setup

Cross-platform npm CLI to bootstrap a project with Ruflo on Windows and Linux.

> **Deep dive:** [`docs/ruflo-benefits.md`](https://github.com/mfjassociates/ruflo-setup/blob/main/docs/ruflo-benefits.md) is a comprehensive reference (~900 lines) covering every feature layer, the MinCut/RuVector/RVF internals, all 80+ agents, 33 skills, 65 slash commands, and how agents and skills are invoked. Not a quick read.

## 📘 What this project is

`@mfjjs/ruflo-setup` implements the setup with a Node-based CLI command:

- Package name: `@mfjjs/ruflo-setup`
- Command name: `ruflo-setup`
- Platform support: Windows and Linux (plus macOS by default)

## 💡 Why You Need This

If you're working on:

* A brownfield application that never had RuFlow configured, or
* A brand‑new project that hasn't been set up with RuFlow yet,

…then you currently have to configure RuFlow manually in each project. That means recreating the same structure, wiring, and boilerplate over and over.

`ruflo-setup` eliminates all of that. When you run it inside a project directory, it automatically generates the required RuFlow scaffolding — including all the files that belong in the `.claude/` folder — so every project starts from a clean, consistent baseline.

You only need to do this once per project. Just run the command and you're ready to go.

## 📋 Requirements
<details>
  <summary>Click to toggle visibility</summary>

- Node.js 20+
- pnpm **10.32.1 or higher** available on PATH

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
</details>

## 📦 Installation

Install the CLI globally once:

```bash
pnpm add -g @mfjjs/ruflo-setup
```

## 🚀 Usage

### Setup

**First, change to your project directory**, then run:

```bash
ruflo-setup
```

That's it for most users. The command will:
1. Check for a newer version of itself and offer to update before proceeding
2. Install `ruflo@latest` globally and run `ruflo init --full` to scaffold your project
3. Write a platform-aware `.mcp.json`
4. Install a global Claude Code `SessionStart` hook

Additional options:

```bash
# non-interactive (skip all prompts)
ruflo-setup --yes

# preview what would happen without making any changes
ruflo-setup --dry-run

# skip the ruflo global install step
ruflo-setup --skip-init

# skip global hook installation
ruflo-setup --no-hooks

# hook operations
ruflo-setup hooks install
ruflo-setup hooks status
```

### Status

Check whether all Ruflo feature layers (0–8) are enabled in the current project:

```bash
ruflo-setup status
```

This prints a layer-by-layer report showing which features are active — prerequisites, global packages, optional WASM/ML packages, MCP servers, tool groups, environment variables, project scaffolding, and the Docker chat UI stack.

### Bootstrap

Use this once if you want Claude Code to expose the `/ruflo-setup` command globally, so you can run it from inside Claude Code chat without using the shell.

```bash
ruflo-setup hooks init
```

After that, when you open Claude Code in a project that does not already have Ruflo configured, you can run [**/ruflo-setup**](noop:) to start the setup flow.

### Update

Update `@mfjjs/ruflo-setup` itself to the latest published version:

```bash
ruflo-setup update
```

It is best to always have the latest version before running setup. When you run `ruflo-setup` without arguments it automatically checks for a newer version and will prompt you to update if one is found, so in most cases you will not need to run this manually.

```bash
# preview without making changes
ruflo-setup update --dry-run
```

### Cleanup

If you previously installed any Ruflo packages via `npm install -g`, those npm-global copies can shadow or conflict with the pnpm-managed versions. Run this to remove them and give yourself a clean slate:

```bash
ruflo-setup cleanup
```

This uninstalls `ruflo`, `@mfjjs/ruflo-setup`, `ruflo-setup`, `claude-flow`, `@claude-flow/cli`, and `ruv-swarm` from the **npm** global registry only — it does not touch pnpm globals.

```bash
# preview what would be removed without making changes
ruflo-setup cleanup --dry-run
```

## 🗂️ Project structure

- `package.json`: npm metadata, scripts, and `bin` mapping
- `bin/ruflo-setup.js`: executable entry file the shell runs
- `src/cli.js`: command router and argument handling
- `src/setup.js`: setup workflow (`init`, `.mcp.json`, template copy)
- `src/status.js`: layer-by-layer feature status checker (Layers 0–8)
- `src/hooks.js`: global `check-ruflo` hook install/status
- `src/utils.js`: reusable filesystem and argument helpers
- `templates/CLAUDE.md`: bundled template copied into target project
- `claude-hooks/check-ruflo.cjs`: SessionStart hook payload
- `tests/cli.test.mjs`: smoke tests for CLI behavior

## 🖥️ What the command line calls

After install/link, `ruflo-setup` resolves to your package `bin` entry:

```json
{
	"bin": {
		"ruflo-setup": "./bin/ruflo-setup.js"
	}
}
```

The shell shim launches `bin/ruflo-setup.js`, which imports `src/cli.js`, which dispatches to setup or hook subcommands.

## ⚙️ How the CLI entry point works

Flow:

1. `ruflo-setup` is invoked.
2. npm/pnpm command shim runs `bin/ruflo-setup.js`.
3. `bin/ruflo-setup.js` forwards args to `runCli(...)`.
4. `src/cli.js` parses command and flags.
5. `src/setup.js` runs setup steps:
	 - checks for a newer version of itself and prompts to update
	 - optional `pnpm add -g ruflo@latest` then `ruflo init --full`
	 - writes platform-aware `.mcp.json`
	 - copies `templates/CLAUDE.md`
	 - installs global SessionStart hook (unless skipped)

When called as `ruflo-setup status`, step 5 dispatches to `src/status.js` which checks all layers (0–8) and prints a feature status report.

When called as `ruflo-setup update`, it runs `pnpm add -g @mfjjs/ruflo-setup@latest` to update the tool itself.

When called as `ruflo-setup cleanup`, it removes Ruflo packages from the npm global registry to eliminate conflicts with pnpm-managed versions.

## 🛠️ Local development with pnpm

From this repository root (`setup-ruflo/`):

```bash
pnpm install
pnpm test
pnpm run test:cli
```

## 🔗 Link locally so command works everywhere

```bash
# from setup-ruflo/
pnpm link --global

# now use from any folder
ruflo-setup --dry-run --skip-init
```

This is the fast edit loop: change files in `src/`, rerun `ruflo-setup`, and behavior updates immediately without reinstall.

## 🧪 Simulate a real install (deploy-style testing)

Create a tarball and install it into a clean test location.

```bash
# from setup-ruflo/
pnpm pack

# then in a clean temp folder
pnpm add -g ./mfjjs-ruflo-setup-0.1.0.tgz
ruflo-setup --dry-run --skip-init
```

This tests exactly what users get from a package install.

## 🪝 Global hook behavior

`ruflo-setup` installs a global Claude SessionStart command hook that runs:

- `claude-hooks/check-ruflo.cjs`

It merges into existing global settings instead of replacing them, and creates a backup of the settings file before writing.
