#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = process.cwd();
const QA_ROOT = path.join(PROJECT_ROOT, 'reports/qa');
const EVIDENCE_ROOT = path.join(QA_ROOT, 'evidence');
const REPRO_ROOT = path.join(QA_ROOT, 'repro');
const RUNS_ROOT = path.join(QA_ROOT, 'runs');
const MIB = 1024 * 1024;

const STORAGE_DEFAULTS = {
  qaWarnBytes: toBytesFromEnv('QA_AUDIT_QA_WARN_MB', 100),
  runsWarnBytes: toBytesFromEnv('QA_AUDIT_RUNS_WARN_MB', 70),
  evidenceWarnBytes: toBytesFromEnv('QA_AUDIT_EVIDENCE_WARN_MB', 40),
  largeFileWarnBytes: toBytesFromEnv('QA_AUDIT_LARGE_FILE_MB', 8),
  archiveAgeDays: toPositiveNumberFromEnv('QA_AUDIT_ARCHIVE_AGE_DAYS', 21),
  topFiles: toPositiveNumberFromEnv('QA_AUDIT_TOP_FILES', 10),
  maxArchiveCandidates: toPositiveNumberFromEnv('QA_AUDIT_MAX_ARCHIVE_CANDIDATES', 20),
};

function toPositiveNumberFromEnv(envKey, fallback) {
  const raw = process.env[envKey];
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function toBytesFromEnv(envKey, fallbackMb) {
  return Math.floor(toPositiveNumberFromEnv(envKey, fallbackMb) * MIB);
}

function parseArgs(argv) {
  return {
    all: argv.includes('--all'),
    strict: argv.includes('--strict'),
    strictStorage: argv.includes('--strict-storage'),
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

function fileInfo(fullPath) {
  const stat = fs.statSync(fullPath);
  return {
    fullPath,
    relativePath: toRelative(fullPath),
    size: stat.size,
    mtimeMs: stat.mtimeMs,
  };
}

function summarizeSize(fileInfos) {
  return fileInfos.reduce(
    (acc, info) => {
      acc.count += 1;
      acc.bytes += info.size;
      return acc;
    },
    { count: 0, bytes: 0 }
  );
}

function formatBytes(bytes) {
  if (bytes >= MIB) return `${(bytes / MIB).toFixed(2)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KiB`;
  return `${bytes} B`;
}

function formatSizePathEntry(info) {
  return `${formatBytes(info.size)} - ${info.relativePath}`;
}

function formatBudgetLine(label, bytes, warnBytes) {
  const status = bytes > warnBytes ? 'WARN' : 'PASS';
  return `${status} ${label}: ${formatBytes(bytes)} (warn ${formatBytes(warnBytes)})`;
}

function summarizeReferencedPrefix(fileInfos, referencedPaths, prefix) {
  return fileInfos.reduce(
    (acc, info) => {
      if (!info.relativePath.startsWith(prefix)) return acc;
      if (!referencedPaths.has(info.relativePath)) return acc;
      acc.count += 1;
      acc.bytes += info.size;
      return acc;
    },
    { count: 0, bytes: 0 }
  );
}

function summarizeReferencedRuns(fileInfos, artifactRefs, runTitleById, prefix) {
  const sizeByPath = new Map(fileInfos.map((info) => [info.relativePath, info.size]));
  const seenRunPathPairs = new Set();
  const runSummaries = new Map();

  for (const entry of artifactRefs) {
    if (!entry.path.startsWith(prefix)) continue;
    if (!sizeByPath.has(entry.path)) continue;

    const dedupeKey = `${entry.runId}::${entry.path}`;
    if (seenRunPathPairs.has(dedupeKey)) continue;
    seenRunPathPairs.add(dedupeKey);

    const current =
      runSummaries.get(entry.runId) || {
        runId: entry.runId,
        title: runTitleById.get(entry.runId) || '',
        count: 0,
        bytes: 0,
      };

    current.count += 1;
    current.bytes += sizeByPath.get(entry.path) || 0;
    runSummaries.set(entry.runId, current);
  }

  return [...runSummaries.values()].sort((left, right) => {
    if (right.bytes !== left.bytes) return right.bytes - left.bytes;
    if (right.count !== left.count) return right.count - left.count;
    return left.runId.localeCompare(right.runId);
  });
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
        artifactDebt:
          record.artifactDebt && typeof record.artifactDebt === 'object'
            ? record.artifactDebt
            : null,
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
  const qaFileInfos = walkFiles(QA_ROOT).map(fileInfo);
  const evidenceFileInfos = walkFiles(EVIDENCE_ROOT).map(fileInfo);
  const reproFileInfos = walkFiles(REPRO_ROOT).map(fileInfo);
  const runFileInfos = walkFiles(RUNS_ROOT).map(fileInfo);

  const evidenceFiles = evidenceFileInfos
    .map((info) => info.relativePath)
    .filter((relativePath) => !relativePath.endsWith('/.gitkeep'))
    .filter((relativePath) => path.basename(relativePath) !== '.gitkeep');
  const reproFiles = reproFileInfos
    .map((info) => info.relativePath)
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
  const runTitleById = new Map(runs.map((run) => [run.runId, run.title || '']));

  const orphanEvidence = evidenceFiles.filter(
    (relativePath) => !referencedEvidence.has(relativePath)
  );

  const orderedRuns = sortByRecordedAtAscending(runs);
  const recentRuns = orderedRuns.slice(-12);

  const countedRunsWithoutArtifacts = (args.all ? orderedRuns : recentRuns)
    .filter((run) => run.countsTowardSummary)
    .filter((run) => run.artifactDebt?.status !== 'acknowledged')
    .filter((run) => run.artifacts.length === 0)
    .map(
      (run) =>
        `${run.runId} (${run.releaseFacing ? 'release-facing' : 'counted'}, source=${run.source || '-'})`
    );

  const releaseFacingWithoutArtifacts = (args.all ? orderedRuns : recentRuns)
    .filter((run) => run.releaseFacing)
    .filter((run) => run.artifactDebt?.status !== 'acknowledged')
    .filter((run) => run.artifacts.length === 0)
    .map((run) => run.runId);

  const acknowledgedArtifactDebt = (args.all ? orderedRuns : recentRuns)
    .filter((run) => run.artifactDebt?.status === 'acknowledged')
    .filter((run) => run.artifacts.length === 0)
    .map((run) => {
      const kind = run.artifactDebt?.kind || 'unspecified';
      return `${run.runId} (${kind})`;
    });

  const recentNonEvidenceArtifactRefs = (args.all
    ? nonEvidenceArtifactRefs
    : nonEvidenceArtifactRefs.filter((entry) =>
        recentRuns.some((run) => entry.startsWith(`${run.runId} -> `))
      ));

  const qaSummary = summarizeSize(qaFileInfos);
  const runSummary = summarizeSize(runFileInfos);
  const evidenceSummary = summarizeSize(evidenceFileInfos);
  const referencedLegacyEvidenceSummary = summarizeReferencedPrefix(
    evidenceFileInfos,
    referencedEvidence,
    'reports/qa/evidence/legacy/'
  );
  const referencedLegacyRuns = summarizeReferencedRuns(
    evidenceFileInfos,
    artifactRefs,
    runTitleById,
    'reports/qa/evidence/legacy/'
  );
  const referencedLegacyRunsLimited = referencedLegacyRuns
    .slice(0, STORAGE_DEFAULTS.topFiles)
    .map((entry) => {
      const titleSuffix = entry.title ? ` | ${entry.title}` : '';
      return `${entry.runId} | ${entry.count} files | ${formatBytes(entry.bytes)}${titleSuffix}`;
    });

  const budgetWarnings = [];
  if (qaSummary.bytes > STORAGE_DEFAULTS.qaWarnBytes) {
    budgetWarnings.push(
      formatBudgetLine('qa-total-size', qaSummary.bytes, STORAGE_DEFAULTS.qaWarnBytes)
    );
  }
  if (runSummary.bytes > STORAGE_DEFAULTS.runsWarnBytes) {
    budgetWarnings.push(
      formatBudgetLine('qa-runs-size', runSummary.bytes, STORAGE_DEFAULTS.runsWarnBytes)
    );
  }
  if (evidenceSummary.bytes > STORAGE_DEFAULTS.evidenceWarnBytes) {
    budgetWarnings.push(
      formatBudgetLine(
        'qa-evidence-size',
        evidenceSummary.bytes,
        STORAGE_DEFAULTS.evidenceWarnBytes
      )
    );
  }

  const topLargeFiles = [...qaFileInfos]
    .sort((left, right) => right.size - left.size)
    .slice(0, STORAGE_DEFAULTS.topFiles);

  const largeFilesOverWarn = qaFileInfos
    .filter((info) => info.size >= STORAGE_DEFAULTS.largeFileWarnBytes)
    .sort((left, right) => right.size - left.size);

  const nowMs = Date.now();
  const archiveCutoffMs =
    nowMs - STORAGE_DEFAULTS.archiveAgeDays * 24 * 60 * 60 * 1000;
  const referencedArtifactPaths = new Set(artifactRefs.map((entry) => entry.path));
  const archiveCandidates = runFileInfos
    .filter((info) => !/\.json$/i.test(info.relativePath))
    .filter((info) => path.basename(info.relativePath) !== '.gitkeep')
    .filter((info) => !referencedArtifactPaths.has(info.relativePath))
    .filter((info) => info.mtimeMs < archiveCutoffMs)
    .sort((left, right) => right.size - left.size);
  const archiveCandidatesLimited = archiveCandidates
    .slice(0, STORAGE_DEFAULTS.maxArchiveCandidates)
    .map((info) => {
      const ageDays = Math.floor((nowMs - info.mtimeMs) / (24 * 60 * 60 * 1000));
      return `${formatBytes(info.size)} - ${info.relativePath} (${ageDays}d old)`;
    });
  const archiveCandidatesTotalBytes = archiveCandidates.reduce(
    (sum, info) => sum + info.size,
    0
  );

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
    `- ${args.all ? 'all' : 'recent'} acknowledged artifact debt runs: ${acknowledgedArtifactDebt.length}`
  );
  console.log(
    `- ${args.all ? 'all' : 'recent'} non-evidence artifact refs: ${recentNonEvidenceArtifactRefs.length}`
  );
  console.log(`- qa total size: ${formatBytes(qaSummary.bytes)} (${qaSummary.count} files)`);
  console.log(
    `- qa/runs size: ${formatBytes(runSummary.bytes)} (${runSummary.count} files)`
  );
  console.log(
    `- qa/evidence size: ${formatBytes(evidenceSummary.bytes)} (${evidenceSummary.count} files)`
  );
  console.log(
    `- referenced legacy evidence: ${referencedLegacyEvidenceSummary.count} (${formatBytes(referencedLegacyEvidenceSummary.bytes)})`
  );
  console.log(
    `- files >= ${formatBytes(STORAGE_DEFAULTS.largeFileWarnBytes)}: ${largeFilesOverWarn.length}`
  );
  console.log(
    `- archive candidates (unreferenced run assets, ${STORAGE_DEFAULTS.archiveAgeDays}d+): ${archiveCandidates.length} (${formatBytes(archiveCandidatesTotalBytes)})`
  );

  console.log('');
  console.log(formatList('Orphan durable evidence', orphanEvidence));
  console.log('');
  console.log(formatList('Missing durable artifact refs', missingDurableArtifactRefs));
  console.log('');
  console.log(
    formatList(
      `${args.all ? 'Acknowledged artifact debt runs' : 'Recent acknowledged artifact debt runs'}`,
      acknowledgedArtifactDebt
    )
  );
  console.log('');
  console.log(formatList('Non-evidence artifact refs', recentNonEvidenceArtifactRefs));
  console.log('');
  console.log(
    formatList(
      `${args.all ? 'Counted runs without artifacts' : 'Recent counted runs without artifacts'} (warning)`,
      countedRunsWithoutArtifacts
    )
  );
  console.log('');
  console.log(
    formatList('Storage budget warnings', budgetWarnings.length > 0 ? budgetWarnings : [])
  );
  console.log('');
  console.log(
    formatList(
      `Top ${STORAGE_DEFAULTS.topFiles} largest QA files`,
      topLargeFiles.map(formatSizePathEntry)
    )
  );
  console.log('');
  console.log(
    formatList(
      `Top ${STORAGE_DEFAULTS.topFiles} referenced legacy runs`,
      referencedLegacyRunsLimited
    )
  );
  console.log('');
  console.log(
    formatList(
      `Archive candidates (max ${STORAGE_DEFAULTS.maxArchiveCandidates} shown)`,
      archiveCandidatesLimited
    )
  );

  const hasStrictFailure =
    orphanEvidence.length > 0 ||
    missingDurableArtifactRefs.length > 0 ||
    recentNonEvidenceArtifactRefs.length > 0;
  const hasStrictStorageFailure = budgetWarnings.length > 0;

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
  if (args.strictStorage && hasStrictStorageFailure) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  summarizeReferencedPrefix,
  summarizeReferencedRuns,
  formatBytes,
};
