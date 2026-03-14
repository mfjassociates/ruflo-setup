import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readJsonSafe } from './utils.js';
import { getGlobalHookStatus } from './hooks.js';

const require = createRequire(import.meta.url);
const OK = '[OK]';
const MISS = '[--]';
const ERR = '[!!]';
const IS_WIN = process.platform === 'win32';

function spawn(cmd, args) {
  try {
    return spawnSync(cmd, args, {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
      shell: IS_WIN
    });
  } catch {
    return { status: 1, stdout: '' };
  }
}

function dirExists(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function fileExists(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

// Flatten npm/pnpm --json list result into a name->version map (1 level deep).
function buildPkgMap(jsonText) {
  const map = {};
  try {
    const parsed = JSON.parse(jsonText || '{}');
    // npm list -g returns an array with one element, pnpm returns an object
    const root = Array.isArray(parsed) ? parsed[0] : parsed;
    const deps = root?.dependencies ?? {};
    for (const [name, info] of Object.entries(deps)) {
      map[name] = info?.version ?? true;
      for (const [nname, ninfo] of Object.entries(info?.dependencies ?? {})) {
        if (!(nname in map)) map[nname] = ninfo?.version ?? true;
      }
    }
  } catch {
    // ignore parse errors
  }
  return map;
}

// Tries npm list -g first, falls back to pnpm list -g.
function getGlobalPkgMap() {
  const npmRes = spawn('npm', ['list', '-g', '--depth=1', '--json']);
  if (npmRes.status === 0 && npmRes.stdout) {
    const m = buildPkgMap(npmRes.stdout);
    if (Object.keys(m).length > 0) return m;
  }
  const pnpmRes = spawn('pnpm', ['list', '-g', '--depth=1', '--json']);
  if (pnpmRes.status === 0 && pnpmRes.stdout) {
    return buildPkgMap(pnpmRes.stdout);
  }
  return {};
}

// Each checkLayer* returns { lines: string[], ok: number, total: number }

function checkLayer0() {
  const lines = [];
  let ok = 0;
  const nodeMajor = parseInt(process.version.slice(1), 10);
  if (nodeMajor >= 20) { lines.push(`  ${OK} Node.js ${process.version}  (>=20 required)`); ok += 1; }
  else { lines.push(`  ${ERR} Node.js ${process.version}  (>=20 required — upgrade Node.js)`); }

  const pnpmRes = spawn('pnpm', ['--version']);
  if (pnpmRes.status === 0 && pnpmRes.stdout.trim()) {
    lines.push(`  ${OK} pnpm ${pnpmRes.stdout.trim()}`); ok += 1;
  } else {
    lines.push(`  ${MISS} pnpm  (install: npm install -g pnpm)`);
  }

  const claudeRes = spawn('claude', ['--version']);
  if (claudeRes.status === 0) {
    const ver = (claudeRes.stdout || '').trim();
    lines.push(`  ${OK} Claude Code CLI${ver ? `  ${ver}` : ''}`); ok += 1;
  } else {
    lines.push(`  ${MISS} Claude Code CLI  (install: npm install -g @anthropic-ai/claude-code)`);
  }

  if (process.env.ANTHROPIC_API_KEY) {
    lines.push(`  ${OK} ANTHROPIC_API_KEY set`); ok += 1;
  } else {
    lines.push(`  ${ERR} ANTHROPIC_API_KEY not set  (required for LLM calls)`);
  }

  return { lines, ok, total: 4 };
}

function checkLayer1(pkgMap) {
  const lines = [];
  let ok = 0;
  for (const name of ['ruflo', '@mfjjs/ruflo-setup']) {
    const ver = pkgMap[name];
    if (ver) { lines.push(`  ${OK} ${name}${typeof ver === 'string' ? `@${ver}` : ''}`); ok += 1; }
    else { lines.push(`  ${MISS} ${name}  (install: npm install -g ${name})`); }
  }
  return { lines, ok, total: 2 };
}

function checkLayer2(pkgMap) {
  const lines = [];
  let ok = 0;
  const ATTENTION_WIN_NOTE = '(Windows: requires Windows 11 SDK for NAPI; WASM fallback available)';
  const pkgs = [
    '@claude-flow/memory', '@ruvector/attention', '@claude-flow/aidefence', 'agentic-flow',
    '@ruvector/sona', '@ruvector/router', '@ruvector/learning-wasm',
    '@claude-flow/embeddings', '@claude-flow/guidance', '@claude-flow/codex'
  ];
  for (const name of pkgs) {
    const ver = pkgMap[name];
    if (ver) { lines.push(`  ${OK} ${name}${typeof ver === 'string' ? `@${ver}` : ''}`); ok += 1; }
    else {
      const note = (name === '@ruvector/attention' && IS_WIN) ? `  ${ATTENTION_WIN_NOTE}` : '';
      lines.push(`  ${MISS} ${name}${note}`);
    }
  }
  return { lines, ok, total: pkgs.length };
}

function checkLayer3(mcpJson) {
  const lines = [];
  let ok = 0;
  const servers = mcpJson?.mcpServers ?? {};

  if (servers['claude-flow']) {
    const args = servers['claude-flow']?.args ?? [];
    const pkgArg = args.find((a) => typeof a === 'string' && a.includes('@claude-flow/cli')) ?? '@claude-flow/cli@latest';
    lines.push(`  ${OK} claude-flow  (${pkgArg})`); ok += 1;
  } else {
    lines.push(`  ${MISS} claude-flow  (run ruflo-setup to configure)`);
  }

  if (servers['ruv-swarm']) { lines.push(`  ${OK} ruv-swarm  (optional)`); ok += 1; }
  else { lines.push(`  ${MISS} ruv-swarm  (optional)`); }

  if (servers['flow-nexus']) { lines.push(`  ${OK} flow-nexus  (optional)`); ok += 1; }
  else { lines.push(`  ${MISS} flow-nexus  (optional — needs Cognitum.One account)`); }

  return { lines, ok, total: 3 };
}

function checkLayer4(mcpJson) {
  const lines = [];
  let ok = 0;
  const cfEnv = mcpJson?.mcpServers?.['claude-flow']?.env ?? {};
  const resolve = (k) => { const v = cfEnv[k] ?? process.env[k]; return v === undefined ? null : String(v).toLowerCase(); };

  for (const g of ['INTELLIGENCE', 'AGENTS', 'MEMORY', 'DEVTOOLS']) {
    if (resolve(`MCP_GROUP_${g}`) === 'false') { lines.push(`  ${MISS} ${g}    (disabled via MCP_GROUP_${g}=false)`); }
    else { lines.push(`  ${OK} ${g}  (default on)`); ok += 1; }
  }
  for (const g of ['SECURITY', 'BROWSER', 'NEURAL', 'AGENTIC_FLOW']) {
    if (resolve(`MCP_GROUP_${g}`) === 'true') { lines.push(`  ${OK} ${g}  (enabled)`); ok += 1; }
    else { lines.push(`  ${MISS} ${g}    (set MCP_GROUP_${g}=true in .mcp.json env)`); }
  }

  return { lines, ok, total: 8 };
}

function checkLayer5() {
  const lines = [];
  let ok = 0;
  const checks = [
    { key: 'ANTHROPIC_API_KEY', req: true, note: '' },
    { key: 'OPENAI_API_KEY', req: false, note: '(optional — enables GPT + Codex)' },
    { key: 'GOOGLE_API_KEY', req: false, note: '(optional — enables Gemini)' },
    { key: 'OPENROUTER_API_KEY', req: false, note: '(optional — multi-provider proxy)' }
  ];
  for (const { key, req, note } of checks) {
    if (process.env[key]) { lines.push(`  ${OK} ${key}`); ok += 1; }
    else if (req) { lines.push(`  ${ERR} ${key} not set  (required for LLM calls)`); }
    else { lines.push(`  ${MISS} ${key}  ${note}`); }
  }
  return { lines, ok, total: checks.length };
}

function checkLayer6(packageRoot) {
  const lines = [];
  let ok = 0;
  const homeDir = os.homedir();

  try {
    const hs = getGlobalHookStatus({ packageRoot });
    const sp = hs.settingsPath ?? path.join(homeDir, '.claude', 'settings.json');
    if (hs.installed) { lines.push(`  ${OK} SessionStart hook  (${sp})`); ok += 1; }
    else { lines.push(`  ${MISS} SessionStart hook  (${sp})`); }
  } catch {
    lines.push(`  ${MISS} SessionStart hook  (could not read ~/.claude/settings.json)`);
  }

  const commandFile = path.join(homeDir, '.claude', 'commands', 'ruflo-setup.md');
  if (fileExists(commandFile)) { lines.push(`  ${OK} /ruflo-setup command  (${commandFile})`); ok += 1; }
  else { lines.push(`  ${MISS} /ruflo-setup command  (${commandFile})`); }

  return { lines, ok, total: 2 };
}

function checkLayer7(cwd) {
  const lines = [];
  let ok = 0;
  const files = ['.mcp.json', 'CLAUDE.md', path.join('.claude', 'settings.json')];
  const dirs = [
    { rel: path.join('.claude', 'agents'), hint: 'run: ruflo init --full' },
    { rel: path.join('.claude', 'skills'), hint: null },
    { rel: path.join('.claude', 'commands'), hint: null },
    { rel: '.claude-flow', hint: null }
  ];

  for (const rel of files) {
    if (fileExists(path.join(cwd, rel))) { lines.push(`  ${OK} ${rel}`); ok += 1; }
    else { lines.push(`  ${MISS} ${rel}`); }
  }
  for (const { rel, hint } of dirs) {
    const disp = `${rel}/`.replace(/\\/g, '/');
    if (dirExists(path.join(cwd, rel))) { lines.push(`  ${OK} ${disp}`); ok += 1; }
    else { lines.push(`  ${MISS} ${disp}${hint ? `  (${hint})` : ''}`); }
  }

  return { lines, ok, total: files.length + dirs.length };
}

function checkLayer8() {
  const res = spawn('docker', ['--version']);
  if (res.status === 0 && res.stdout.trim()) {
    return { lines: [`  ${OK} Docker  ${res.stdout.trim()}`], ok: 1, total: 1 };
  }
  return { lines: [`  ${MISS} Docker not detected  (optional — needed for ruvocal chat UI)`], ok: 0, total: 1 };
}

export async function runStatus({ cwd, packageRoot }) {
  try {
    const { version } = require('../package.json');
    const mcpJson = readJsonSafe(path.join(cwd, '.mcp.json'), {});
    const pkgMap = getGlobalPkgMap();

    const layers = [
      { title: 'Layer 0: Prerequisites', result: checkLayer0() },
      { title: 'Layer 1: Global npm Packages', result: checkLayer1(pkgMap) },
      { title: 'Layer 2: Optional Packages (WASM/ML)  — enables AI features', result: checkLayer2(pkgMap) },
      { title: 'Layer 3: MCP Servers (.mcp.json)', result: checkLayer3(mcpJson) },
      { title: 'Layer 4: MCP Tool Groups', result: checkLayer4(mcpJson) },
      { title: 'Layer 5: Environment Variables', result: checkLayer5() },
      { title: 'Layer 6: Claude Code Hooks', result: checkLayer6(packageRoot) },
      { title: 'Layer 7: Project Scaffolding', result: checkLayer7(cwd) },
      { title: 'Layer 8: Docker Chat UI  (optional)', result: checkLayer8() }
    ];

    let totalOk = 0;
    let totalChecks = 0;

    process.stdout.write(`\nRuflo Feature Status  (ruflo-setup v${version})\n`);
    process.stdout.write(`Target: ${cwd}\n`);

    for (const { title, result } of layers) {
      process.stdout.write(`\n${title}\n`);
      for (const line of result.lines) process.stdout.write(`${line}\n`);
      totalOk += result.ok;
      totalChecks += result.total;
    }

    process.stdout.write(`\nSummary: ${totalOk}/${totalChecks} features enabled\n`);

    const hasRequiredMissing = parseInt(process.version.slice(1), 10) < 20 || !process.env.ANTHROPIC_API_KEY;
    if (hasRequiredMissing) process.stdout.write(`Run 'ruflo-setup' to configure missing required features.\n`);
    process.stdout.write('\n');
  } catch (error) {
    process.stderr.write(`status error: ${error.message}\n`);
  }
}
