import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { parseArgs } from './utils.js';
import { runSetup, runCleanup, runUpdate } from './setup.js';
import { getGlobalHookStatus, installGlobalCheckRufloHook } from './hooks.js';

const require = createRequire(import.meta.url);

function printVersion() {
  const { version } = require('../package.json');
  process.stdout.write(`${version}\n`);
}

function printHelp() {
  process.stdout.write(`
@mfjjs/ruflo-setup

Usage:
  ruflo-setup [options]
  ruflo-setup status
  ruflo-setup update [--dry-run]
  ruflo-setup cleanup [--dry-run]
  ruflo-setup hooks install [options]
  ruflo-setup hooks status

Options:
  --force, -f      Overwrite existing config without prompt
  --dry-run        Show actions without making changes
  --yes, -y        Non-interactive yes for prompts
  --no-hooks       Skip global hook installation during setup
  --skip-init      Skip 'pnpm add -g ruflo@latest && ruflo init --full'
  --version, -v    Print version and exit
  --verbose        Extra output

Commands:
  update           Update @mfjjs/ruflo-setup itself to the latest published version
  cleanup          Remove all Ruflo packages from the npm global registry
                   (ruflo, @mfjjs/ruflo-setup, claude-flow, @claude-flow/cli, ruv-swarm)

Examples:
  ruflo-setup
  ruflo-setup update
  ruflo-setup status
  ruflo-setup cleanup
  ruflo-setup cleanup --dry-run
  ruflo-setup --dry-run --skip-init
  ruflo-setup hooks status
  ruflo-setup hooks install --dry-run
`);
}

function packageRootFromModule() {
  const filename = fileURLToPath(import.meta.url);
  return path.join(path.dirname(filename), '..');
}

export async function runCli(argv, cwd) {
  try {
    if (argv.includes('--version') || argv.includes('-v')) {
      printVersion();
      return 0;
    }

    if (argv.includes('--help') || argv.includes('-h')) {
      printHelp();
      return 0;
    }

    const packageRoot = packageRootFromModule();
    const flags = parseArgs(argv);

    if (flags.command === 'status') {
      const { runStatus } = await import('./status.js');
      await runStatus({ cwd, packageRoot });
      return 0;
    }

    if (flags.command === 'hooks') {
      const subcommand = argv[1] || 'status';
      if (subcommand === 'status') {
        const status = getGlobalHookStatus({ packageRoot });
        process.stdout.write(`Hook installed: ${status.installed ? 'yes' : 'no'}\n`);
        if (status.matchedHookPointingTo) {
          process.stdout.write(`${status.matchedHookPointingTo}\n`);
        }
        process.stdout.write(`Settings path: ${status.settingsPath}\n`);
        process.stdout.write(`Reason: ${status.reason}\n`);
        if (status.matchedHookCommand) {
          process.stdout.write(`Matched command: ${status.matchedHookCommand}\n`);
        }
        return status.installed ? 0 : 1;
      }

      if (subcommand === 'install') {
        const result = installGlobalCheckRufloHook({ packageRoot, dryRun: flags.dryRun });
        process.stdout.write(`${flags.dryRun ? '[DRY RUN] ' : ''}${result.inserted ? 'Hook installed' : 'Hook already present'}\n`);
        process.stdout.write(`Settings path: ${result.settingsPath}\n`);
        return 0;
      }

      process.stderr.write(`Unknown hooks subcommand: ${subcommand}\n`);
      return 1;
    }

    if (flags.command === 'update') {
      runUpdate({ dryRun: flags.dryRun });
      return 0;
    }

    if (flags.command === 'cleanup') {
      if (!flags.dryRun && !flags.yes) {
        const { confirm } = await import('./utils.js');
        const ok = await confirm('Remove Ruflo packages from npm global registry? [y/N] ');
        if (!ok) {
          process.stdout.write('Aborted. No changes made.\n');
          return 0;
        }
      }
      runCleanup({ dryRun: flags.dryRun });
      return 0;
    }

    await runSetup({
      cwd,
      packageRoot,
      force: flags.force,
      dryRun: flags.dryRun,
      yes: flags.yes,
      noHooks: flags.noHooks,
      skipInit: flags.skipInit,
      verbose: flags.verbose
    });

    return 0;
  } catch (error) {
    process.stderr.write(`Error: ${error.message}\n`);
    return 1;
  }
}
