#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_BASELINE_PATH = path.resolve(
  process.cwd(),
  'config/qa/routing-regression-baseline.json'
);
const DEFAULT_LANGFUSE_LIMIT = 100;
const DEFAULT_LANGFUSE_QUERY = 'supervisor';

function normalizeText(value) {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim()
    : '';
}

function normalizeProvider(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('deterministic')) return 'deterministic';
  if (normalized.includes('mistral')) return 'mistral';
  if (normalized.includes('groq')) return 'groq';
  if (normalized.includes('zai') || normalized.includes('z.ai')) return 'zai';
  if (normalized.includes('cerebras')) return 'cerebras';
  if (normalized.includes('gemini')) return 'gemini';
  return normalized;
}

function parseJsonPayload(text, source = 'JSON input') {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (strictError) {
    const arrayStart = trimmed.indexOf('[');
    const objectStart = trimmed.indexOf('{');
    const starts = [arrayStart, objectStart].filter((index) => index >= 0);
    if (starts.length === 0) {
      throw strictError;
    }

    const payloadStart = Math.min(...starts);
    try {
      return JSON.parse(trimmed.slice(payloadStart));
    } catch (payloadError) {
      const message = payloadError instanceof Error
        ? payloadError.message
        : String(payloadError);
      throw new Error(`Invalid JSON payload in ${source}: ${message}`);
    }
  }
}

function loadJsonFile(filePath) {
  return parseJsonPayload(fs.readFileSync(filePath, 'utf8'), filePath);
}

function parseArgs(argv) {
  const options = {
    baselinePath: DEFAULT_BASELINE_PATH,
    inputPath: '',
    limit: DEFAULT_LANGFUSE_LIMIT,
    query: DEFAULT_LANGFUSE_QUERY,
    json: false,
    failOnMissing: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--baseline') {
      options.baselinePath = path.resolve(process.cwd(), argv[++index] || '');
    } else if (arg === '--input') {
      options.inputPath = path.resolve(process.cwd(), argv[++index] || '');
    } else if (arg === '--limit') {
      const value = Number.parseInt(argv[++index] || '', 10);
      options.limit = Number.isFinite(value) && value > 0 ? value : options.limit;
    } else if (arg === '--q') {
      options.query = argv[++index] || '';
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--fail-on-missing') {
      options.failOnMissing = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function printUsage() {
  console.log('Usage: npm run qa:routing:check [-- options]');
  console.log('  --baseline <file>       Baseline routing table JSON');
  console.log('  --input <file>          Langfuse JSON fixture; skips live API call');
  console.log('  --limit <n>             Live Langfuse trace limit (default 100)');
  console.log('  --q <term>              Live Langfuse name filter (default supervisor)');
  console.log('  --json                  Print machine-readable report');
  console.log('  --fail-on-missing       Treat missing baseline traces as failure');
}

function isAuxiliaryTrace(trace) {
  return typeof trace?.name === 'string' && trace.name.startsWith('timeout_monitor_');
}

function traceInputText(trace) {
  if (typeof trace?.input === 'string') return normalizeText(trace.input);
  if (trace?.input && typeof trace.input === 'object') {
    return normalizeText(JSON.stringify(trace.input));
  }
  return '';
}

function caseQueries(testCase) {
  return [testCase.query, ...(Array.isArray(testCase.aliases) ? testCase.aliases : [])]
    .map(normalizeText)
    .filter(Boolean);
}

function traceMatchesCase(trace, testCase) {
  const input = traceInputText(trace);
  if (!input) return false;

  const exactQueries = caseQueries(testCase);
  if (exactQueries.some((query) => input === query)) return true;

  const includes = Array.isArray(testCase.match?.inputIncludes)
    ? testCase.match.inputIncludes.map(normalizeText).filter(Boolean)
    : [];
  return includes.length > 0 && includes.every((part) => input.includes(part));
}

function findTraceForCase(traces, testCase) {
  return traces.find((trace) => !isAuxiliaryTrace(trace) && traceMatchesCase(trace, testCase));
}

function extractRoutingInfo(trace) {
  const metadata = trace?.metadata && typeof trace.metadata === 'object'
    ? trace.metadata
    : {};
  const routingDecisionTrace = metadata.routingDecisionTrace &&
    typeof metadata.routingDecisionTrace === 'object'
    ? metadata.routingDecisionTrace
    : {};
  const agentDecision = routingDecisionTrace.agentDecision &&
    typeof routingDecisionTrace.agentDecision === 'object'
    ? routingDecisionTrace.agentDecision
    : {};

  return {
    actualAgent:
      normalizeText(metadata.finalAgent) ||
      normalizeText(agentDecision.selectedAgent) ||
      null,
    actualProvider:
      normalizeProvider(metadata.provider) ||
      normalizeProvider(metadata.modelId) ||
      null,
    success: typeof metadata.success === 'boolean' ? metadata.success : null,
    traceId: normalizeText(metadata.traceId) || normalizeText(trace?.id) || null,
    timestamp: normalizeText(trace?.timestamp) || null,
  };
}

function evaluateCase(testCase, trace) {
  if (!trace) {
    return {
      id: testCase.id,
      query: testCase.query,
      status: 'missing',
      expectedAgent: testCase.expectedAgent,
      expectedProviders: testCase.expectedProviders || [],
      issues: ['trace_missing'],
    };
  }

  const info = extractRoutingInfo(trace);
  const issues = [];
  const expectedProviders = Array.isArray(testCase.expectedProviders)
    ? testCase.expectedProviders.map(normalizeProvider)
    : [];
  const expectedSuccess = testCase.expectedSuccess !== false;

  if (testCase.expectedAgent && info.actualAgent !== testCase.expectedAgent) {
    issues.push('agent_mismatch');
  }
  if (expectedProviders.length > 0) {
    if (!info.actualProvider) {
      issues.push('provider_missing');
    } else if (!expectedProviders.includes(info.actualProvider)) {
      issues.push('provider_mismatch');
    }
  }
  if (info.success !== null && info.success !== expectedSuccess) {
    issues.push('success_mismatch');
  }

  return {
    id: testCase.id,
    query: testCase.query,
    status: issues.length > 0 ? 'drift' : 'pass',
    expectedAgent: testCase.expectedAgent,
    actualAgent: info.actualAgent,
    expectedProviders: testCase.expectedProviders || [],
    actualProvider: info.actualProvider,
    success: info.success,
    traceId: info.traceId,
    timestamp: info.timestamp,
    issues,
  };
}

function roundPct(value) {
  return Number(value.toFixed(2));
}

function buildRoutingRegressionReport({ baseline, traces }) {
  const cases = Array.isArray(baseline?.cases) ? baseline.cases : [];
  const normalizedTraces = Array.isArray(traces) ? traces : [];
  const results = cases.map((testCase) =>
    evaluateCase(testCase, findTraceForCase(normalizedTraces, testCase))
  );
  const evaluatedCases = results.filter((result) => result.status !== 'missing').length;
  const driftCases = results.filter((result) => result.status === 'drift').length;
  const missingCases = results.filter((result) => result.status === 'missing').length;
  const passedCases = results.filter((result) => result.status === 'pass').length;

  return {
    summary: {
      totalCases: cases.length,
      evaluatedCases,
      passedCases,
      driftCases,
      missingCases,
      driftRatePct: evaluatedCases > 0
        ? roundPct((driftCases / evaluatedCases) * 100)
        : 0,
    },
    results,
  };
}

function formatRoutingRegressionReport(report) {
  const { summary, results } = report;
  const lines = [
    'Routing Regression Report',
    `- total: ${summary.totalCases}`,
    `- evaluated: ${summary.evaluatedCases}`,
    `- pass: ${summary.passedCases}`,
    `- drift: ${summary.driftCases}/${summary.evaluatedCases} (${summary.driftRatePct}%)`,
    `- missing: ${summary.missingCases}`,
  ];

  const driftResults = results.filter((result) => result.status === 'drift');
  if (driftResults.length > 0) {
    lines.push('', 'Drift Cases');
    for (const result of driftResults) {
      lines.push(
        `- ${result.id}: expectedAgent=${result.expectedAgent || '-'} actualAgent=${result.actualAgent || '-'} ` +
        `expectedProviders=${(result.expectedProviders || []).join('|') || '-'} actualProvider=${result.actualProvider || '-'} ` +
        `issues=${result.issues.join('|')}`
      );
    }
  }

  const missingResults = results.filter((result) => result.status === 'missing');
  if (missingResults.length > 0) {
    lines.push('', 'Missing Cases');
    for (const result of missingResults) {
      lines.push(`- ${result.id}: ${result.query}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function loadLiveLangfuseTraces({ limit, query }) {
  const scriptPath = path.resolve(process.cwd(), 'scripts/qa/langfuse-check.js');
  const args = [scriptPath, '--limit', String(limit), '--json'];
  if (query) args.splice(1, 0, '--q', query);
  const stdout = execFileSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(stdout);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const baseline = loadJsonFile(options.baselinePath);
  const traces = options.inputPath
    ? loadJsonFile(options.inputPath)
    : loadLiveLangfuseTraces(options);
  const report = buildRoutingRegressionReport({ baseline, traces });

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    process.stdout.write(formatRoutingRegressionReport(report));
  }

  const shouldFail =
    report.summary.driftCases > 0 ||
    report.summary.evaluatedCases === 0 ||
    (options.failOnMissing && report.summary.missingCases > 0);

  if (shouldFail) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  buildRoutingRegressionReport,
  formatRoutingRegressionReport,
  normalizeProvider,
  normalizeText,
  parseJsonPayload,
};
