#Requires -Version 5.1
<#
.SYNOPSIS
    Ruflo Installer for Windows (PowerShell equivalent of install.sh)

.DESCRIPTION
    Installs Ruflo (AI Agent Orchestration for Claude Code) on Windows.
    Supports global install, minimal install, MCP server setup, diagnostics, and project init.

.PARAMETER Global
    Install globally via pnpm add -g

.PARAMETER Minimal
    Minimal install — skip optional dependencies (no WASM/ML packages)

.PARAMETER SetupMcp
    Auto-configure the MCP server for Claude Code after install

.PARAMETER Doctor
    Run ruflo doctor diagnostics after install

.PARAMETER NoInit
    Skip project initialization (init runs by default)

.PARAMETER Full
    Full setup: global + MCP + doctor + init

.PARAMETER Version
    Specific version to install (default: latest)

.EXAMPLE
    .\ruflo-install.ps1
    .\ruflo-install.ps1 -Full
    .\ruflo-install.ps1 -Global -Minimal
    .\ruflo-install.ps1 -Version "3.5.0" -Global

.NOTES
    Environment variable overrides (set before running):
      $env:RUFLO_VERSION         = "alpha"     # version to install
      $env:CLAUDE_FLOW_MINIMAL   = "1"         # enable minimal install
      $env:CLAUDE_FLOW_GLOBAL    = "1"         # enable global install
      $env:CLAUDE_FLOW_SETUP_MCP = "1"         # enable MCP setup
      $env:CLAUDE_FLOW_DOCTOR    = "1"         # enable doctor run
      $env:CLAUDE_FLOW_INIT      = "0"         # disable init
#>

[CmdletBinding()]
param(
    [Alias('g')][switch]$Global,
    [Alias('m')][switch]$Minimal,
    [Alias('mcp')][switch]$SetupMcp,
    [Alias('d')][switch]$Doctor,
    [Alias('i')][switch]$Init,
    [switch]$NoInit,
    [Alias('f')][switch]$Full,
    [string]$Version = ""
)

$ErrorActionPreference = 'Stop'

# ── Resolve configuration (flags override env vars) ──────────────────────────

$cfg = @{
    Version   = if ($Version)         { $Version }
                elseif ($env:RUFLO_VERSION)       { $env:RUFLO_VERSION }
                elseif ($env:CLAUDE_FLOW_VERSION)  { $env:CLAUDE_FLOW_VERSION }
                else                              { "latest" }
    Minimal   = ($Minimal -or $env:CLAUDE_FLOW_MINIMAL   -eq "1")
    Global    = ($Global  -or $env:CLAUDE_FLOW_GLOBAL    -eq "1")
    SetupMcp  = ($SetupMcp -or $env:CLAUDE_FLOW_SETUP_MCP -eq "1")
    Doctor    = ($Doctor  -or $env:CLAUDE_FLOW_DOCTOR    -eq "1")
    RunInit   = -not ($NoInit -or $env:CLAUDE_FLOW_INIT -eq "0")
}

# --full enables everything
if ($Full) {
    $cfg.Global   = $true
    $cfg.SetupMcp = $true
    $cfg.Doctor   = $true
    $cfg.RunInit  = $true
}

$package = "ruflo@$($cfg.Version)"

# ── Output helpers ────────────────────────────────────────────────────────────

function Write-Banner {
    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║  " -ForegroundColor Cyan -NoNewline
    Write-Host "Ruflo" -ForegroundColor White -NoNewline
    Write-Host " — AI Agent Orchestration for Claude Code     " -NoNewline
    Write-Host "║" -ForegroundColor Cyan
    Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step   ([string]$msg) { Write-Host "▸ $msg" -ForegroundColor Green }
function Write-Sub    ([string]$msg) { Write-Host "  ├─ $msg" -ForegroundColor DarkGray }
function Write-Ok     ([string]$msg) { Write-Host "✓ $msg" -ForegroundColor Green }
function Write-Warn   ([string]$msg) { Write-Host "⚠ $msg" -ForegroundColor Yellow }
function Write-Err    ([string]$msg) { Write-Host "✗ $msg" -ForegroundColor Red }
function Write-Info   ([string]$msg) { Write-Host "ℹ $msg" -ForegroundColor Cyan }

# ── Requirement checks ────────────────────────────────────────────────────────

function Test-Requirements {
    Write-Step "Checking requirements..."

    # Node.js
    $nodePath = Get-Command node -ErrorAction SilentlyContinue
    if ($nodePath) {
        $nodeVer = (node -e "process.stdout.write(process.version)").TrimStart('v')
        $nodeMajor = [int]($nodeVer.Split('.')[0])
        if ($nodeMajor -ge 20) {
            Write-Sub "Node.js v$nodeVer ✓"
        } else {
            Write-Err "Node.js 20+ required (found v$nodeVer)"
            Write-Host ""
            Write-Host "Install Node.js 20+ from: https://nodejs.org"
            Write-Host "  Or with winget: winget install OpenJS.NodeJS.LTS"
            exit 1
        }
    } else {
        Write-Err "Node.js not found"
        Write-Host ""
        Write-Host "Install Node.js 20+ from: https://nodejs.org"
        Write-Host "  Or with winget: winget install OpenJS.NodeJS.LTS"
        exit 1
    }

    # pnpm
    $pnpmPath = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($pnpmPath) {
        $pnpmVer = (pnpm --version).Trim()
        Write-Sub "pnpm v$pnpmVer ✓"
    } else {
        Write-Err "pnpm not found"
        Write-Host ""
        Write-Host "Install pnpm (recommended):"
        Write-Host "  winget install -e --id pnpm.pnpm"
        Write-Host "  Or: corepack enable && corepack prepare pnpm@latest --activate"
        exit 1
    }

    # Claude Code CLI
    $claudePath = Get-Command claude -ErrorAction SilentlyContinue
    if ($claudePath) {
        $claudeVer = (claude --version 2>$null | Select-Object -First 1) ?? "installed"
        Write-Sub "Claude Code $claudeVer ✓"
    } else {
        Write-Warn "Claude Code CLI not found"
        Write-Sub "Installing Claude Code CLI via pnpm..."
        try {
            pnpm add -g @anthropic-ai/claude-code 2>$null
            if (Get-Command claude -ErrorAction SilentlyContinue) {
                $claudeVer = (claude --version 2>$null | Select-Object -First 1) ?? "installed"
                Write-Sub "Claude Code $claudeVer ✓"
            } else {
                Write-Sub "Installed. Restart terminal to use 'claude' command."
            }
        } catch {
            Write-Warn "Auto-install failed. Install manually:"
            Write-Sub "pnpm add -g @anthropic-ai/claude-code"
        }
    }

    Write-Host ""
}

# ── Show install plan ─────────────────────────────────────────────────────────

function Show-InstallOptions {
    Write-Step "Installation options:"
    Write-Sub "Package: $package"
    if ($cfg.Global)   { Write-Sub "Mode: Global (pnpm add -g)" }
    else               { Write-Sub "Mode: npx (on-demand)" }
    if ($cfg.Minimal)  { Write-Sub "Profile: Minimal (--ignore-scripts, no optional deps)" }
    else               { Write-Sub "Profile: Full (all features)" }
    Write-Host ""
}

# ── Install ───────────────────────────────────────────────────────────────────

function Install-Package {
    $startTime = Get-Date

    if ($cfg.Global) {
        Write-Step "Installing globally..."
        if ($cfg.Minimal) {
            pnpm add -g $package --ignore-scripts
        } else {
            pnpm add -g $package
        }
    } else {
        Write-Step "Installing for npx usage..."
        # Pre-warm the npx cache
        $null = npx -y $package --version 2>$null
        Write-Sub "Package installed for npx"
    }

    $duration = [int]((Get-Date) - $startTime).TotalSeconds
    Write-Host ""
    Write-Ok "Installed in ${duration}s"
}

# ── Verify ────────────────────────────────────────────────────────────────────

function Test-Installation {
    Write-Step "Verifying installation..."

    $versionOutput = $null
    if ($cfg.Global) {
        try { $versionOutput = (ruflo --version 2>$null) } catch {}
        if (-not $versionOutput) {
            try { $versionOutput = (claude-flow --version 2>$null) } catch {}
        }
        if (-not $versionOutput) {
            Write-Warn "Global command not found in PATH yet"
            Write-Sub "Restart your terminal, then run: ruflo --version"
            return
        }
    } else {
        try { $versionOutput = (npx $package --version 2>$null) } catch {}
    }

    if ($versionOutput) {
        Write-Sub "Version: $versionOutput"
        Write-Host ""
    } else {
        Write-Err "Installation verification failed"
        exit 1
    }
}

# ── MCP setup ─────────────────────────────────────────────────────────────────

function Set-McpServer {
    if (-not $cfg.SetupMcp) { return }

    Write-Step "Setting up MCP server..."

    if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
        Write-Warn "Claude CLI not found, skipping MCP setup"
        return
    }

    # Check if already configured
    $mcpList = claude mcp list 2>$null
    if ($mcpList -match "ruflo|claude-flow") {
        Write-Sub "MCP server already configured ✓"
        return
    }

    try {
        if ($cfg.Global) {
            claude mcp add ruflo -- ruflo mcp start
        } else {
            claude mcp add ruflo -- npx -y "ruflo@$($cfg.Version)" mcp start
        }
        Write-Sub "MCP server configured ✓"
    } catch {
        if ($cfg.Global) {
            Write-Warn "MCP setup failed. Run manually: claude mcp add ruflo -- ruflo mcp start"
        } else {
            Write-Warn "MCP setup failed. Run manually: claude mcp add ruflo -- npx -y ruflo@latest mcp start"
        }
    }
    Write-Host ""
}

# ── Doctor ────────────────────────────────────────────────────────────────────

function Invoke-Doctor {
    if (-not $cfg.Doctor) { return }

    Write-Step "Running diagnostics..."
    Write-Host ""
    try {
        if ($cfg.Global) { ruflo doctor }
        else             { npx "ruflo@$($cfg.Version)" doctor }
    } catch { <# non-fatal #> }
    Write-Host ""
}

# ── Init ──────────────────────────────────────────────────────────────────────

function Invoke-Init {
    if (-not $cfg.RunInit) { return }

    Write-Step "Initializing project..."
    Write-Host ""
    try {
        if ($cfg.Global) { ruflo init --yes }
        else             { npx "ruflo@$($cfg.Version)" init --yes }
    } catch { <# non-fatal #> }
    Write-Host ""
}

# ── Quick-start summary ───────────────────────────────────────────────────────

function Show-QuickStart {
    Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║  " -ForegroundColor Cyan -NoNewline
    Write-Host "Quick Start" -ForegroundColor White -NoNewline
    Write-Host "                                              ║" -ForegroundColor Cyan
    Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""

    if ($cfg.Global) {
        Write-Host "  # Initialize project"         -ForegroundColor DarkGray
        Write-Host "  ruflo init --wizard"
        Write-Host ""
        Write-Host "  # Run system diagnostics"     -ForegroundColor DarkGray
        Write-Host "  ruflo doctor"
        Write-Host ""
        Write-Host "  # Add as MCP server to Claude Code" -ForegroundColor DarkGray
        Write-Host "  claude mcp add ruflo -- ruflo mcp start"
    } else {
        Write-Host "  # Initialize project"         -ForegroundColor DarkGray
        Write-Host "  npx ruflo@latest init --wizard"
        Write-Host ""
        Write-Host "  # Run system diagnostics"     -ForegroundColor DarkGray
        Write-Host "  npx ruflo@latest doctor"
        Write-Host ""
        Write-Host "  # Add as MCP server to Claude Code" -ForegroundColor DarkGray
        Write-Host "  claude mcp add ruflo -- npx -y ruflo@latest mcp start"
    }

    Write-Host ""
    Write-Host "  Documentation: https://github.com/ruvnet/ruflo" -ForegroundColor DarkGray
    Write-Host "  Issues:        https://github.com/ruvnet/ruflo/issues" -ForegroundColor DarkGray
    Write-Host ""
}

# ── Main ──────────────────────────────────────────────────────────────────────

Write-Banner
Test-Requirements
Show-InstallOptions
Install-Package
Test-Installation
Set-McpServer
Invoke-Doctor
Invoke-Init
Show-QuickStart
Write-Ok "Ruflo is ready!"
Write-Host ""
