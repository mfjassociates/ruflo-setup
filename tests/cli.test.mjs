import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runCli } from '../src/cli.js';

async function captureStdout(fn) {
  let output = '';
  const orig = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk, _enc, cb) => { output += String(chunk); if (typeof cb === 'function') cb(); return true; };
  try { const code = await fn(); return { code, output }; }
  finally { process.stdout.write = orig; }
}

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

test('hooks status shows pointing-to line for pnpm global store', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruflo-setup-test-'));
  const claudeDir = path.join(tempDir, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  const settingsPath = path.join(claudeDir, 'settings.json');
  process.env.CLAUDE_SETTINGS_PATH = settingsPath;

  const pnpmCommand = 'node "C:\\Users\\test\\AppData\\Local\\pnpm\\global\\5\\.pnpm\\@mfjjs+ruflo-setup@0.1.1\\node_modules\\@mfjjs\\ruflo-setup\\claude-hooks\\check-ruflo.cjs"';
  fs.writeFileSync(settingsPath, JSON.stringify({
    hooks: { SessionStart: [{ hooks: [{ type: 'command', command: pnpmCommand, timeout: 5000 }] }] }
  }, null, 2) + '\n', 'utf8');

  const { code, output } = await captureStdout(() => runCli(['hooks', 'status'], tempDir));
  assert.equal(code, 0);
  assert.match(output, /Hook installed: yes/);
  assert.match(output, /hook pointing to @mfjjs\/ruflo-setup@0\.1\.1 from pnpm global store/);
});

test('hooks status shows pointing-to line for npm npx cache', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruflo-setup-test-'));
  const claudeDir = path.join(tempDir, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  const settingsPath = path.join(claudeDir, 'settings.json');
  process.env.CLAUDE_SETTINGS_PATH = settingsPath;

  const npxCommand = 'node "C:\\Users\\test\\AppData\\Local\\npm-cache\\_npx\\abc123\\node_modules\\@mfjjs\\ruflo-setup\\claude-hooks\\check-ruflo.cjs"';
  fs.writeFileSync(settingsPath, JSON.stringify({
    hooks: { SessionStart: [{ hooks: [{ type: 'command', command: npxCommand, timeout: 5000 }] }] }
  }, null, 2) + '\n', 'utf8');

  const { code, output } = await captureStdout(() => runCli(['hooks', 'status'], tempDir));
  assert.equal(code, 0);
  assert.match(output, /Hook installed: yes/);
  assert.match(output, /hook pointing to @mfjjs\/ruflo-setup from npm\/npx cache/);
});
