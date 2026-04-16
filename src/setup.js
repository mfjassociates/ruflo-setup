import fs from 'node:fs';
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

const MIN_PNPM_VERSION = '10.32.1';

function parseSemver(str) {
  const [major = 0, minor = 0, patch = 0] = str.trim().split('.').map(Number);
  return { major, minor, patch };
}

function semverGte(a, b) {
  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  return a.patch >= b.patch;
}

function semverLt(a, b) {
  return !semverGte(a, b);
}

function getInstalledVersion(pkg) {
  const result = spawnSync('pnpm', ['list', '-g', pkg, '--json'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32'
  });
  if (result.status !== 0) return null;
  try {
    const data = JSON.parse((result.stdout || '').toString());
    const deps = data[0]?.dependencies || {};
    return deps[pkg]?.version ?? null;
  } catch {
    return null;
  }
}

function getRegistryVersion(pkg) {
  const result = spawnSync('pnpm', ['view', pkg, 'version'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32'
  });
  if (result.status !== 0) return null;
  return (result.stdout || '').toString().trim() || null;
}

function ensurePnpmAvailable() {
  const check = spawnSync('pnpm', ['--version'], {
    stdio: ['ignore', 'pipe', 'ignore'],
    shell: process.platform === 'win32'
  });

  if (check.status !== 0 || check.error) {
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

  const version = (check.stdout || '').toString().trim();
  if (!semverGte(parseSemver(version), parseSemver(MIN_PNPM_VERSION))) {
    throw new Error(
      `pnpm ${MIN_PNPM_VERSION} or higher is required, but found ${version}.\n` +
      `Upgrade with: pnpm self-update`
    );
  }
}

function runPnpmInit({ force, cwd, dryRun }) {
  const initArgs = ['init', '--full'];
  if (force) {
    initArgs.push('--force');
  }

  if (dryRun) {
    logLine(`  [DRY RUN] Would run: pnpm add -g ruflo@latest`);
    logLine(`  [DRY RUN] Would check: installed version vs registry latest`);
    logLine(`  [DRY RUN] If installed < registry latest: pnpm remove -g ruflo && pnpm add -g ruflo@latest  (cache-bust)`);
    logLine(`  [DRY RUN] Would run: pnpm approve-builds -g --all  (if changes detected)`);
    logLine(`  [DRY RUN] Would run: ruflo ${initArgs.join(' ')}`);
    return;
  }

  ensurePnpmAvailable();

  // Capture stdout to detect whether pnpm installed/updated anything.
  // Progress spinners go to stderr (still shown to user); stdout has the summary.
  const install = spawnSync('pnpm', ['add', '-g', 'ruflo@latest'], {
    cwd,
    stdio: ['inherit', 'pipe', 'inherit'],
    shell: process.platform === 'win32'
  });

  let installOutput = (install.stdout || '').toString();
  if (installOutput) {
    process.stdout.write(installOutput);
  }

  if (install.status !== 0) {
    throw new Error(`pnpm add -g ruflo@latest failed with exit code ${install.status}`);
  }

  // pnpm prints a "Packages:" summary line and "+ pkg version" lines when
  // something is actually installed or updated. When already up to date the
  // stdout is empty or contains only "Already up to date".
  let somethingChanged = /Packages:/i.test(installOutput) || /^\+\s/m.test(installOutput);

  // Check whether the installed version is behind the registry latest.
  // If so, pnpm served a stale cached copy — remove and re-add to force a fresh install.
  const installedVer = getInstalledVersion('ruflo');
  const registryVer  = getRegistryVersion('ruflo');
  if (installedVer && registryVer && semverLt(parseSemver(installedVer), parseSemver(registryVer))) {
    logLine(`  Installed ruflo ${installedVer} is behind registry ${registryVer} — cache-busting with remove + add...`);
    spawnSync('pnpm', ['remove', '-g', 'ruflo'], {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });
    const reinstall = spawnSync('pnpm', ['add', '-g', 'ruflo@latest'], {
      cwd,
      stdio: ['inherit', 'pipe', 'inherit'],
      shell: process.platform === 'win32'
    });
    installOutput = (reinstall.stdout || '').toString();
    if (installOutput) {
      process.stdout.write(installOutput);
    }
    if (reinstall.status !== 0) {
      throw new Error(`pnpm add -g ruflo@latest (after cache-bust) failed with exit code ${reinstall.status}`);
    }
    somethingChanged = true;
  }

  if (somethingChanged) {
    logLine('  Changes detected — running pnpm approve-builds -g --all ...');
    const approve = spawnSync('pnpm', ['approve-builds', '-g', '--all'], {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });
    if (approve.status !== 0) {
      throw new Error(`pnpm approve-builds -g --all failed with exit code ${approve.status}`);
    }
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

function syncGlobalCommandTemplate({ packageRoot, dryRun }) {
  const src = path.join(packageRoot, 'templates', 'ruflo-setup.md');
  const dest = path.join(os.homedir(), '.claude', 'commands', 'ruflo-setup.md');
  const exists = pathExists(dest);
  const operation = exists ? 'update' : 'install';
  const srcContent = fs.readFileSync(src, 'utf8');
  const changed = !exists || fs.readFileSync(dest, 'utf8') !== srcContent;

  if (dryRun || !changed) {
    return { dest, changed, operation };
  }

  copyFileSync(src, dest);
  return { dest, changed, operation };
}

function updateGitignore({ cwd, dryRun }) {
  const gitignorePath = path.join(cwd, '.gitignore');
  const entries = ['.mcp.json', '.claude/settings.json'];

  if (dryRun) {
    logLine(`  [DRY RUN] Would ensure ${gitignorePath} contains: ${entries.join(', ')}`);
    return;
  }

  let content = pathExists(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  const lines = content.split('\n');
  const added = [];

  for (const entry of entries) {
    if (!lines.some((line) => line.trim() === entry)) {
      added.push(entry);
    }
  }

  if (added.length === 0) {
    logLine(`  .gitignore already contains required entries.`);
    return;
  }

  const suffix = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  content = content + suffix + added.join('\n') + '\n';
  fs.writeFileSync(gitignorePath, content, 'utf8');
  logLine(`  Added to .gitignore: ${added.join(', ')}`);
}

function isAlreadyConfigured(cwd) {
  return pathExists(path.join(cwd, '.mcp.json')) || pathExists(path.join(cwd, '.claude', 'settings.json'));
}

function getCurrentVersion(packageRoot) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function getLatestVersion() {
  try {
    const result = spawnSync('pnpm', ['view', '@mfjjs/ruflo-setup', 'version'], {
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: process.platform === 'win32',
      timeout: 8000
    });
    if (result.status !== 0 || result.error) return null;
    return (result.stdout || '').toString().trim() || null;
  } catch {
    return null;
  }
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

  // Check if a newer version of ruflo-setup itself is available.
  if (!dryRun && !yes) {
    const currentVersion = getCurrentVersion(packageRoot);
    const latestVersion = getLatestVersion();
    if (latestVersion && !semverGte(parseSemver(currentVersion), parseSemver(latestVersion))) {
      logLine(`A newer version of ruflo-setup is available: ${latestVersion} (you have ${currentVersion}).`);
      logLine('It is best to always have the latest version before running setup.');
      const doUpdate = await confirm('Update @mfjjs/ruflo-setup now? [y/N] ');
      if (doUpdate) {
        runUpdate({ dryRun: false });
        logLine('');
        logLine('Please re-run ruflo-setup to continue with the updated version.');
        return;
      }
      logLine('');
    }
  }

  logLine('Preflight: Syncing global /ruflo-setup command template ...');
  const preflightCommandResult = syncGlobalCommandTemplate({ packageRoot, dryRun });
  if (preflightCommandResult.changed) {
    if (dryRun) {
      logLine(`  [DRY RUN] Would ${preflightCommandResult.operation}: ${preflightCommandResult.dest}`);
    } else if (preflightCommandResult.operation === 'install') {
      logLine(`  Installed command template at: ${preflightCommandResult.dest}`);
    } else {
      logLine(`  Updated command template at: ${preflightCommandResult.dest}`);
    }
  } else {
    logLine(`  Command template already up to date: ${preflightCommandResult.dest}`);
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

  logLine('Step 3: Updating .gitignore ...');
  updateGitignore({ cwd, dryRun });
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

  logLine('Step 5: Installing global /ruflo-setup command ...');
  if (dryRun) {
    if (preflightCommandResult.changed) {
      logLine(`  [DRY RUN] Would ${preflightCommandResult.operation}: ${preflightCommandResult.dest}`);
    } else {
      logLine(`  [DRY RUN] Command already up to date: ${preflightCommandResult.dest}`);
    }
  } else if (preflightCommandResult.changed) {
    if (preflightCommandResult.operation === 'install') {
      logLine(`  Command installed at: ${preflightCommandResult.dest}`);
    } else {
      logLine(`  Command updated at: ${preflightCommandResult.dest}`);
    }
  } else {
    logLine(`  Command already up to date: ${preflightCommandResult.dest}`);
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

const CLEANUP_NPM_PACKAGES = [
  'ruflo',
  '@mfjjs/ruflo-setup',
  'ruflo-setup',
  'claude-flow',
  '@claude-flow/cli',
  'ruv-swarm'
];

export function runCleanup({ dryRun = false } = {}) {
  logLine('');
  logLine('Ruflo Cleanup — removing from npm global registry');
  logLine(`Packages: ${CLEANUP_NPM_PACKAGES.join(', ')}`);
  logLine('');

  if (dryRun) {
    logLine(`  [DRY RUN] Would run: npm uninstall -g ${CLEANUP_NPM_PACKAGES.join(' ')}`);
    logLine('');
    return;
  }

  const result = spawnSync('npm', ['uninstall', '-g', ...CLEANUP_NPM_PACKAGES], {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    throw new Error(`npm uninstall -g failed with exit code ${result.status}`);
  }

  logLine('');
  logLine('Cleanup complete.');
}

export function runUpdate({ dryRun = false } = {}) {
  logLine('');
  logLine('Ruflo Setup Update');
  logLine('');

  if (dryRun) {
    logLine('[DRY RUN] Would run: pnpm add -g @mfjjs/ruflo-setup@latest');
    logLine('[DRY RUN] Would check: installed version vs registry latest');
    logLine('[DRY RUN] If installed < registry latest: pnpm remove -g @mfjjs/ruflo-setup && pnpm add -g @mfjjs/ruflo-setup@latest  (cache-bust)');
    logLine('');
    return;
  }

  ensurePnpmAvailable();

  logLine('Updating @mfjjs/ruflo-setup to latest...');
  const result = spawnSync('pnpm', ['add', '-g', '@mfjjs/ruflo-setup@latest'], {
    stdio: ['inherit', 'pipe', 'inherit'],
    shell: process.platform === 'win32'
  });

  const updateOutput = (result.stdout || '').toString();
  if (updateOutput) {
    process.stdout.write(updateOutput);
  }

  if (result.status !== 0) {
    throw new Error(`pnpm add -g @mfjjs/ruflo-setup@latest failed with exit code ${result.status}`);
  }

  // Check whether the installed version is behind the registry latest.
  // If so, pnpm served a stale cached copy — remove and re-add to force a fresh install.
  const installedVer = getInstalledVersion('@mfjjs/ruflo-setup');
  const registryVer  = getRegistryVersion('@mfjjs/ruflo-setup');
  if (installedVer && registryVer && semverLt(parseSemver(installedVer), parseSemver(registryVer))) {
    logLine(`  Installed @mfjjs/ruflo-setup ${installedVer} is behind registry ${registryVer} — cache-busting with remove + add...`);
    spawnSync('pnpm', ['remove', '-g', '@mfjjs/ruflo-setup'], {
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });
    const reinstall = spawnSync('pnpm', ['add', '-g', '@mfjjs/ruflo-setup@latest'], {
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });
    if (reinstall.status !== 0) {
      throw new Error(`pnpm add -g @mfjjs/ruflo-setup@latest (after cache-bust) failed with exit code ${reinstall.status}`);
    }
  }

  logLine('');
  logLine('Update complete. Re-run ruflo-setup to continue with the updated version.');
}
