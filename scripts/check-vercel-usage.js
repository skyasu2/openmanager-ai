#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

const PASS_THROUGH_ARGS = process.argv.slice(2);
const DEFAULT_CACHE_HOME = '/tmp';
const JSON_ARGS = ['usage', '--format', 'json', '--non-interactive'];
const COSTS_NOT_FOUND_PATTERN = /Costs not found \(404\)/i;
const COMMAND_CANDIDATES = [
  { command: 'vercel', args: JSON_ARGS },
  { command: 'npx', args: ['vercel', ...JSON_ARGS] },
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
      'This command runs `vercel usage --format json --non-interactive` so Vercel billing usage can be reviewed after QA/deploy.',
    ].join('\n')
  );
}

function hasExplicitDateRange(args) {
  return args.some(
    (arg, index) =>
      arg === '--from' ||
      arg === '--to' ||
      arg.startsWith('--from=') ||
      arg.startsWith('--to=') ||
      (index > 0 && (args[index - 1] === '--from' || args[index - 1] === '--to'))
  );
}

function formatDateYmd(date) {
  return date.toISOString().slice(0, 10);
}

function getReferenceDate() {
  const rawValue = process.env.VERCEL_USAGE_REFERENCE_DATE;
  if (!rawValue) {
    return new Date();
  }

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }

  return parsed;
}

function getPreviousMonthRange(referenceDate) {
  const previousMonthStart = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - 1, 1)
  );
  const previousMonthEnd = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 0)
  );

  return {
    from: formatDateYmd(previousMonthStart),
    to: formatDateYmd(previousMonthEnd),
  };
}

function runCommand(command, args, options = {}) {
  const appendPassThroughArgs = options.appendPassThroughArgs ?? true;
  const fullArgs = appendPassThroughArgs ? [...args, ...PASS_THROUGH_ARGS] : args;

  return spawnSync(command, fullArgs, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      XDG_CACHE_HOME: process.env.XDG_CACHE_HOME || DEFAULT_CACHE_HOME,
    },
  });
}

function getCombinedOutput(stdout, stderr) {
  return [stdout, stderr].filter(Boolean).join('\n');
}

function tryParseJson(stdout) {
  if (!stdout || !stdout.trim()) {
    return null;
  }

  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function describeFailure(command, result) {
  return result.error
    ? `${command}: ${result.error.message}`
    : `${command}: ${result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`}`;
}

function formatCurrency(value, unit) {
  if (typeof value !== 'number') {
    return `unknown ${unit}`;
  }

  return `${value.toFixed(4)} ${unit}`;
}

function printUsageSummary(label, payload) {
  const unit = payload?.pricingUnit || 'USD';
  const periodFrom = payload?.period?.from || 'unknown';
  const periodTo = payload?.period?.to || 'unknown';
  const context = payload?.context || 'unknown';
  const effectiveCost = formatCurrency(payload?.totals?.effectiveCost, unit);
  const billedCost = formatCurrency(payload?.totals?.billedCost, unit);
  const chargeCount =
    typeof payload?.chargeCount === 'number' ? String(payload.chargeCount) : 'unknown';

  console.log(
    `INFO ${label}: context=${context}, period=${periodFrom}..${periodTo}, effective=${effectiveCost}, billed=${billedCost}, chargeCount=${chargeCount}`
  );
}

function printSuccess(commandLabel, payload, options = {}) {
  const label = options.label || 'Usage snapshot';

  if (payload) {
    printUsageSummary(label, payload);
  }

  console.log(`PASS VERCEL-USAGE checked via \`${commandLabel}\``);
  console.log(
    'INFO Review the output for build, functions, bandwidth, and any unexpected billed usage.'
  );
}

function handleCostsNotFound(candidate) {
  const commandLabel = `${candidate.command} ${candidate.args.join(' ')} ${PASS_THROUGH_ARGS.join(' ')}`.trim();

  if (hasExplicitDateRange(PASS_THROUGH_ARGS)) {
    console.log(
      `INFO No charge records were returned for the requested range via \`${commandLabel}\`.`
    );
    console.log(
      'PASS VERCEL-USAGE no charge records found for the requested range. Verify in the Vercel dashboard only if this is unexpected.'
    );
    return { handled: true, success: true };
  }

  const previousMonthRange = getPreviousMonthRange(getReferenceDate());
  const probeArgs = [
    ...candidate.args,
    '--from',
    previousMonthRange.from,
    '--to',
    previousMonthRange.to,
  ];
  const probeCommandLabel = `${candidate.command} ${probeArgs.join(' ')}`;
  const probeResult = runCommand(candidate.command, probeArgs, {
    appendPassThroughArgs: false,
  });

  if (!probeResult.error && probeResult.status === 0) {
    const parsedPayload = tryParseJson(probeResult.stdout);

    console.log(
      'INFO Current billing period returned no charge records yet. This usually means the new billing period has not produced charge rows yet.'
    );
    if (parsedPayload) {
      printUsageSummary(
        `Previous month probe (${previousMonthRange.from}..${previousMonthRange.to})`,
        parsedPayload
      );
    }
    console.log(
      `PASS VERCEL-USAGE no charge records found yet for the current billing period via \`${commandLabel}\`.`
    );
    console.log(
      `INFO Connectivity was confirmed with \`${probeCommandLabel}\`, so manual dashboard follow-up is optional unless you expected billed usage today.`
    );
    return { handled: true, success: true };
  }

  return {
    handled: true,
    success: false,
    failure: `${commandLabel}: current billing period returned 404 and previous month probe failed (${describeFailure(probeCommandLabel, probeResult)})`,
  };
}

function main() {
  if (PASS_THROUGH_ARGS.includes('--help') || PASS_THROUGH_ARGS.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  let lastFailure = null;

  for (const candidate of COMMAND_CANDIDATES) {
    const result = runCommand(candidate.command, candidate.args);
    const commandLabel = `${candidate.command} ${candidate.args.join(' ')} ${PASS_THROUGH_ARGS.join(' ')}`.trim();

    if (!result.error && result.status === 0) {
      const parsedPayload = tryParseJson(result.stdout);
      printSuccess(commandLabel, parsedPayload, {
        label: hasExplicitDateRange(PASS_THROUGH_ARGS)
          ? 'Requested usage range'
          : 'Current billing period',
      });
      return;
    }

    if (COSTS_NOT_FOUND_PATTERN.test(getCombinedOutput(result.stdout, result.stderr))) {
      const handledResult = handleCostsNotFound(candidate);
      if (handledResult.success) {
        return;
      }
      lastFailure = handledResult.failure || commandLabel;
      continue;
    }

    lastFailure = describeFailure(commandLabel, result);
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
