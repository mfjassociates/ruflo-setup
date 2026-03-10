import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runCli } from '../src/cli.js';

test('hooks status returns 0 when hook is installed', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruflo-setup-test-'));
  const fakeHome = path.join(tempDir, 'home');
  const claudeDir = path.join(fakeHome, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });

  const settingsPath = path.join(claudeDir, 'settings.json');
  process.env.CLAUDE_SETTINGS_PATH = settingsPath;

  const installCode = await runCli(['hooks', 'install'], tempDir);
  assert.equal(installCode, 0);

  const statusCode = await runCli(['hooks', 'status'], tempDir);
  assert.equal(statusCode, 0);
});

test('setup dry-run works without init', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruflo-setup-test-'));
  const code = await runCli(['--dry-run', '--skip-init', '--no-hooks', '--yes'], tempDir);
  assert.equal(code, 0);
});
