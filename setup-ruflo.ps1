<#
.SYNOPSIS
    Set up Ruflo + Claude Flow V3 in the current project directory.

.DESCRIPTION
    Runs 'npx ruflo@latest init --full' to install all Claude Flow V3
    components, then copies a template CLAUDE.md into the project.

    The template CLAUDE.md is sourced from:
      ~/OneDrive/scripts/claude-template/CLAUDE.md

    After setup, start Claude Code with: claude

.PARAMETER Force
    Overwrite existing files without prompting.

.PARAMETER DryRun
    Show what would be done without making any changes.

.EXAMPLE
    setup-ruflo
    Interactive setup in the current directory.

.EXAMPLE
    setup-ruflo -DryRun
    Preview what would be installed without making changes.

.EXAMPLE
    setup-ruflo -Force
    Install without prompting even if files already exist.
#>
[CmdletBinding()]
param(
    [switch]$Force,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$templateDir = Join-Path $env:USERPROFILE 'OneDrive\scripts\claude-template'
$templateClaude = Join-Path $templateDir 'CLAUDE.md'
$cwd = (Get-Location).Path

# --- Header ---
Write-Host ""
Write-Host "Ruflo + Claude Flow V3 Setup" -ForegroundColor Cyan
Write-Host "Target directory: $cwd"
if ($DryRun) { Write-Host "[DRY RUN - no changes will be made]" -ForegroundColor Yellow }
Write-Host ""

# --- Verify template exists ---
if (-not (Test-Path $templateClaude)) {
    Write-Error "Template CLAUDE.md not found at: $templateClaude`nEnsure ~/OneDrive/scripts/claude-template/CLAUDE.md exists."
    exit 1
}

# --- Check if already configured ---
$alreadyConfigured = (Test-Path (Join-Path $cwd '.mcp.json')) -or
                     (Test-Path (Join-Path $cwd '.claude\settings.json'))

if ($alreadyConfigured -and -not $Force) {
    Write-Host "WARNING: This project already has Ruflo/Claude Flow configuration." -ForegroundColor Yellow
    $confirm = Read-Host "Overwrite existing configuration? [y/N]"
    if ($confirm -notmatch '^[Yy]$') {
        Write-Host "Aborted. No changes made."
        exit 0
    }
}

# --- Step 1: ruflo init --full ---
Write-Host "Step 1: Running npx ruflo@latest init --full ..." -ForegroundColor Cyan
if ($DryRun) {
    Write-Host "  [DRY RUN] Would run: npx ruflo@latest init --full"
} else {
    try {
        $initArgs = @('ruflo@latest', 'init', '--full')
        if ($Force) { $initArgs += '--force' }
        & npx @initArgs
        if ($LASTEXITCODE -ne 0) {
            Write-Error "ruflo init failed with exit code $LASTEXITCODE"
            exit 1
        }
        Write-Host "  ruflo init completed." -ForegroundColor Green
    } catch {
        Write-Error "Failed to run ruflo init: $_"
        exit 1
    }
}

# --- Step 2: Copy CLAUDE.md ---
$destClaude = Join-Path $cwd 'CLAUDE.md'
Write-Host "Step 2: Copying template CLAUDE.md ..." -ForegroundColor Cyan

if (Test-Path $destClaude) {
    if (-not $Force -and -not $DryRun) {
        Write-Host "  WARNING: CLAUDE.md already exists." -ForegroundColor Yellow
        $confirm = Read-Host "  Overwrite with template? [y/N]"
        if ($confirm -notmatch '^[Yy]$') {
            Write-Host "  Skipped CLAUDE.md (kept existing)."
        } else {
            Copy-Item $templateClaude $destClaude -Force
            Write-Host "  CLAUDE.md overwritten from template." -ForegroundColor Green
        }
    } elseif ($DryRun) {
        Write-Host "  [DRY RUN] Would overwrite: $destClaude"
    } else {
        Copy-Item $templateClaude $destClaude -Force
        Write-Host "  CLAUDE.md overwritten from template." -ForegroundColor Green
    }
} else {
    if ($DryRun) {
        Write-Host "  [DRY RUN] Would copy CLAUDE.md to: $destClaude"
    } else {
        Copy-Item $templateClaude $destClaude
        Write-Host "  CLAUDE.md copied from template." -ForegroundColor Green
    }
}

# --- Done ---
Write-Host ""
if ($DryRun) {
    Write-Host "Dry run complete. No changes were made." -ForegroundColor Yellow
} else {
    Write-Host "Setup complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. Edit CLAUDE.md - update the Build & Test section for this project"
    Write-Host "  2. Run: claude"
    Write-Host "  3. The Ruflo MCP server will load automatically"
}
Write-Host ""
