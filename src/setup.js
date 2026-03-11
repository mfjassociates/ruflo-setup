import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathExists, copyFileSync, confirm, toPlatformMcpConfig, writeJson } from './utils.js';
import { installGlobalCheckRufloHook } from './hooks.js';

function logLine(message) {
  process.stdout.write(`${message}\n`);
}

function getPnpmInstallSuggestions(platform) {
  if (platform === 'win32') {
    return [
      'winget install -e --id pnpm.pnpm',
      'corepack enable && corepack prepare pnpm@latest --activate',
      'npm install -g pnpm'
    ];
  }

  if (platform === 'darwin') {
    return [
      'brew install pnpm',
      'corepack enable && corepack prepare pnpm@latest --activate',
      'npm install -g pnpm'
    ];
  }

  return [
    'curl -fsSL https://get.pnpm.io/install.sh | sh -',
    'corepack enable && corepack prepare pnpm@latest --activate',
    'npm install -g pnpm'
  ];
}

function ensurePnpmAvailable() {
  const check = spawnSync('pnpm', ['--version'], {
    stdio: 'ignore',
    shell: process.platform === 'win32'
  });

  if (check.status === 0 && !check.error) {
    return;
  }

  const platformLabel = process.platform === 'win32'
    ? 'Windows'
    : process.platform === 'darwin'
      ? 'macOS'
      : 'Linux';
  const suggestions = getPnpmInstallSuggestions(process.platform)
    .map((command) => `  - ${command}`)
    .join('\n');

  throw new Error(
    `pnpm is required but was not found in PATH.\n` +
    `Install pnpm, then re-run ruflo-setup.\n` +
    `Quick install options for ${platformLabel}:\n${suggestions}`
  );
}

function runPnpmInit({ force, cwd, dryRun }) {
  const initArgs = ['init', '--full'];
  if (force) {
    initArgs.push('--force');
  }

  if (dryRun) {
    logLine(`  [DRY RUN] Would run: pnpm add -g ruflo@latest`);
    logLine(`  [DRY RUN] Would run: ruflo ${initArgs.join(' ')}`);
    return;
  }

  ensurePnpmAvailable();

  const install = spawnSync('pnpm', ['add', '-g', 'ruflo@latest'], {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  if (install.status !== 0) {
    throw new Error(`pnpm add -g ruflo@latest failed with exit code ${install.status}`);
  }

  const run = spawnSync('ruflo', initArgs, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  if (run.status !== 0) {
    throw new Error(`ruflo init failed with exit code ${run.status}`);
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

function installGlobalCommand({ packageRoot, dryRun }) {
  const src = path.join(packageRoot, 'templates', 'ruflo-setup.md');
  const dest = path.join(os.homedir(), '.claude', 'commands', 'ruflo-setup.md');

  if (dryRun) {
    logLine(`  [DRY RUN] Would write: ${dest}`);
    return { dest };
  }

  copyFileSync(src, dest);
  return { dest };
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
    logLine('Step 1: Running pnpm add -g ruflo@latest && ruflo init --full ...');
    runPnpmInit({ force, cwd, dryRun });
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

  if (!noHooks) {
    logLine('Step 3: Installing global SessionStart check-ruflo hook ...');
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
    logLine('Step 3: Skipped hook installation (--no-hooks).');
    logLine('');
  }

  logLine('Step 4: Installing global /ruflo-setup command ...');
  const commandResult = installGlobalCommand({ packageRoot, dryRun });
  if (!dryRun) {
    logLine(`  Command installed at: ${commandResult.dest}`);
  }
  logLine('');

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
