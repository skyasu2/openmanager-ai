#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const TRACKER_PATH = path.resolve(process.cwd(), 'reports/qa/qa-tracker.json');

function run() {
  if (!fs.existsSync(TRACKER_PATH)) {
    console.log('qa-tracker.json not found. Run `npm run qa:record` first.');
    process.exit(0);
  }

  const tracker = JSON.parse(fs.readFileSync(TRACKER_PATH, 'utf8'));
  const summary = tracker.summary || {};
  const items = Object.values(tracker.items || {});
  const completed = items.filter((item) => item.status === 'completed');
  const pending = items.filter((item) => item.status === 'pending');
  const deferred = items.filter((item) => item.status === 'deferred');
  const wontFix = items.filter((item) => item.status === 'wont-fix');
  const recentRuns = (tracker.runs || []).slice(-5).reverse();
  const experts = Object.values(tracker.experts || {});
  const openExpertGaps = experts.filter((expert) => expert.lastImprovementNeeded);

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
        `- ${runRecord.runId}: ${runRecord.title} (checks ${runRecord.checks.total}, completed ${runRecord.completedCount}, pending ${runRecord.pendingCount || 0}, wont-fix ${runRecord.wontFixCount || 0})`
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
