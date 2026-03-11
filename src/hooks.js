import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readJsonSafe, writeJson } from './utils.js';

function defaultGlobalClaudeSettingsPath() {
  return path.join(os.homedir(), '.claude', 'settings.json');
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
  const existingIndex = firstGroup.hooks.findIndex(
    (h) => h && h.type === 'command' && typeof h.command === 'string' && h.command.includes('check-ruflo.cjs')
  );

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

  const found = sessionStart.some((group) => Array.isArray(group?.hooks) && group.hooks.some((hook) => hook?.type === 'command' && typeof hook?.command === 'string' && hook.command.includes('check-ruflo.cjs')));

  return {
    installed: found,
    reason: found ? 'hook found' : 'hook command not found in SessionStart hooks',
    settingsPath: resolvedSettingsPath,
    hookCommand
  };
}
