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

async function withTempHome(fn) {
  const prevHome = process.env.HOME;
  const prevUserProfile = process.env.USERPROFILE;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruflo-setup-home-'));
  const fakeHome = path.join(tempDir, 'home');
  fs.mkdirSync(fakeHome, { recursive: true });
  process.env.HOME = fakeHome;
  process.env.USERPROFILE = fakeHome;
  try {
    return await fn(fakeHome);
  } finally {
    if (typeof prevHome === 'undefined') delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (typeof prevUserProfile === 'undefined') delete process.env.USERPROFILE;
    else process.env.USERPROFILE = prevUserProfile;
  }
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

test('setup dry-run reports command template install for missing global command', async () => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruflo-setup-test-'));
  await withTempHome(async () => {
    const { code, output } = await captureStdout(() => runCli(['--dry-run', '--skip-init', '--no-hooks', '--yes'], projectDir));
    assert.equal(code, 0);
    assert.match(output, /\[DRY RUN\] Would install:/);
  });
});

test('setup updates stale global command template', async () => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruflo-setup-test-'));
  const templatePath = path.join(process.cwd(), 'templates', 'ruflo-setup.md');
  const templateContent = fs.readFileSync(templatePath, 'utf8');

  await withTempHome(async (fakeHome) => {
    const commandPath = path.join(fakeHome, '.claude', 'commands', 'ruflo-setup.md');
    fs.mkdirSync(path.dirname(commandPath), { recursive: true });
    fs.writeFileSync(commandPath, '# stale\n', 'utf8');

    const { code, output } = await captureStdout(() => runCli(['--skip-init', '--no-hooks', '--yes'], projectDir));
    assert.equal(code, 0);
    assert.match(output, /Updated command template at:/);
    assert.equal(fs.readFileSync(commandPath, 'utf8'), templateContent);
  });
});

test('setup keeps global command template unchanged when already current', async () => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruflo-setup-test-'));
  const templatePath = path.join(process.cwd(), 'templates', 'ruflo-setup.md');
  const templateContent = fs.readFileSync(templatePath, 'utf8');

  await withTempHome(async (fakeHome) => {
    const commandPath = path.join(fakeHome, '.claude', 'commands', 'ruflo-setup.md');
    fs.mkdirSync(path.dirname(commandPath), { recursive: true });
    fs.writeFileSync(commandPath, templateContent, 'utf8');

    const { code, output } = await captureStdout(() => runCli(['--skip-init', '--no-hooks', '--yes'], projectDir));
    assert.equal(code, 0);
    assert.match(output, /Command template already up to date:/);
    assert.equal(fs.readFileSync(commandPath, 'utf8'), templateContent);
  });
});

test('status exits with code 0', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruflo-setup-test-'));
  const { code } = await captureStdout(() => runCli(['status'], tempDir));
  assert.equal(code, 0);
});

test('status outputs all layer headers', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruflo-setup-test-'));
  const { output } = await captureStdout(() => runCli(['status'], tempDir));
  assert.match(output, /Layer 0: Prerequisites/);
  assert.match(output, /Layer 1: Global npm Packages/);
  assert.match(output, /Layer 2: Optional Packages/);
  assert.match(output, /Layer 3: MCP Servers/);
  assert.match(output, /Layer 4: MCP Tool Groups/);
  assert.match(output, /Layer 5: Environment Variables/);
  assert.match(output, /Layer 6: Claude Code Hooks/);
  assert.match(output, /Layer 7: Project Scaffolding/);
  assert.match(output, /Layer 8: Docker/);
  assert.match(output, /Summary:/);
});

test('status reports .mcp.json as present when it exists', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruflo-setup-test-'));
  fs.writeFileSync(path.join(tempDir, '.mcp.json'), JSON.stringify({
    mcpServers: {
      'claude-flow': { command: 'cmd', args: ['/c', 'npx', '-y', '@claude-flow/cli@latest', 'mcp', 'start'], env: {} }
    }
  }, null, 2), 'utf8');

  const { output } = await captureStdout(() => runCli(['status'], tempDir));
  assert.match(output, /\[OK\].*\.mcp\.json|\[OK\].*mcp\.json/);
  assert.match(output, /claude-flow/);
});

test('status reports .mcp.json as missing when absent', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruflo-setup-test-'));
  const { output } = await captureStdout(() => runCli(['status'], tempDir));
  assert.match(output, /\[--\].*\.mcp\.json|\[--\].*mcp\.json|not found|not configured/i);
});

test('setup dry-run includes MCP tool group env vars in generated .mcp.json', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruflo-setup-test-'));
  await withTempHome(async () => {
    const { code, output } = await captureStdout(() =>
      runCli(['--dry-run', '--skip-init', '--no-hooks', '--yes'], tempDir)
    );
    assert.equal(code, 0);
    // The dry-run path does not write the file, so verify via toPlatformMcpConfig directly
    const { toPlatformMcpConfig } = await import('../src/utils.js');
    const config = toPlatformMcpConfig(process.platform);
    const env = config.mcpServers['claude-flow'].env;
    assert.equal(env.MCP_GROUP_SECURITY, 'true');
    assert.equal(env.MCP_GROUP_BROWSER, 'true');
    assert.equal(env.MCP_GROUP_NEURAL, 'true');
    assert.equal(env.MCP_GROUP_AGENTIC_FLOW, 'true');
  });
});
