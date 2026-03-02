#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CATEGORY_KEYS = ['performance', 'accessibility', 'best-practices', 'seo'];
const METRIC_KEYS = {
  'first-contentful-paint': 'fcp',
  'largest-contentful-paint': 'lcp',
  'cumulative-layout-shift': 'cls',
  'total-blocking-time': 'tbt',
  'speed-index': 'speedIndex',
  interactive: 'interactive',
};

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;

    const [rawKey, inlineValue] = token.slice(2).split('=');
    if (inlineValue !== undefined) {
      parsed[rawKey] = inlineValue;
      continue;
    }

    const nextToken = argv[index + 1];
    if (!nextToken || nextToken.startsWith('--')) {
      parsed[rawKey] = 'true';
      continue;
    }

    parsed[rawKey] = nextToken;
    index += 1;
  }

  return parsed;
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function resolveLighthouseRunner() {
  const localBinary = path.resolve(
    process.cwd(),
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'lighthouse.cmd' : 'lighthouse'
  );

  if (fs.existsSync(localBinary)) {
    return { command: localBinary, prefixArgs: [] };
  }

  const globalBinary = spawnSync('lighthouse', ['--version'], {
    stdio: 'ignore',
  });
  if (globalBinary.status === 0) {
    return { command: 'lighthouse', prefixArgs: [] };
  }

  const npxPackage =
    process.env.LIGHTHOUSE_NPX_PACKAGE || 'lighthouse@12.6.0';
  return { command: 'npx', prefixArgs: ['--yes', npxPackage] };
}

function resolveChromePath() {
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }

  const playwrightCacheDir = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (!fs.existsSync(playwrightCacheDir)) {
    return undefined;
  }

  const candidates = fs
    .readdirSync(playwrightCacheDir)
    .filter((entry) => entry.startsWith('chromium-'))
    .sort((a, b) => b.localeCompare(a));

  for (const candidate of candidates) {
    const chromePath = path.join(
      playwrightCacheDir,
      candidate,
      'chrome-linux64',
      'chrome'
    );
    if (fs.existsSync(chromePath)) {
      return chromePath;
    }
  }

  return undefined;
}

function getCategoryScores(report) {
  const scores = {};
  for (const category of CATEGORY_KEYS) {
    const score = report?.categories?.[category]?.score;
    scores[category] = typeof score === 'number' ? score : 0;
  }
  return scores;
}

function getMetrics(report) {
  const metrics = {};
  for (const [auditId, outputKey] of Object.entries(METRIC_KEYS)) {
    const value = report?.audits?.[auditId]?.numericValue;
    metrics[outputKey] = typeof value === 'number' ? value : null;
  }
  return metrics;
}

const args = parseArgs(process.argv.slice(2));
const url = args.url || process.env.LIGHTHOUSE_URL || 'http://localhost:3000';
const preset = (args.preset || process.env.LIGHTHOUSE_PRESET || 'mobile').toLowerCase();
const runs = Math.max(
  1,
  Number.parseInt(args.runs || process.env.LIGHTHOUSE_RUNS || '1', 10) || 1
);
const outputPath = path.resolve(
  args.output ||
    process.env.LIGHTHOUSE_OUTPUT ||
    path.join('reports', 'lighthouse', `summary-${preset}.json`)
);
const chromeFlags =
  args['chrome-flags'] ||
  process.env.LIGHTHOUSE_CHROME_FLAGS ||
  '--headless=new --no-sandbox --disable-dev-shm-usage --user-data-dir=/tmp/openmanager-lighthouse-profile';
const onlyCategories =
  args['only-categories'] ||
  process.env.LIGHTHOUSE_ONLY_CATEGORIES ||
  CATEGORY_KEYS.join(',');
const quiet = args.quiet !== 'false';

const thresholds = {
  performance: toNumber(
    args['min-performance'] || process.env.LIGHTHOUSE_MIN_PERFORMANCE
  ),
  accessibility: toNumber(
    args['min-accessibility'] || process.env.LIGHTHOUSE_MIN_ACCESSIBILITY
  ),
  'best-practices': toNumber(
    args['min-best-practices'] || process.env.LIGHTHOUSE_MIN_BEST_PRACTICES
  ),
  seo: toNumber(args['min-seo'] || process.env.LIGHTHOUSE_MIN_SEO),
};

const outputDirectory = path.dirname(outputPath);
const outputExt = path.extname(outputPath) || '.json';
const outputBase = path.basename(outputPath, outputExt);
fs.mkdirSync(outputDirectory, { recursive: true });

const runner = resolveLighthouseRunner();
const resolvedChromePath = resolveChromePath();
const runResults = [];

for (let runIndex = 1; runIndex <= runs; runIndex += 1) {
  const runReportPath = path.join(
    outputDirectory,
    `${outputBase}.run-${runIndex}${outputExt}`
  );
  const commandArgs = [
    ...runner.prefixArgs,
    url,
    '--output=json',
    `--output-path=${runReportPath}`,
    `--only-categories=${onlyCategories}`,
    `--chrome-flags=${chromeFlags}`,
  ];

  // Lighthouse CLI default preset is mobile. Desktop must be explicit.
  if (preset !== 'mobile') {
    commandArgs.push(`--preset=${preset}`);
  }

  if (quiet) {
    commandArgs.push('--quiet');
  }

  console.log(`[lighthouse] run ${runIndex}/${runs}`);
  const result = spawnSync(runner.command, commandArgs, {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...(resolvedChromePath ? { CHROME_PATH: resolvedChromePath } : {}),
    },
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }

  const rawReport = JSON.parse(fs.readFileSync(runReportPath, 'utf8'));
  runResults.push({
    run: runIndex,
    reportPath: runReportPath,
    scores: getCategoryScores(rawReport),
    metrics: getMetrics(rawReport),
  });
}

const averages = {};
for (const category of CATEGORY_KEYS) {
  averages[category] = average(
    runResults.map((runResult) => runResult.scores[category])
  );
}

const thresholdFailures = Object.entries(thresholds)
  .filter(([, threshold]) => typeof threshold === 'number')
  .filter(([category, threshold]) => averages[category] < threshold)
  .map(([category, threshold]) => ({
    category,
    threshold,
    actual: averages[category],
  }));

const summary = {
  generatedAt: new Date().toISOString(),
  url,
  preset,
  runs,
  averages,
  thresholds,
  pass: thresholdFailures.length === 0,
  runResults,
};

fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));

console.log('\nLighthouse score summary');
for (const category of CATEGORY_KEYS) {
  console.log(
    `- ${category}: ${(averages[category] * 100).toFixed(1)} / 100 (${averages[category].toFixed(3)})`
  );
}
console.log(`- report: ${path.relative(process.cwd(), outputPath)}`);

if (thresholdFailures.length > 0) {
  console.error('\nThreshold failures');
  for (const failure of thresholdFailures) {
    console.error(
      `- ${failure.category}: ${failure.actual.toFixed(3)} < ${failure.threshold.toFixed(3)}`
    );
  }
  process.exit(1);
}
