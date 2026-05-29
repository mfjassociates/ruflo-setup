import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import {
  pathExists,
  copyFileSync,
  confirm,
  toPlatformMcpConfig,
  writeJson,
  MIN_NODE_VERSION,
  MIN_PNPM_VERSION,
  parseSemver,
  semverGte
} from './utils.js';
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

function ensureNodeVersion() {
  const nodeVersion = process.versions.node;
  if (!semverGte(parseSemver(nodeVersion), parseSemver(MIN_NODE_VERSION))) {
    throw new Error(
      `Node.js ${MIN_NODE_VERSION} or newer is required, but found ${nodeVersion}.\n` +
      `Install/select Node.js ${MIN_NODE_VERSION}+ and re-run ruflo-setup.`
    );
  }
}

function getInstalledVersion(pkg, commandRunner = spawnSync) {
  const result = commandRunner('pnpm', ['list', '-g', pkg, '--json'], {
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

function getRegistryVersion(pkg, commandRunner = spawnSync) {
  const result = commandRunner('pnpm', ['view', pkg, 'version'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32'
  });
  if (result.status !== 0) return null;
  return (result.stdout || '').toString().trim() || null;
}

function ensurePnpmAvailable(commandRunner = spawnSync) {
  const check = commandRunner('pnpm', ['--version'], {
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
    const nvm4wShimNote = process.platform === 'win32'
      ? `\nIf using NVM4W + Node 22.22.x, ensure this path is on PATH:\n` +
        `  C:\\nvm4w\\nodejs\\node_modules\\corepack\\shims\n` +
        `Old shim paths are no longer used by newer Node 22.22.x builds.`
      : '';

    throw new Error(
      `pnpm is required but was not found in PATH.\n` +
      `Install pnpm, then re-run ruflo-setup.\n` +
      `Quick install options for ${platformLabel}:\n${suggestions}${nvm4wShimNote}`
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

function ensureRequiredRuntime(commandRunner = spawnSync) {
  ensureNodeVersion();
  ensurePnpmAvailable(commandRunner);
}

function isMemoryInitialized(cwd, commandRunner = spawnSync) {
  const result = commandRunner('ruflo', ['memory', 'stats'], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32'
  });
  if (result.status !== 0) return false;
  const output = (result.stdout || '').toString();
  const match = output.match(/Total Entries\s*\|\s*(\d+)/);
  return match ? parseInt(match[1], 10) > 0 : false;
}

function isDaemonRunning(cwd, commandRunner = spawnSync) {
  const result = commandRunner('ruflo', ['daemon', 'status'], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32'
  });
  return /RUNNING/i.test((result.stdout || '').toString());
}

function startRufloRuntime(cwd, commandRunner = spawnSync) {
  logLine('  Starting ruflo runtime (daemon + swarm)...');
  if (isDaemonRunning(cwd, commandRunner)) {
    logLine('  Daemon running — restarting...');
    commandRunner('ruflo', ['daemon', 'stop'], { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  }
  commandRunner('ruflo', ['daemon', 'start'], { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  commandRunner('ruflo', ['swarm', 'init', '--v3-mode'], { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
}

// commandRunner defaults to spawnSync in production (real system commands).
// Tests can inject a fake runner to simulate pnpm/ruflo outputs without touching global installs.
export function runPnpmInit({ force, cwd, dryRun, commandRunner = spawnSync }) {
  const initArgs = ['init', '--full'];
  if (force) {
    initArgs.push('--force');
  }

  if (dryRun) {
    if (process.env.RUFLO_DEV) {
      logLine(`  [DRY RUN] RUFLO_DEV is set — would skip pnpm add -g ruflo@latest (using local copy)`);
    } else {
      logLine(`  [DRY RUN] Would run: pnpm view ruflo version`);
      logLine(`  [DRY RUN] Would compare: installed ruflo version vs registry latest`);
      logLine(`  [DRY RUN] If installed version is missing or older: pnpm add -g ruflo@<resolved-latest-version>`);
      logLine(`  [DRY RUN] If installed version equals registry latest: no changes`);
    }
    logLine(`  [DRY RUN] Would check: ruflo memory stats (Total Entries)`);
    logLine(`  [DRY RUN] First time (entries=0): ruflo ${[...initArgs, '--start-all'].join(' ')}`);
    logLine(`  [DRY RUN] Returning (entries>0): ruflo ${initArgs.join(' ')} + daemon restart + swarm init`);
    return;
  }

  ensurePnpmAvailable(commandRunner);

  if (process.env.RUFLO_DEV) {
    logLine('  RUFLO_DEV is set — skipping pnpm add -g ruflo@latest (using local copy).');
  } else {
    const registryVer = getRegistryVersion('ruflo', commandRunner);
    if (!registryVer) {
      throw new Error('Unable to resolve latest version for ruflo from pnpm registry.');
    }

    const installedVer = getInstalledVersion('ruflo', commandRunner);
    if (installedVer && semverGte(parseSemver(installedVer), parseSemver(registryVer))) {
      logLine(`  ruflo is already up to date (${installedVer}). No global package changes needed.`);
    } else {
      // Capture stdout to detect whether pnpm installed/updated anything.
      // Progress spinners go to stderr (still shown to user); stdout has the summary.
      const install = commandRunner('pnpm', ['add', '-g', `ruflo@${registryVer}`], {
        cwd,
        stdio: ['inherit', 'pipe', 'inherit'],
        shell: process.platform === 'win32'
      });

      const installOutput = (install.stdout || '').toString();
      if (installOutput) {
        process.stdout.write(installOutput);
      }

      if (install.status !== 0) {
        throw new Error(`pnpm add -g ruflo@${registryVer} failed with exit code ${install.status}`);
      }

    }
  } // end RUFLO_DEV else

  const firstTime = !isMemoryInitialized(cwd, commandRunner);
  if (firstTime) {
    logLine('  Memory not yet initialized — will use --start-all.');
    initArgs.push('--start-all');
  } else {
    logLine('  Memory already initialized — will restart runtime after init.');
  }

  const run = commandRunner('ruflo', initArgs, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  if (run.status !== 0) {
    throw new Error(`ruflo init failed with exit code ${run.status}`);
  }

  if (!firstTime) {
    startRufloRuntime(cwd, commandRunner);
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
  const entries = [
    '.mcp.json',
    '.claude/settings.json',
    '.swarm/',
    'ruvector.db',
    '.claude-flow/metrics/',
    '.claude-flow/security/',
    '.claude-flow/CAPABILITIES.md',
    '.claude-flow/config.yaml',
    '.claude-flow/swarm/',
    '.claude-flow/daemon-state.json',
    '.claude-flow/daemon.pid',
  ];

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

  ensureRequiredRuntime();

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
    force = true;
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

// commandRunner defaults to spawnSync in production (real system commands).
// Tests can inject a fake runner to verify version-check decisions deterministically.
export function runUpdate({ dryRun = false, commandRunner = spawnSync } = {}) {
  logLine('');
  logLine('Ruflo Setup Update');
  logLine('');

  const pkgName = '@mfjjs/ruflo-setup';

  if (dryRun) {
    logLine(`[DRY RUN] Would run: pnpm view ${pkgName} version`);
    logLine(`[DRY RUN] Would compare: installed ${pkgName} version vs registry latest`);
    logLine(`[DRY RUN] If installed version is missing or older: pnpm add -g ${pkgName}@<resolved-latest-version>`);
    logLine('[DRY RUN] If installed version equals registry latest: no changes');
    logLine('');
    return;
  }

  ensureRequiredRuntime(commandRunner);

  const registryVer = getRegistryVersion(pkgName, commandRunner);
  if (!registryVer) {
    throw new Error(`Unable to resolve latest version for ${pkgName} from pnpm registry.`);
  }

  const installedVer = getInstalledVersion(pkgName, commandRunner);
  if (installedVer && semverGte(parseSemver(installedVer), parseSemver(registryVer))) {
    logLine(`${pkgName} is already up to date (${installedVer}). No changes made.`);
    logLine('');
    return;
  }

  logLine(`Updating ${pkgName} to ${registryVer}...`);
  const result = commandRunner('pnpm', ['add', '-g', `${pkgName}@${registryVer}`], {
    stdio: ['inherit', 'pipe', 'inherit'],
    shell: process.platform === 'win32'
  });

  const updateOutput = (result.stdout || '').toString();
  if (updateOutput) {
    process.stdout.write(updateOutput);
  }

  if (result.status !== 0) {
    throw new Error(`pnpm add -g ${pkgName}@${registryVer} failed with exit code ${result.status}`);
  }

  logLine('');
  logLine('Update complete. Re-run ruflo-setup to continue with the updated version.');
}
