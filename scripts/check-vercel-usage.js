#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

const PASS_THROUGH_ARGS = process.argv.slice(2);
const COMMAND_CANDIDATES = [
  { command: 'vercel', args: ['usage'] },
  { command: 'npx', args: ['vercel', 'usage'] },
];

function printUsage() {
  console.log(
    [
      'Usage:',
      '  node scripts/check-vercel-usage.js [--from YYYY-MM-DD] [--to YYYY-MM-DD]',
      '',
      'Examples:',
      '  npm run check:usage:vercel',
      '  npm run check:usage:vercel -- --from 2026-03-01 --to 2026-03-31',
      '',
      'This command runs `vercel usage` so Vercel billing usage can be reviewed after QA/deploy.',
    ].join('\n')
  );
}

function runCommand(command, args) {
  return spawnSync(command, [...args, ...PASS_THROUGH_ARGS], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function printOutput(stdout, stderr) {
  if (stdout && stdout.trim()) {
    process.stdout.write(stdout.endsWith('\n') ? stdout : `${stdout}\n`);
  }
  if (stderr && stderr.trim()) {
    process.stderr.write(stderr.endsWith('\n') ? stderr : `${stderr}\n`);
  }
}

function main() {
  if (PASS_THROUGH_ARGS.includes('--help') || PASS_THROUGH_ARGS.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  let lastFailure = null;

  for (const candidate of COMMAND_CANDIDATES) {
    const result = runCommand(candidate.command, candidate.args);
    if (!result.error && result.status === 0) {
      printOutput(result.stdout, result.stderr);
      console.log(
        `PASS VERCEL-USAGE checked via \`${candidate.command} ${candidate.args.join(' ')}\``
      );
      console.log(
        'INFO Review the output for build, functions, bandwidth, and any unexpected billed usage.'
      );
      return;
    }

    lastFailure = result.error
      ? `${candidate.command}: ${result.error.message}`
      : `${candidate.command}: ${result.stderr?.trim() || `exit ${result.status}`}`;
  }

  console.error('FAIL VERCEL-USAGE unable to fetch usage with local CLI.');
  if (lastFailure) {
    console.error(`INFO last error: ${lastFailure}`);
  }
  console.error(
    'ACTION Check the Vercel Usage dashboard manually or authenticate the CLI, then record the result in usageChecks.'
  );
  process.exit(1);
}

main();
