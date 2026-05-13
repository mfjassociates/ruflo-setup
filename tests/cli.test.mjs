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

async function captureOutput(fn) {
  let stdout = '';
  let stderr = '';
  const origOut = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  process.stdout.write = (chunk, _enc, cb) => { stdout += String(chunk); if (typeof cb === 'function') cb(); return true; };
  process.stderr.write = (chunk, _enc, cb) => { stderr += String(chunk); if (typeof cb === 'function') cb(); return true; };
  try { const code = await fn(); return { code, stdout, stderr }; }
  finally {
    process.stdout.write = origOut;
    process.stderr.write = origErr;
  }
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

test('setup fails prerequisite check when pnpm is below minimum', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruflo-setup-test-'));
  const fakeBinDir = path.join(tempDir, 'fake-bin');
  fs.mkdirSync(fakeBinDir, { recursive: true });

  const fakePnpmCmd = path.join(fakeBinDir, 'pnpm.cmd');
  fs.writeFileSync(
    fakePnpmCmd,
    '@echo off\r\nif "%1"=="--version" (\r\n  echo 11.0.0\r\n  exit /b 0\r\n)\r\nexit /b 0\r\n',
    'utf8'
  );

  const previousPath = process.env.PATH;
  process.env.PATH = `${fakeBinDir}${path.delimiter}${previousPath || ''}`;

  try {
    const { code, stderr } = await captureOutput(() =>
      runCli(['--no-hooks', '--yes'], tempDir)
    );
    assert.equal(code, 1);
    assert.match(stderr, /pnpm 11\.1\.1 or higher is required, but found 11\.0\.0\./);
  } finally {
    if (typeof previousPath === 'undefined') delete process.env.PATH;
    else process.env.PATH = previousPath;
  }
});

test('setup fails prerequisite check when node is below minimum', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruflo-setup-test-'));
  const originalNodeDescriptor = Object.getOwnPropertyDescriptor(process.versions, 'node');

  Object.defineProperty(process.versions, 'node', {
    ...originalNodeDescriptor,
    value: '22.22.1'
  });

  try {
    const { code, stderr } = await captureOutput(() =>
      runCli(['--no-hooks', '--yes'], tempDir)
    );
    assert.equal(code, 1);
    assert.match(stderr, /Node\.js 22\.22\.2 or newer is required, but found 22\.22\.1\./);
  } finally {
    Object.defineProperty(process.versions, 'node', originalNodeDescriptor);
  }
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
  assert.match(output, /Layer 1: Global Packages/);
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

test('setup dry-run includes all three new gitignore entries in Would-ensure line', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruflo-setup-test-'));
  await withTempHome(async () => {
    const { code, output } = await captureStdout(() =>
      runCli(['--dry-run', '--skip-init', '--no-hooks', '--yes'], tempDir)
    );
    assert.equal(code, 0);
    assert.match(output, /Would ensure .* contains:.*\.claude-flow\/swarm\//);
    assert.match(output, /Would ensure .* contains:.*\.claude-flow\/daemon-state\.json/);
    assert.match(output, /Would ensure .* contains:.*\.claude-flow\/daemon\.pid/);
  });
});

test('setup writes new gitignore entries to a fresh .gitignore', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruflo-setup-test-'));
  await withTempHome(async () => {
    const { code } = await captureStdout(() =>
      runCli(['--skip-init', '--no-hooks', '--yes'], tempDir)
    );
    assert.equal(code, 0);
    const gitignorePath = path.join(tempDir, '.gitignore');
    const content = fs.readFileSync(gitignorePath, 'utf8');
    assert.ok(content.includes('.claude-flow/swarm/'), 'missing .claude-flow/swarm/');
    assert.ok(content.includes('.claude-flow/daemon-state.json'), 'missing .claude-flow/daemon-state.json');
    assert.ok(content.includes('.claude-flow/daemon.pid'), 'missing .claude-flow/daemon.pid');
  });
});

test('setup does not duplicate new gitignore entries when already present', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruflo-setup-test-'));
  const gitignorePath = path.join(tempDir, '.gitignore');
  // Pre-populate with all expected entries so nothing is added on first run
  const existingEntries = [
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
  ].join('\n') + '\n';
  fs.writeFileSync(gitignorePath, existingEntries, 'utf8');

  await withTempHome(async () => {
    const { code } = await captureStdout(() =>
      runCli(['--skip-init', '--no-hooks', '--yes'], tempDir)
    );
    assert.equal(code, 0);
    const content = fs.readFileSync(gitignorePath, 'utf8');
    // Each new entry should appear exactly once
    const swarmCount = content.split('.claude-flow/swarm/').length - 1;
    const daemonStateCount = content.split('.claude-flow/daemon-state.json').length - 1;
    const daemonPidCount = content.split('.claude-flow/daemon.pid').length - 1;
    assert.equal(swarmCount, 1, '.claude-flow/swarm/ duplicated');
    assert.equal(daemonStateCount, 1, '.claude-flow/daemon-state.json duplicated');
    assert.equal(daemonPidCount, 1, '.claude-flow/daemon.pid duplicated');
  });
});

test('setup dry-run without --skip-init shows memory check lines', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruflo-setup-test-'));
  await withTempHome(async () => {
    const { code, output } = await captureStdout(() =>
      runCli(['--dry-run', '--no-hooks', '--yes'], tempDir)
    );
    assert.equal(code, 0);
    assert.match(output, /\[DRY RUN\] Would check: ruflo memory stats \(Total Entries\)/);
    assert.match(output, /\[DRY RUN\] First time \(entries=0\): ruflo init --full --start-all/);
    assert.match(output, /\[DRY RUN\] Returning \(entries>0\): ruflo init --full \+ daemon restart \+ swarm init/);
  });
});
