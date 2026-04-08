#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = process.cwd();
const QA_ROOT = path.join(PROJECT_ROOT, 'reports/qa');
const EVIDENCE_ROOT = path.join(QA_ROOT, 'evidence');
const REPRO_ROOT = path.join(QA_ROOT, 'repro');
const RUNS_ROOT = path.join(QA_ROOT, 'runs');

function parseArgs(argv) {
  return {
    all: argv.includes('--all'),
    strict: argv.includes('--strict'),
  };
}

function walkFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];

  const files = [];
  const queue = [rootDir];
  while (queue.length > 0) {
    const current = queue.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }
  return files.sort();
}

function toRelative(fullPath) {
  return path.relative(PROJECT_ROOT, fullPath).replace(/\\/g, '/');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function collectRunRecords() {
  return walkFiles(RUNS_ROOT)
    .filter((filePath) => /^qa-run-QA-.*\.json$/i.test(path.basename(filePath)))
    .map((filePath) => {
      const record = readJson(filePath);
      return {
        filePath,
        relativePath: toRelative(filePath),
        runId: record.runId || path.basename(filePath),
        title: record.runTitle || record.title || '',
        source: record.source || '',
        releaseFacing: record.releaseFacing === true,
        countsTowardSummary: record.countsTowardSummary !== false,
        recordedAt: record.recordedAt || '',
        artifacts: Array.isArray(record.artifacts) ? record.artifacts : [],
      };
    });
}

function formatList(title, items) {
  if (items.length === 0) return `${title}: none`;
  return [title, ...items.map((item) => `- ${item}`)].join('\n');
}

function sortByRecordedAtAscending(runs) {
  return [...runs].sort((left, right) => {
    const leftTime = Date.parse(left.recordedAt || '') || 0;
    const rightTime = Date.parse(right.recordedAt || '') || 0;
    return leftTime - rightTime;
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const evidenceFiles = walkFiles(EVIDENCE_ROOT)
    .map(toRelative)
    .filter((relativePath) => !relativePath.endsWith('/.gitkeep'))
    .filter((relativePath) => path.basename(relativePath) !== '.gitkeep');
  const reproFiles = walkFiles(REPRO_ROOT)
    .map(toRelative)
    .filter((relativePath) => path.basename(relativePath) !== '.gitkeep');
  const runs = collectRunRecords();

  const artifactRefs = [];
  const missingDurableArtifactRefs = [];
  const nonEvidenceArtifactRefs = [];

  for (const run of runs) {
    for (const artifact of run.artifacts) {
      if (!artifact || typeof artifact !== 'object') continue;
      if (!artifact.path || typeof artifact.path !== 'string') continue;

      const normalizedPath = artifact.path.replace(/\\/g, '/');
      artifactRefs.push({
        runId: run.runId,
        path: normalizedPath,
      });

      const absolutePath = path.resolve(PROJECT_ROOT, normalizedPath);
      if (!normalizedPath.startsWith('reports/qa/evidence/')) {
        nonEvidenceArtifactRefs.push(`${run.runId} -> ${normalizedPath}`);
        continue;
      }

      if (!fs.existsSync(absolutePath)) {
        missingDurableArtifactRefs.push(`${run.runId} -> ${normalizedPath}`);
      }
    }
  }

  const referencedEvidence = new Set(
    artifactRefs
      .map((entry) => entry.path)
      .filter((entry) => entry.startsWith('reports/qa/evidence/'))
  );

  const orphanEvidence = evidenceFiles.filter(
    (relativePath) => !referencedEvidence.has(relativePath)
  );

  const orderedRuns = sortByRecordedAtAscending(runs);
  const recentRuns = orderedRuns.slice(-12);

  const countedRunsWithoutArtifacts = (args.all ? orderedRuns : recentRuns)
    .filter((run) => run.countsTowardSummary)
    .filter((run) => run.artifacts.length === 0)
    .map(
      (run) =>
        `${run.runId} (${run.releaseFacing ? 'release-facing' : 'counted'}, source=${run.source || '-'})`
    );

  const releaseFacingWithoutArtifacts = (args.all ? orderedRuns : recentRuns)
    .filter((run) => run.releaseFacing)
    .filter((run) => run.artifacts.length === 0)
    .map((run) => run.runId);

  const recentNonEvidenceArtifactRefs = (args.all
    ? nonEvidenceArtifactRefs
    : nonEvidenceArtifactRefs.filter((entry) =>
        recentRuns.some((run) => entry.startsWith(`${run.runId} -> `))
      ));

  console.log('QA Evidence Audit');
  console.log(`- run files: ${runs.length}`);
  console.log(`- durable evidence files: ${evidenceFiles.length}`);
  console.log(`- repro archive files: ${reproFiles.length}`);
  console.log(`- referenced durable evidence: ${referencedEvidence.size}`);
  console.log(`- orphan durable evidence: ${orphanEvidence.length}`);
  console.log(`- missing durable artifact paths: ${missingDurableArtifactRefs.length}`);
  console.log(
    `- ${args.all ? 'all' : 'recent'} counted runs without artifacts: ${countedRunsWithoutArtifacts.length}`
  );
  console.log(
    `- ${args.all ? 'all' : 'recent'} non-evidence artifact refs: ${recentNonEvidenceArtifactRefs.length}`
  );

  console.log('');
  console.log(formatList('Orphan durable evidence', orphanEvidence));
  console.log('');
  console.log(formatList('Missing durable artifact refs', missingDurableArtifactRefs));
  console.log('');
  console.log(formatList('Non-evidence artifact refs', recentNonEvidenceArtifactRefs));
  console.log('');
  console.log(
    formatList(
      `${args.all ? 'Counted runs without artifacts' : 'Recent counted runs without artifacts'} (warning)`,
      countedRunsWithoutArtifacts
    )
  );

  const hasStrictFailure =
    orphanEvidence.length > 0 ||
    missingDurableArtifactRefs.length > 0 ||
    recentNonEvidenceArtifactRefs.length > 0;

  if (releaseFacingWithoutArtifacts.length > 0) {
    console.log('');
    console.log(
      formatList(
        'Release-facing runs without artifacts (historical debt warning)',
        releaseFacingWithoutArtifacts
      )
    );
  }

  if (args.strict && hasStrictFailure) {
    process.exitCode = 1;
  }
}

main();
