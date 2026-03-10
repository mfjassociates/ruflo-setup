import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathExists, copyFileSync, confirm, toPlatformMcpConfig, writeJson } from './utils.js';
import { installGlobalCheckRufloHook } from './hooks.js';

function logLine(message) {
  process.stdout.write(`${message}\n`);
}

function runNpxInit({ force, cwd, dryRun }) {
  const args = ['ruflo@latest', 'init', '--full'];
  if (force) {
    args.push('--force');
  }

  if (dryRun) {
    logLine(`  [DRY RUN] Would run: npx ${args.join(' ')}`);
    return;
  }

  const result = spawnSync('npx', args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    throw new Error(`ruflo init failed with exit code ${result.status}`);
  }
}

function writeMcpJson({ cwd, dryRun }) {
  const mcpPath = path.join(cwd, '.mcp.json');
  const mcpConfig = toPlatformMcpConfig(process.platform);

  if (dryRun) {
    const action = pathExists(mcpPath) ? 'overwrite' : 'write';
    logLine(`  [DRY RUN] Would ${action}: ${mcpPath}`);
    return;
  }

  writeJson(mcpPath, mcpConfig);
  logLine('  .mcp.json written for this platform.');
}

async function copyTemplateClaude({ cwd, force, dryRun, templatePath, yes }) {
  const destination = path.join(cwd, 'CLAUDE.md');

  if (pathExists(destination) && !force && !dryRun && !yes) {
    logLine('  WARNING: CLAUDE.md already exists.');
    const shouldOverwrite = await confirm('  Overwrite with template? [y/N] ');
    if (!shouldOverwrite) {
      logLine('  Skipped CLAUDE.md (kept existing).');
      return;
    }
  }

  if (dryRun) {
    if (pathExists(destination)) {
      logLine(`  [DRY RUN] Would overwrite: ${destination}`);
    } else {
      logLine(`  [DRY RUN] Would copy CLAUDE.md to: ${destination}`);
    }
    return;
  }

  copyFileSync(templatePath, destination);
  if (pathExists(destination)) {
    logLine('  CLAUDE.md copied from template.');
  }
}

function isAlreadyConfigured(cwd) {
  return pathExists(path.join(cwd, '.mcp.json')) || pathExists(path.join(cwd, '.claude', 'settings.json'));
}

export async function runSetup({
  cwd,
  packageRoot,
  force = false,
  dryRun = false,
  skipInit = false,
  noHooks = false,
  yes = false,
  verbose = false
}) {
  const templateClaude = path.join(packageRoot, 'templates', 'CLAUDE.md');

  if (!fs.existsSync(templateClaude)) {
    throw new Error(`Template CLAUDE.md not found at: ${templateClaude}`);
  }

  logLine('');
  logLine('Ruflo Setup (npm CLI)');
  logLine(`Target directory: ${cwd}`);
  if (dryRun) {
    logLine('[DRY RUN - no changes will be made]');
  }
  logLine('');

  if (isAlreadyConfigured(cwd) && !force && !yes) {
    logLine('WARNING: This project already has Ruflo configuration.');
    const shouldOverwrite = await confirm('Overwrite existing configuration? [y/N] ');
    if (!shouldOverwrite) {
      logLine('Aborted. No changes made.');
      return;
    }
  }

  if (!skipInit) {
    logLine('Step 1: Running npx ruflo@latest init --full ...');
    runNpxInit({ force, cwd, dryRun });
    if (!dryRun) {
      logLine('  ruflo init completed.');
    }
    logLine('');
  } else {
    logLine('Step 1: Skipped ruflo init (--skip-init).');
    logLine('');
  }

  logLine('Step 2: Writing platform-aware .mcp.json ...');
  writeMcpJson({ cwd, dryRun });
  logLine('');

  logLine('Step 3: Copying template CLAUDE.md ...');
  await copyTemplateClaude({ cwd, force, dryRun, templatePath: templateClaude, yes });
  logLine('');

  if (!noHooks) {
    logLine('Step 4: Installing global SessionStart check-ruflo hook ...');
    const hookResult = installGlobalCheckRufloHook({ packageRoot, dryRun });
    if (hookResult.inserted) {
      logLine(`  Hook installed in: ${hookResult.settingsPath}`);
    } else {
      logLine(`  Hook already present in: ${hookResult.settingsPath}`);
    }
    if (verbose) {
      logLine(`  Hook command: ${hookResult.hookCommand}`);
    }
    logLine('');
  } else {
    logLine('Step 4: Skipped hook installation (--no-hooks).');
    logLine('');
  }

  if (dryRun) {
    logLine('Dry run complete. No changes were made.');
    return;
  }

  logLine('Setup complete!');
  logLine('');
  logLine('Next steps:');
  logLine('  1. Edit CLAUDE.md for project-specific Build & Test commands');
  logLine('  2. Run: claude');
  logLine('  3. Verify hooks: ruflo-setup hooks status');
}
