import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './utils.js';
import { runSetup } from './setup.js';
import { getGlobalHookStatus, installGlobalCheckRufloHook } from './hooks.js';

function printHelp() {
  process.stdout.write(`
@mfjjs/ruflo-setup

Usage:
  ruflo-setup [options]
  ruflo-setup hooks install [options]
  ruflo-setup hooks status

Options:
  --force, -f      Overwrite existing config without prompt
  --dry-run        Show actions without making changes
  --yes, -y        Non-interactive yes for prompts
  --no-hooks       Skip global hook installation during setup
  --skip-init      Skip 'npx ruflo@latest init --full'
  --verbose, -v    Extra output

Examples:
  ruflo-setup
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
    if (argv.includes('--help') || argv.includes('-h')) {
      printHelp();
      return 0;
    }

    const packageRoot = packageRootFromModule();
    const flags = parseArgs(argv);

    if (flags.command === 'hooks') {
      const subcommand = argv[1] || 'status';
      if (subcommand === 'status') {
        const status = getGlobalHookStatus({ packageRoot });
        process.stdout.write(`Hook installed: ${status.installed ? 'yes' : 'no'}\n`);
        process.stdout.write(`Settings path: ${status.settingsPath}\n`);
        process.stdout.write(`Reason: ${status.reason}\n`);
        process.stdout.write(`Command: ${status.hookCommand}\n`);
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
