#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { repairTrackerDerivedFields } = require('./qa-tracker-utils');
const { writeValidationEvidenceSnapshot } = require('./build-validation-evidence');
const {
  statusMarkdown,
} = require('./record-qa-run.js');

const TRACKER_PATH = path.resolve(process.cwd(), 'reports/qa/qa-tracker.json');
const STATUS_PATH = path.resolve(process.cwd(), 'reports/qa/QA_STATUS.md');
const VALIDATION_EVIDENCE_PATH = path.resolve(
  process.cwd(),
  'public/data/qa/validation-evidence.json'
);

function printUsage() {
  console.log('Usage: npm run qa:status [-- --write]');
  console.log('  default: read-only summary from qa-tracker.json');
  console.log('  --write: regenerate reports/qa/QA_STATUS.md before printing');
}

function run() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--help') || args.has('-h')) {
    printUsage();
    process.exit(0);
  }

  if (!fs.existsSync(TRACKER_PATH)) {
    console.log('qa-tracker.json not found. Run `npm run qa:record` first.');
    process.exit(0);
  }

  const tracker = JSON.parse(fs.readFileSync(TRACKER_PATH, 'utf8'));
  const shouldWrite = args.has('--write') || args.has('--sync');
  let validationEvidenceSyncMessage = '';
  repairTrackerDerivedFields(tracker);
  if (shouldWrite) {
    fs.writeFileSync(TRACKER_PATH, `${JSON.stringify(tracker, null, 2)}\n`, 'utf8');
    fs.writeFileSync(STATUS_PATH, statusMarkdown(tracker), 'utf8');
    try {
      writeValidationEvidenceSnapshot({
        trackerPath: TRACKER_PATH,
        outputPath: VALIDATION_EVIDENCE_PATH,
      });
      validationEvidenceSyncMessage = `- public evidence synced: ${path.relative(
        process.cwd(),
        VALIDATION_EVIDENCE_PATH
      )}`;
    } catch (error) {
      let staleSnapshotRemoved = false;
      if (fs.existsSync(VALIDATION_EVIDENCE_PATH)) {
        try {
          fs.rmSync(VALIDATION_EVIDENCE_PATH, { force: true });
          staleSnapshotRemoved = !fs.existsSync(VALIDATION_EVIDENCE_PATH);
        } catch {}
      }
      validationEvidenceSyncMessage = `- public evidence skipped: ${
        error instanceof Error ? error.message : String(error)
      }${staleSnapshotRemoved ? ' (stale snapshot removed)' : ''}`;
    }
  }
  const summary = tracker.summary || {};
  const items = Object.values(tracker.items || {});
  const completed = items.filter((item) => item.status === 'completed');
  const pending = items.filter((item) => item.status === 'pending');
  const deferred = items.filter((item) => item.status === 'deferred');
  const wontFix = items.filter((item) => item.status === 'wont-fix');
  const recentRuns = (tracker.runs || []).slice(-5).reverse();
  const experts = Object.values(tracker.experts || {});
  const openExpertGaps = experts.filter((expert) => expert.lastImprovementNeeded);
  const latestRun = tracker.runs?.[tracker.runs.length - 1] || null;
  const latestUsageChecks = latestRun?.usageChecks || [];
  const latestLinks = latestRun?.links || [];
  const latestArtifacts = latestRun?.artifacts || [];

  console.log('QA Tracker Summary');
  console.log(`- total runs: ${summary.totalRuns || 0}`);
  console.log(`- total checks: ${summary.totalChecks || 0}`);
  console.log(`- passed/failed: ${summary.totalPassed || 0}/${summary.totalFailed || 0}`);
  console.log(
    `- completed/pending/deferred/wont-fix items: ${completed.length}/${pending.length}/${deferred.length}/${wontFix.length} (${summary.completionRate || 0}%)`
  );
  console.log(
    `- expert domains tracked/open-gaps: ${experts.length}/${openExpertGaps.length}`
  );
  console.log(`- last run: ${summary.lastRunId || '-'} @ ${summary.lastRecordedAt || '-'}`);
  if (latestRun) {
    console.log(
      `- latest scope/release-facing: ${latestRun.scope || 'legacy'}/${latestRun.releaseFacing ? 'yes' : 'no'}`
    );
    if (latestRun.environment?.deploymentId || latestRun.environment?.commitSha) {
      console.log(
        `- latest deployment: ${latestRun.environment?.deploymentId || '-'} / ${latestRun.environment?.commitSha || '-'}`
      );
    }
    if (Array.isArray(latestRun.coveragePacks) && latestRun.coveragePacks.length > 0) {
      console.log(`- latest coverage packs: ${latestRun.coveragePacks.join(', ')}`);
    }
    if (latestLinks.length > 0) {
      const linkTypes = Array.from(new Set(latestLinks.map((item) => item.type || 'general')));
      console.log(`- latest links: ${latestLinks.length} (${linkTypes.join(', ')})`);
    }
    if (latestArtifacts.length > 0) {
      const artifactTypes = Array.from(new Set(latestArtifacts.map((item) => item.type)));
      console.log(
        `- latest artifacts: ${latestArtifacts.length} (${artifactTypes.join(', ')})`
      );
    }
    console.log(
      `- latest covered/skipped surfaces: ${(latestRun.coveredSurfaces || []).length}/${(latestRun.skippedSurfaces || []).length}`
    );
  }
  const statusFileRelativePath = path.relative(process.cwd(), STATUS_PATH);
  if (shouldWrite) {
    console.log(`- dashboard synced: ${statusFileRelativePath}`);
    console.log(validationEvidenceSyncMessage);
  } else if (fs.existsSync(STATUS_PATH)) {
    console.log(`- dashboard file: ${statusFileRelativePath} (read-only)`);
  } else {
    console.log(`- dashboard file missing: ${statusFileRelativePath} (--write to sync)`);
  }

  if (latestUsageChecks.length > 0) {
    console.log('\nLatest Usage Checks');
    for (const usageCheck of latestUsageChecks) {
      console.log(
        `- ${usageCheck.platform}: ${usageCheck.status}/${usageCheck.result || 'unknown'} via ${usageCheck.method}${usageCheck.summary ? ` - ${usageCheck.summary}` : ''}`
      );
    }
  }

  if (pending.length > 0) {
    console.log('\nPending Improvements');
    for (const item of pending.sort((a, b) => a.id.localeCompare(b.id))) {
      console.log(
        `- [${item.priority || 'P2'}] ${item.id}: ${item.title} (last ${item.lastSeenRunId})`
      );
    }
  }

  if (deferred.length > 0) {
    console.log('\nDeferred Improvements');
    for (const item of deferred.sort((a, b) => {
      if (a.priority === b.priority) return a.id.localeCompare(b.id);
      return (a.priority || 'P2').localeCompare(b.priority || 'P2');
    })) {
      const policy = item.lastPolicyNote ? ` - ${item.lastPolicyNote}` : '';
      console.log(
        `- [${item.priority || 'P2'}] ${item.id}: ${item.title} (last ${item.lastSeenRunId})${policy}`
      );
    }
  }

  if (wontFix.length > 0) {
    console.log('\nWont-Fix Improvements');
    for (const item of wontFix.sort((a, b) => a.id.localeCompare(b.id))) {
      const policy = item.lastPolicyNote ? ` - ${item.lastPolicyNote}` : '';
      console.log(
        `- [${item.priority || 'P2'}] ${item.id}: ${item.title} (last ${item.lastSeenRunId})${policy}`
      );
    }
  }

  if (recentRuns.length > 0) {
    console.log('\nRecent Runs');
    for (const runRecord of recentRuns) {
      console.log(
        `- ${runRecord.runId}: ${runRecord.title} (scope ${runRecord.scope || 'legacy'}, checks ${runRecord.checks?.total ?? 0}, completed ${runRecord.completedCount ?? 0}, pending ${runRecord.pendingCount ?? 0}, wont-fix ${runRecord.wontFixCount ?? 0})`
      );
    }
  }

  if (openExpertGaps.length > 0) {
    console.log('\nExpert Domain Gaps');
    for (const expert of openExpertGaps.sort((a, b) => a.domainId.localeCompare(b.domainId))) {
      console.log(
        `- ${expert.domainId}: ${expert.domainName} (last ${expert.lastRunId})`
      );
      if (expert.lastNextAction) {
        console.log(`  next: ${expert.lastNextAction}`);
      }
    }
  }
}

try {
  run();
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
