#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_RUNS_DIR = path.resolve(process.cwd(), 'reports/qa/runs');

const DRIFT_REASON_CODES = [
  'execution_path_mismatch',
  'execution_mode_mismatch',
  'artifact_kind_mismatch',
  'reason_code_mismatch',
];

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function average(values) {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + safeNumber(value), 0) / values.length);
}

function percentile(values, percentileValue) {
  if (!values.length) return null;
  const sorted = [...values].map(safeNumber).sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.floor((percentileValue / 100) * sorted.length)
  );
  return sorted[index];
}

function collectRunFiles(dir = DEFAULT_RUNS_DIR) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectRunFiles(fullPath);
    }
    return entry.isFile() && entry.name.endsWith('.json') ? [fullPath] : [];
  });
}

function readRunFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return {
      runId: path.basename(filePath, '.json'),
      parseError: error instanceof Error ? error.message : String(error),
    };
  }
}

function textValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function collectTextSources(run) {
  const sources = [];

  for (const [field, values] of [
    ['notes', run.notes],
    ['coveredSurfaces', run.coveredSurfaces],
    ['skippedSurfaces', run.skippedSurfaces],
  ]) {
    if (Array.isArray(values)) {
      values.forEach((value, index) => {
        const text = textValue(value);
        if (text) sources.push({ field, index, text });
      });
    }
  }

  for (const [field, values] of [
    ['expertAssessments', run.expertAssessments],
    ['completedImprovements', run.completedImprovements],
    ['pendingImprovements', run.pendingImprovements],
    ['deferredImprovements', run.deferredImprovements],
    ['wontFixImprovements', run.wontFixImprovements],
  ]) {
    if (!Array.isArray(values)) continue;
    values.forEach((item, index) => {
      for (const key of ['title', 'evidence', 'note', 'rationale', 'nextAction']) {
        const text = textValue(item?.[key]);
        if (text) sources.push({ field: `${field}.${key}`, index, text });
      }
    });
  }

  return sources;
}

function extractReasonCodes(text) {
  return DRIFT_REASON_CODES.filter((code) => text.includes(code));
}

function classifyPlannerShadowText(text) {
  const lower = text.toLowerCase();
  const reasonCodes = extractReasonCodes(text);
  if (
    reasonCodes.length > 0 ||
    lower.includes('drift') ||
    lower.includes('mismatch')
  ) {
    return 'drift';
  }
  if (lower.includes('matched')) {
    return 'matched';
  }
  return 'unknown';
}

function extractSamplesFromSource(run, source) {
  const text = source.text;
  if (!/planner\s*shadow|plannerShadow/i.test(text)) {
    return [];
  }

  const reasonCodes = extractReasonCodes(text);
  const classification = classifyPlannerShadowText(text);
  const matches = [...text.matchAll(/(?:plannerShadow\.latencyMs|latencyMs)\s*[=:]\s*(\d+(?:\.\d+)?)/gi)];

  return matches.map((match) => ({
    runId: run.runId || '',
    recordedAt: run.recordedAt || '',
    sourceField: source.field,
    sourceIndex: source.index,
    latencyMs: Math.round(safeNumber(match[1])),
    classification,
    reasonCodes,
    evidence: text,
  }));
}

function extractStructuredPlannerShadowSamples(run) {
  if (!Array.isArray(run.plannerShadowObservations)) {
    return [];
  }

  return run.plannerShadowObservations.flatMap((observation, index) => {
    const latencyMs = Number(observation?.latencyMs);
    if (!Number.isFinite(latencyMs) || latencyMs < 0) {
      return [];
    }

    const reasonCodes = Array.isArray(observation?.driftReasonCodes)
      ? observation.driftReasonCodes.filter((code) =>
          DRIFT_REASON_CODES.includes(code)
        )
      : [];
    const classification =
      observation?.classification === 'matched' ||
      observation?.classification === 'drift' ||
      observation?.classification === 'unknown'
        ? observation.classification
        : reasonCodes.length > 0
          ? 'drift'
          : 'unknown';

    return [
      {
        runId: run.runId || '',
        recordedAt: run.recordedAt || '',
        sourceField: 'plannerShadowObservations',
        sourceIndex: index,
        latencyMs: Math.round(latencyMs),
        classification,
        reasonCodes,
        evidence: JSON.stringify(observation),
      },
    ];
  });
}

function dedupeSamples(samples) {
  const seen = new Set();
  const result = [];
  for (const sample of samples) {
    const key = [
      sample.runId,
      sample.latencyMs,
      sample.classification,
      sample.reasonCodes.join(','),
      sample.evidence,
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(sample);
  }
  return result;
}

function extractPlannerShadowSamples(run) {
  const structuredSamples = extractStructuredPlannerShadowSamples(run);
  if (structuredSamples.length > 0) {
    return dedupeSamples(structuredSamples);
  }

  const sources = collectTextSources(run);
  const noteSources = sources.filter((source) => source.field === 'notes');
  const noteSamples = noteSources.flatMap((source) =>
    extractSamplesFromSource(run, source)
  );
  if (noteSamples.length > 0) {
    return dedupeSamples(noteSamples);
  }
  return dedupeSamples(
    sources.flatMap((source) => extractSamplesFromSource(run, source))
  );
}

function countBy(values) {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function buildPlannerShadowTelemetryReview({ runsDir = DEFAULT_RUNS_DIR } = {}) {
  const runFiles = collectRunFiles(runsDir).sort();
  const runs = runFiles.map(readRunFile);
  const structuredRuns = runs.filter((run) =>
    extractStructuredPlannerShadowSamples(run).length > 0
  );
  const samples = runs.flatMap(extractPlannerShadowSamples);
  const latencies = samples.map((sample) => sample.latencyMs);
  const reasonCodes = samples.flatMap((sample) => sample.reasonCodes);
  const runsWithEvidence = new Set(samples.map((sample) => sample.runId));
  const driftSamples = samples.filter(
    (sample) => sample.classification === 'drift'
  );

  return {
    runsScanned: runs.length,
    runsWithPlannerShadowEvidence: runsWithEvidence.size,
    structuredObservationRuns: structuredRuns.length,
    sampleCount: samples.length,
    latency: {
      avgMs: average(latencies),
      p95Ms: percentile(latencies, 95),
      zeroSamples: samples.filter((sample) => sample.latencyMs === 0).length,
      maxMs: latencies.length ? Math.max(...latencies) : null,
    },
    classificationCounts: countBy(samples.map((sample) => sample.classification)),
    driftRatePct: samples.length
      ? Number(((driftSamples.length / samples.length) * 100).toFixed(2))
      : 0,
    reasonCodeCounts: countBy(reasonCodes),
    evidenceExport:
      structuredRuns.length > 0 ? 'structured' : samples.length > 0 ? 'note-derived' : 'missing',
    reviewDecision:
      structuredRuns.length > 0
        ? 'production-telemetry-structured'
        : samples.length > 0
          ? 'telemetry-adapter-gap'
          : 'insufficient-evidence',
    samples,
  };
}

function formatReview(review) {
  const lines = [];
  lines.push('Planner Shadow Telemetry Review');
  lines.push(`- runs scanned: ${review.runsScanned}`);
  lines.push(
    `- runs with plannerShadow evidence: ${review.runsWithPlannerShadowEvidence}`
  );
  lines.push(`- structured observation runs: ${review.structuredObservationRuns}`);
  lines.push(`- sample count: ${review.sampleCount}`);
  lines.push(
    `- latency avg/p95/max: ${review.latency.avgMs ?? '-'}ms / ${review.latency.p95Ms ?? '-'}ms / ${review.latency.maxMs ?? '-'}ms`
  );
  lines.push(`- zero latency samples: ${review.latency.zeroSamples}`);
  lines.push(`- drift rate: ${review.driftRatePct}%`);
  lines.push(
    `- classification counts: ${JSON.stringify(review.classificationCounts)}`
  );
  lines.push(`- reason code counts: ${JSON.stringify(review.reasonCodeCounts)}`);
  lines.push(`- evidence export: ${review.evidenceExport}`);
  lines.push(`- review decision: ${review.reviewDecision}`);

  if (review.reviewDecision === 'telemetry-adapter-gap') {
    lines.push(
      '- next action: add structured plannerShadowObservations to QA recording before using this metric as a rollout gate'
    );
  }

  return `${lines.join('\n')}\n`;
}

function main() {
  const json = process.argv.includes('--json');
  const review = buildPlannerShadowTelemetryReview();
  if (json) {
    process.stdout.write(`${JSON.stringify(review, null, 2)}\n`);
    return;
  }
  process.stdout.write(formatReview(review));
}

if (require.main === module) {
  main();
}

module.exports = {
  buildPlannerShadowTelemetryReview,
  classifyPlannerShadowText,
  collectRunFiles,
  extractPlannerShadowSamples,
  extractStructuredPlannerShadowSamples,
  formatReview,
};
