#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const QA_ROOT = path.join(PROJECT_ROOT, 'reports', 'qa');
const TRACKER_PATH = path.join(QA_ROOT, 'qa-tracker.json');
const OUTPUT_PATH = path.join(
  PROJECT_ROOT,
  'public',
  'data',
  'qa',
  'validation-evidence.json'
);

function formatEvidenceDate(dateString) {
  if (!dateString) {
    return {
      iso: null,
      short: 'latest',
      long: 'Latest',
    };
  }

  const date = new Date(dateString);

  return {
    iso: date.toISOString(),
    short: date.toISOString().slice(0, 10),
    long: date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }),
  };
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function shouldWriteValidationEvidenceSnapshot(trackerPath = TRACKER_PATH) {
  return path.resolve(trackerPath) === path.resolve(TRACKER_PATH);
}

function hasGitHubActionsLink(run) {
  return Array.isArray(run?.links)
    ? run.links.some((link) => link?.type?.startsWith('github-actions'))
    : false;
}

function findLatestPublicEvidenceRun(runs) {
  return [...runs].reverse().find((run) => {
    const target = run?.environment?.target;
    return target === 'vercel-production' || hasGitHubActionsLink(run);
  });
}

function findLatestProofRun(runs) {
  return [...runs].reverse().find((run) => hasGitHubActionsLink(run));
}

function buildValidationEvidenceSnapshot(tracker) {
  const summary = tracker?.summary;
  const runs = Array.isArray(tracker?.runs) ? tracker.runs : [];
  const latestPublicEvidenceRun = findLatestPublicEvidenceRun(runs);
  const latestProofRun = findLatestProofRun(runs);

  if (!summary || !latestProofRun?.runId || !latestPublicEvidenceRun?.runId) {
    throw new Error('QA validation evidence summary is unavailable');
  }

  const runYear = latestProofRun.runId.slice(3, 7);
  const githubRunLink =
    latestProofRun.links?.find((link) => link.type === 'github-actions-run') ??
    null;
  const githubArtifactLinks = (latestProofRun.links ?? []).filter(
    (link) => link.type === 'github-actions-artifact'
  );

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    source: {
      trackerPath: 'reports/qa/qa-tracker.json',
      statusPath: 'reports/qa/QA_STATUS.md',
      publicPath: 'public/data/qa/validation-evidence.json',
      publicHref: '/data/qa/validation-evidence.json',
      latestRunId: latestPublicEvidenceRun.runId,
    },
    summary: {
      totalRuns: summary.totalRuns,
      totalChecks: summary.totalChecks,
      completedItems: summary.completedItems,
      expertDomainsOpenGaps: summary.expertDomainsOpenGaps,
      wontFixItems: summary.wontFixItems,
      lastRecordedAt: summary.lastRecordedAt ?? null,
    },
    trackerUpdated: formatEvidenceDate(summary.lastRecordedAt),
    publicEvidenceUpdated: formatEvidenceDate(latestPublicEvidenceRun.recordedAt),
    latestProofRecorded: formatEvidenceDate(latestProofRun.recordedAt),
    latestProofRun: {
      runId: latestProofRun.runId,
      title: latestProofRun.title ?? latestProofRun.runId,
      scope: latestProofRun.scope ?? 'targeted',
      recordedAt: latestProofRun.recordedAt ?? null,
      commitSha: latestProofRun.environment?.commitSha ?? '',
      repoPath: `reports/qa/runs/${runYear}/qa-run-${latestProofRun.runId}.json`,
      ciRunLink: githubRunLink,
      ciArtifactLinks: githubArtifactLinks,
    },
  };
}

function writeValidationEvidenceSnapshot({
  trackerPath = TRACKER_PATH,
  outputPath = OUTPUT_PATH,
} = {}) {
  const tracker = readJsonFile(trackerPath);
  const snapshot = buildValidationEvidenceSnapshot(tracker);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

  return {
    snapshot,
    outputPath,
  };
}

module.exports = {
  OUTPUT_PATH,
  TRACKER_PATH,
  buildValidationEvidenceSnapshot,
  findLatestProofRun,
  findLatestPublicEvidenceRun,
  formatEvidenceDate,
  hasGitHubActionsLink,
  shouldWriteValidationEvidenceSnapshot,
  writeValidationEvidenceSnapshot,
};

if (require.main === module) {
  const { outputPath, snapshot } = writeValidationEvidenceSnapshot();
  console.log(`✅ validation evidence snapshot written: ${outputPath}`);
  console.log(
    `- latest run: ${snapshot.source.latestRunId}, completed=${snapshot.summary.completedItems}, open-gaps=${snapshot.summary.expertDomainsOpenGaps}`
  );
}
