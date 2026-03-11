import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readJsonSafe, writeJson } from './utils.js';

const CHECK_RUFLO_HOOK_FILENAME = 'check-ruflo.cjs';

function defaultGlobalClaudeSettingsPath() {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

function hasCheckRufloHookFilename(command) {
  if (typeof command !== 'string') return false;
  return /check-ruflo\.cjs(?=["'\s]|$)/i.test(command);
}

function extractHookScriptPath(command) {
  if (typeof command !== 'string') return null;
  const quoted = command.match(/["']([^"']*check-ruflo\.cjs)["']/i);
  if (quoted) return quoted[1];
  const bare = command.match(/([^\s"']*check-ruflo\.cjs)/i);
  return bare ? bare[1] : null;
}

function inferHookSourceInfo(command, packageRoot) {
  const scriptPath = extractHookScriptPath(command);
  const normalizedScriptPath = scriptPath ? scriptPath.replace(/\\/g, '/').toLowerCase() : '';
  const normalizedPath = scriptPath ? scriptPath.replace(/\\/g, '/') : '';
  const normalizedPackageRoot = packageRoot ? packageRoot.replace(/\\/g, '/').toLowerCase() : '';

  let source = 'unknown';
  let packageRef = null;
  let storeType = null;

  if (normalizedScriptPath.includes('/_npx/')) {
    source = 'npm/npx cache install';
    storeType = 'npm/npx cache';
    const m = normalizedPath.match(/_npx\/[^/]+\/node_modules\/((?:@[^/]+\/)?[^/]+)\/claude-hooks/i);
    if (m) packageRef = m[1];
  } else if (normalizedScriptPath.includes('/.pnpm/')) {
    source = 'pnpm store install';
    // scoped package: @scope+pkg@version
    const pnpmScoped = normalizedPath.match(/\/\.pnpm\/((@[^/+]+)\+([^/@]+)@([^/]+))\//i);
    if (pnpmScoped) {
      packageRef = `${pnpmScoped[2]}/${pnpmScoped[3]}@${pnpmScoped[4]}`;
    } else {
      // unscoped: pkg@version
      const pnpmUnscoped = normalizedPath.match(/\/\.pnpm\/([^/@+]+)@([^/]+)\//i);
      if (pnpmUnscoped) packageRef = `${pnpmUnscoped[1]}@${pnpmUnscoped[2]}`;
    }
    storeType = normalizedScriptPath.includes('/pnpm/global/') ? 'pnpm global store' : 'pnpm store';
  } else if (normalizedScriptPath.includes('/node_modules/')) {
    source = 'node_modules install';
    storeType = 'npm global';
    const m = normalizedPath.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\/claude-hooks/i);
    if (m) packageRef = m[1];
  }

  const isCurrentPackagePath = Boolean(
    normalizedScriptPath && normalizedPackageRoot && normalizedScriptPath.startsWith(normalizedPackageRoot)
  );

  const versionMatch = command.match(/@mfjjs[+/\\]ruflo-setup@(\d+\.\d+\.\d+(?:[-+][^\\/"'\s]+)?)/i);

  const pointingTo = packageRef && storeType
    ? `hook pointing to ${packageRef} from ${storeType}`
    : packageRef
      ? `hook pointing to ${packageRef}`
      : null;

  return {
    scriptPath,
    source,
    isCurrentPackagePath,
    inferredVersion: versionMatch ? versionMatch[1] : null,
    packageRef,
    pointingTo
  };
}

function findCheckRufloHook(sessionStart) {
  if (!Array.isArray(sessionStart)) return null;
  for (let gi = 0; gi < sessionStart.length; gi += 1) {
    const group = sessionStart[gi];
    if (!Array.isArray(group?.hooks)) continue;
    for (let hi = 0; hi < group.hooks.length; hi += 1) {
      const hook = group.hooks[hi];
      if (hasCheckRufloHookFilename(hook?.command)) {
        return { hook, groupIndex: gi, hookIndex: hi, command: hook.command };
      }
    }
  }
  return null;
}

function ensureSessionStartHook(settings, hookCommand) {
  const next = settings;
  if (!next.hooks || typeof next.hooks !== 'object') {
    next.hooks = {};
  }

  if (!Array.isArray(next.hooks.SessionStart)) {
    next.hooks.SessionStart = [];
  }

  const sessionStart = next.hooks.SessionStart;
  if (sessionStart.length === 0) {
    sessionStart.push({ hooks: [] });
  }

  const firstGroup = sessionStart[0];
  if (!Array.isArray(firstGroup.hooks)) {
    firstGroup.hooks = [];
  }

  const newHook = { type: 'command', command: hookCommand, timeout: 5000 };
  const existingIndex = firstGroup.hooks.findIndex((h) => hasCheckRufloHookFilename(h?.command));

  if (existingIndex !== -1) {
    const unchanged = firstGroup.hooks[existingIndex].command === hookCommand;
    firstGroup.hooks[existingIndex] = newHook;
    return unchanged ? false : true;
  }

  firstGroup.hooks.unshift(newHook);
  return true;
}

export function installGlobalCheckRufloHook({
  packageRoot,
  dryRun = false,
  globalSettingsPath
}) {
  const resolvedSettingsPath = globalSettingsPath || process.env.CLAUDE_SETTINGS_PATH || defaultGlobalClaudeSettingsPath();
  const hookScriptPath = path.join(packageRoot, 'claude-hooks', 'check-ruflo.cjs');
  const hookCommand = `node "${hookScriptPath}"`;

  const exists = fs.existsSync(resolvedSettingsPath);
  const settings = readJsonSafe(resolvedSettingsPath, {});

  const inserted = ensureSessionStartHook(settings, hookCommand);

  if (!dryRun) {
    if (exists) {
      const backupPath = `${resolvedSettingsPath}.bak`;
      fs.mkdirSync(path.dirname(backupPath), { recursive: true });
      fs.copyFileSync(resolvedSettingsPath, backupPath);
    }
    writeJson(resolvedSettingsPath, settings);
  }

  return {
    settingsPath: resolvedSettingsPath,
    hookCommand,
    inserted,
    existed: exists
  };
}

export function getGlobalHookStatus({ packageRoot, globalSettingsPath }) {
  const resolvedSettingsPath = globalSettingsPath || process.env.CLAUDE_SETTINGS_PATH || defaultGlobalClaudeSettingsPath();
  const hookScriptPath = path.join(packageRoot, 'claude-hooks', 'check-ruflo.cjs');
  const hookCommand = `node "${hookScriptPath}"`;

  if (!fs.existsSync(resolvedSettingsPath)) {
    return {
      installed: false,
      reason: 'global settings file does not exist',
      settingsPath: resolvedSettingsPath,
      hookCommand
    };
  }

  const settings = readJsonSafe(resolvedSettingsPath, {});
  const sessionStart = settings?.hooks?.SessionStart;
  if (!Array.isArray(sessionStart)) {
    return {
      installed: false,
      reason: 'SessionStart hooks are missing',
      settingsPath: resolvedSettingsPath,
      hookCommand
    };
  }

  const foundHook = findCheckRufloHook(sessionStart);
  const found = Boolean(foundHook);
  const sourceInfo = foundHook ? inferHookSourceInfo(foundHook.command, packageRoot) : null;

  return {
    installed: found,
    reason: found ? `hook found by filename ${CHECK_RUFLO_HOOK_FILENAME}` : `hook command with filename ${CHECK_RUFLO_HOOK_FILENAME} not found in SessionStart hooks`,
    settingsPath: resolvedSettingsPath,
    hookCommand,
    matchedHookCommand: foundHook?.command || null,
    matchedHookSource: sourceInfo?.source || null,
    matchedHookPointingTo: sourceInfo?.pointingTo || null
  };
}
