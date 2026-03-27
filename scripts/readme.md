# Ruflo Install Scripts

This folder contains installer scripts for Ruflo — AI Agent Orchestration for Claude Code.

| Script | Platform | Description |
|---|---|---|
| `install.sh` | macOS / Linux | Bash installer |
| `ruflo-install.ps1` | Windows | PowerShell installer (equivalent of `install.sh`) |

---

## What `install.sh` does

The bash script is a self-contained installer that can be piped directly from a URL:

```bash
curl -fsSL https://cdn.jsdelivr.net/gh/ruvnet/claude-flow@main/scripts/install.sh | bash
```

It runs through these steps in order:

1. **Requirements check** — verifies Node.js 20+ and npm are present; installs Claude Code CLI if missing
2. **Show install plan** — prints the selected package, mode (global vs npx), and profile (full vs minimal)
3. **Install** — runs `npm install -g ruflo@<version>` (global) or pre-warms the npx cache (on-demand)
4. **Verify** — confirms the installed binary responds to `--version`
5. **MCP setup** *(optional)* — registers `ruflo mcp start` as a Claude Code MCP server via `claude mcp add`
6. **Doctor** *(optional)* — runs `ruflo doctor` to check system health
7. **Init** *(on by default)* — runs `ruflo init --yes` to scaffold the current project
8. **Quick-start summary** — prints the most useful follow-up commands

---

## What `ruflo-install.ps1` does

The PowerShell script is a line-for-line functional equivalent of `install.sh`, rewritten for Windows. It performs the same 8 steps in the same order using native PowerShell idioms.

**Key difference from the bash script:** uses `pnpm` instead of `npm` for all install operations, consistent with this project's conventions.

### Usage

```powershell
# Default (npx mode, project init enabled)
.\ruflo-install.ps1

# Full setup — global install + MCP + doctor + init
.\ruflo-install.ps1 -Full

# Global install only
.\ruflo-install.ps1 -Global

# Global, minimal (no WASM/ML optional packages)
.\ruflo-install.ps1 -Global -Minimal

# Specific version
.\ruflo-install.ps1 -Version "3.5.0" -Global

# Global + MCP setup, skip project init
.\ruflo-install.ps1 -Global -SetupMcp -NoInit

# See all options
Get-Help .\ruflo-install.ps1 -Full
```

### Flags

| Flag | Short | Description |
|---|---|---|
| `-Global` | `-g` | Install globally via `pnpm add -g` |
| `-Minimal` | `-m` | Skip optional dependencies (no WASM/ML packages, ~45 MB vs ~340 MB) |
| `-SetupMcp` | `-mcp` | Auto-configure MCP server for Claude Code |
| `-Doctor` | `-d` | Run `ruflo doctor` diagnostics after install |
| `-NoInit` | | Skip project initialization |
| `-Full` | `-f` | Enable Global + SetupMcp + Doctor + Init |
| `-Version` | | Install a specific version (default: `latest`) |

### Environment variable overrides

Set these before running the script to change defaults without flags:

```powershell
$env:RUFLO_VERSION         = "alpha"   # version to install
$env:CLAUDE_FLOW_GLOBAL    = "1"       # enable global install
$env:CLAUDE_FLOW_MINIMAL   = "1"       # enable minimal install
$env:CLAUDE_FLOW_SETUP_MCP = "1"       # enable MCP setup
$env:CLAUDE_FLOW_DOCTOR    = "1"       # run doctor after install
$env:CLAUDE_FLOW_INIT      = "0"       # disable init
```

### Execution policy

If Windows blocks the script, allow it with:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

---

## Differences between `install.sh` and `ruflo-install.ps1`

| Aspect | `install.sh` | `ruflo-install.ps1` |
|---|---|---|
| Package manager | `npm` | `pnpm` |
| Node.js install hint | fnm | winget / nodejs.org |
| Spinner animation | Unicode spinner chars | Not implemented (Windows terminal varies) |
| Error handling | `set -euo pipefail` | `$ErrorActionPreference = 'Stop'` |
| MCP / doctor / init failures | Silent (`\|\| true`) | Silent (`try/catch`, non-fatal) |
