import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

export function pathExists(filePath) {
  return fs.existsSync(filePath);
}

export function readJsonSafe(filePath, fallbackValue = {}) {
  if (!pathExists(filePath)) {
    return fallbackValue;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallbackValue;
  }
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function copyFileSync(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

export async function confirm(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise((resolve) => {
    rl.question(question, resolve);
  });

  rl.close();
  return /^[Yy]$/.test((answer || '').trim());
}

export function parseArgs(argv) {
  const flags = {
    force: false,
    dryRun: false,
    yes: false,
    noHooks: false,
    skipInit: false,
    verbose: false,
    command: 'setup'
  };

  const positional = [];
  for (const item of argv) {
    if (item === '--force' || item === '-f') flags.force = true;
    else if (item === '--dry-run') flags.dryRun = true;
    else if (item === '--yes' || item === '-y') flags.yes = true;
    else if (item === '--no-hooks') flags.noHooks = true;
    else if (item === '--skip-init') flags.skipInit = true;
    else if (item === '--verbose') flags.verbose = true;
    else positional.push(item);
  }

  if (positional.length > 0) {
    flags.command = positional[0];
  }

  return flags;
}

export function toPlatformMcpConfig(platform) {
  const isWindows = platform === 'win32';
  const command = isWindows ? 'cmd' : 'npx';
  const npxArgs = ['-y'];

  const makeArgs = (pkg, extraArgs) => {
    if (isWindows) {
      return ['/c', 'npx', ...npxArgs, pkg, ...extraArgs];
    }
    return [...npxArgs, pkg, ...extraArgs];
  };

  return {
    mcpServers: {
      'claude-flow': {
        command,
        args: makeArgs('@claude-flow/cli@latest', ['mcp', 'start']),
        env: {
          npm_config_update_notifier: 'false',
          CLAUDE_FLOW_MODE: 'v3',
          CLAUDE_FLOW_HOOKS_ENABLED: 'true',
          CLAUDE_FLOW_TOPOLOGY: 'hierarchical-mesh',
          CLAUDE_FLOW_MAX_AGENTS: '15',
          CLAUDE_FLOW_MEMORY_BACKEND: 'hybrid'
        },
        autoStart: false
      },
      'ruv-swarm': {
        command,
        args: makeArgs('ruv-swarm', ['mcp', 'start']),
        env: {
          npm_config_update_notifier: 'false'
        },
        optional: true
      },
      'flow-nexus': {
        command,
        args: makeArgs('flow-nexus@latest', ['mcp', 'start']),
        env: {
          npm_config_update_notifier: 'false'
        },
        optional: true,
        requiresAuth: true
      }
    }
  };
}
