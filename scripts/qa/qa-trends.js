#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { repairTrackerDerivedFields } = require('./qa-tracker-utils');
const { nowInSeoulText, toSeoulParts } = require('./qa-time-utils');

const TRACKER_PATH = path.resolve(process.cwd(), 'reports/qa/qa-tracker.json');
const TRENDS_MARKDOWN_PATH = path.resolve(process.cwd(), 'reports/qa/QA_TRENDS.md');
const TRENDS_JSON_PATH = path.resolve(
  process.cwd(),
  'reports/qa/latest-qa-trends.json'
);

function safeNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function percentage(numerator, denominator) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function cloneTrackerForRepair(tracker) {
  return {
    ...(tracker || {}),
    summary:
      tracker?.summary && typeof tracker.summary === 'object'
        ? { ...tracker.summary }
        : tracker?.summary,
    meta:
      tracker?.meta && typeof tracker.meta === 'object'
        ? { ...tracker.meta }
        : tracker?.meta,
    sequence:
      tracker?.sequence && typeof tracker.sequence === 'object'
        ? { ...tracker.sequence }
        : tracker?.sequence,
    runs: Array.isArray(tracker?.runs) ? [...tracker.runs] : tracker?.runs,
    items:
      tracker?.items && typeof tracker.items === 'object'
        ? { ...tracker.items }
        : tracker?.items,
    experts:
      tracker?.experts && typeof tracker.experts === 'object'
        ? { ...tracker.experts }
        : tracker?.experts,
  };
}

function isCountedRun(run) {
  return run?.countsTowardSummary !== false;
}

function getRunChecks(run) {
  return {
    total: safeNumber(run?.checks?.total),
    passed: safeNumber(run?.checks?.passed),
    failed: safeNumber(run?.checks?.failed),
  };
}

function getRunPendingCount(run) {
  return safeNumber(run?.pendingCount);
}

function getRunDeferredCount(run) {
  return safeNumber(run?.deferredCount);
}

function getRunWontFixCount(run) {
  return safeNumber(run?.wontFixCount);
}

function hasActionableRegression(run) {
  return getRunChecks(run).failed > 0 || getRunPendingCount(run) > 0;
}

function kstDateKey(dateString) {
  const date = new Date(dateString || '');
  if (Number.isNaN(date.getTime())) {
    return 'unknown';
  }
  const parts = toSeoulParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function summarizeRuns(runs) {
  const countedRuns = runs.filter(isCountedRun);
  const totalChecks = countedRuns.reduce(
    (sum, run) => sum + getRunChecks(run).total,
    0
  );
  const totalPassed = countedRuns.reduce(
    (sum, run) => sum + getRunChecks(run).passed,
    0
  );
  const totalFailed = countedRuns.reduce(
    (sum, run) => sum + getRunChecks(run).failed,
    0
  );
  const failingRunCount = countedRuns.filter((run) => getRunChecks(run).failed > 0).length;
  const regressionRunCount = countedRuns.filter(hasActionableRegression).length;
  const pendingRunCount = countedRuns.filter((run) => getRunPendingCount(run) > 0).length;
  const releaseFacingRuns = countedRuns.filter((run) => run?.releaseFacing === true).length;

  return {
    recordedRuns: runs.length,
    countedRuns: countedRuns.length,
    totalChecks,
    totalPassed,
    totalFailed,
    passRatePct: percentage(totalPassed, totalChecks),
    failingRunCount,
    failingRunRatePct: percentage(failingRunCount, countedRuns.length),
    regressionRunCount,
    regressionRunRatePct: percentage(regressionRunCount, countedRuns.length),
    pendingRunCount,
    releaseFacingRuns,
  };
}

function buildWindowSummaries(runs) {
  const countedRuns = runs.filter(isCountedRun);

  return [
    {
      label: 'All Counted Runs',
      ...summarizeRuns(countedRuns),
    },
    {
      label: 'Last 30 Counted Runs',
      ...summarizeRuns(countedRuns.slice(-30)),
    },
    {
      label: 'Last 10 Counted Runs',
      ...summarizeRuns(countedRuns.slice(-10)),
    },
  ];
}

function buildScopeDistribution(runs) {
  const buckets = new Map();
  for (const run of runs) {
    const scope = run?.scope || 'legacy';
    const current = buckets.get(scope) || { scope, totalRuns: 0, countedRuns: 0 };
    current.totalRuns += 1;
    if (isCountedRun(run)) {
      current.countedRuns += 1;
    }
    buckets.set(scope, current);
  }

  return [...buckets.values()].sort((a, b) => {
    if (b.totalRuns === a.totalRuns) return a.scope.localeCompare(b.scope);
    return b.totalRuns - a.totalRuns;
  });
}

function buildRecentDailyTrend(runs, limit = 14) {
  const countedRuns = runs.filter(isCountedRun);
  const buckets = new Map();

  for (const run of countedRuns) {
    const dateKey = kstDateKey(run?.recordedAt);
    const current =
      buckets.get(dateKey) || {
        date: dateKey,
        runCount: 0,
        totalChecks: 0,
        totalPassed: 0,
        totalFailed: 0,
        failingRuns: 0,
        regressionRuns: 0,
      };
    const checks = getRunChecks(run);
    current.runCount += 1;
    current.totalChecks += checks.total;
    current.totalPassed += checks.passed;
    current.totalFailed += checks.failed;
    if (checks.failed > 0) current.failingRuns += 1;
    if (hasActionableRegression(run)) current.regressionRuns += 1;
    buckets.set(dateKey, current);
  }

  return [...buckets.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-limit)
    .map((bucket) => ({
      ...bucket,
      passRatePct: percentage(bucket.totalPassed, bucket.totalChecks),
      regressionRunRatePct: percentage(bucket.regressionRuns, bucket.runCount),
    }));
}

function buildRecentRegressionRuns(runs, limit = 10) {
  return [...runs]
    .filter((run) => isCountedRun(run) && hasActionableRegression(run))
    .slice(-limit)
    .reverse()
    .map((run) => {
      const checks = getRunChecks(run);
      return {
        runId: run?.runId || '-',
        recordedAt: run?.recordedAt || null,
        scope: run?.scope || 'legacy',
        title: run?.title || run?.runId || '-',
        failedChecks: checks.failed,
        pendingCount: getRunPendingCount(run),
        deferredCount: getRunDeferredCount(run),
        wontFixCount: getRunWontFixCount(run),
      };
    });
}

function buildRecurringItems(trackerItems, {
  openLimit = 10,
  completedLimit = 10,
} = {}) {
  const entries = Object.entries(trackerItems || {}).map(([id, item]) => ({
    id,
    title: item?.title || id,
    status: item?.status || 'pending',
    priority: item?.priority || 'P2',
    seenCount: safeNumber(item?.seenCount),
    completedCount: safeNumber(item?.completedCount),
    lastSeenRunId: item?.lastSeenRunId || null,
    lastResolvedRunId: item?.lastResolvedRunId || null,
  }));

  const sortByImpact = (a, b) => {
    if (b.seenCount === a.seenCount) {
      if (a.priority === b.priority) return a.id.localeCompare(b.id);
      return a.priority.localeCompare(b.priority);
    }
    return b.seenCount - a.seenCount;
  };

  return {
    open: entries
      .filter((item) => item.status === 'pending' || item.status === 'deferred')
      .sort(sortByImpact)
      .slice(0, openLimit),
    wontFix: entries
      .filter((item) => item.status === 'wont-fix')
      .sort(sortByImpact)
      .slice(0, openLimit),
    completed: entries
      .filter((item) => item.status === 'completed')
      .sort((a, b) => {
        if (b.completedCount === a.completedCount) {
          if (b.seenCount === a.seenCount) return a.id.localeCompare(b.id);
          return b.seenCount - a.seenCount;
        }
        return b.completedCount - a.completedCount;
      })
      .slice(0, completedLimit),
  };
}

function buildQaTrendSnapshot(tracker) {
  const normalizedTracker = repairTrackerDerivedFields(
    cloneTrackerForRepair(tracker)
  );
  const runs = Array.isArray(normalizedTracker.runs) ? normalizedTracker.runs : [];
  const countedRuns = runs.filter(isCountedRun);
  const latestRecordedRun = runs[runs.length - 1] || null;
  const latestCountedRun = countedRuns[countedRuns.length - 1] || null;

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    generatedAtKst: nowInSeoulText(new Date()),
    trackerUpdatedAt: normalizedTracker.summary?.latestRecordedAt || null,
    totals: {
      recordedRuns: runs.length,
      countedRuns: countedRuns.length,
      totalChecks: normalizedTracker.summary?.totalChecks || 0,
      totalPassed: normalizedTracker.summary?.totalPassed || 0,
      totalFailed: normalizedTracker.summary?.totalFailed || 0,
      overallPassRatePct: percentage(
        normalizedTracker.summary?.totalPassed || 0,
        normalizedTracker.summary?.totalChecks || 0
      ),
      latestRecordedRunId: latestRecordedRun?.runId || null,
      lastCountedRunId: latestCountedRun?.runId || null,
    },
    windows: buildWindowSummaries(runs),
    scopeDistribution: buildScopeDistribution(runs),
    recentDailyTrend: buildRecentDailyTrend(runs),
    recentRegressionRuns: buildRecentRegressionRuns(runs),
    recurringItems: buildRecurringItems(normalizedTracker.items),
  };
}

function qaTrendsMarkdown(snapshot) {
  const lines = [];

  lines.push('# QA Trends Dashboard');
  lines.push('');
  lines.push('> Auto-generated file. Source: `reports/qa/qa-tracker.json`.');
  lines.push(`> Generated at: ${snapshot.generatedAtKst}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|---|---:|');
  lines.push(`| Recorded Runs | ${snapshot.totals.recordedRuns} |`);
  lines.push(`| Counted Runs | ${snapshot.totals.countedRuns} |`);
  lines.push(`| Total Checks | ${snapshot.totals.totalChecks} |`);
  lines.push(`| Total Passed | ${snapshot.totals.totalPassed} |`);
  lines.push(`| Total Failed | ${snapshot.totals.totalFailed} |`);
  lines.push(`| Overall Pass Rate | ${snapshot.totals.overallPassRatePct}% |`);
  lines.push(
    `| Latest Recorded Run | ${snapshot.totals.latestRecordedRunId || '-'} |`
  );
  lines.push(`| Last Counted Run | ${snapshot.totals.lastCountedRunId || '-'} |`);
  lines.push('');
  lines.push('## Rolling Windows');
  lines.push('');
  lines.push('| Window | Counted Runs | Checks | Pass Rate | Failed Runs | Failing Run Rate | Regression Runs | Regression Run Rate |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const window of snapshot.windows) {
    lines.push(
      `| ${window.label} | ${window.countedRuns} | ${window.totalChecks} | ${window.passRatePct}% | ${window.failingRunCount} | ${window.failingRunRatePct}% | ${window.regressionRunCount} | ${window.regressionRunRatePct}% |`
    );
  }
  lines.push('');
  lines.push('## Scope Distribution');
  lines.push('');
  lines.push('| Scope | Recorded Runs | Counted Runs |');
  lines.push('|---|---:|---:|');
  for (const scope of snapshot.scopeDistribution) {
    lines.push(
      `| ${scope.scope} | ${scope.totalRuns} | ${scope.countedRuns} |`
    );
  }
  lines.push('');
  lines.push('## Recent Daily Trend (KST)');
  lines.push('');
  lines.push('| Date | Runs | Checks | Pass Rate | Failed Runs | Regression Runs | Regression Run Rate |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|');
  if (snapshot.recentDailyTrend.length === 0) {
    lines.push('| - | 0 | 0 | 0% | 0 | 0 | 0% |');
  } else {
    for (const day of snapshot.recentDailyTrend) {
      lines.push(
        `| ${day.date} | ${day.runCount} | ${day.totalChecks} | ${day.passRatePct}% | ${day.failingRuns} | ${day.regressionRuns} | ${day.regressionRunRatePct}% |`
      );
    }
  }
  lines.push('');
  lines.push('## Recent Regression Runs');
  lines.push('');
  lines.push('| Run ID | Time (UTC) | Scope | Failed Checks | Pending | Deferred | Wont-Fix | Title |');
  lines.push('|---|---|---|---:|---:|---:|---:|---|');
  if (snapshot.recentRegressionRuns.length === 0) {
    lines.push('| - | - | - | 0 | 0 | 0 | 0 | - |');
  } else {
    for (const run of snapshot.recentRegressionRuns) {
      lines.push(
        `| ${run.runId} | ${run.recordedAt || '-'} | ${run.scope} | ${run.failedChecks} | ${run.pendingCount} | ${run.deferredCount} | ${run.wontFixCount} | ${run.title} |`
      );
    }
  }
  lines.push('');
  lines.push('## Recurring Open Items');
  lines.push('');
  lines.push('| ID | Priority | Status | Seen | Last Seen Run | Title |');
  lines.push('|---|---|---|---:|---|---|');
  const openItems = [...snapshot.recurringItems.open, ...snapshot.recurringItems.wontFix];
  if (openItems.length === 0) {
    lines.push('| - | - | - | 0 | - | - |');
  } else {
    for (const item of openItems) {
      lines.push(
        `| ${item.id} | ${item.priority} | ${item.status} | ${item.seenCount} | ${item.lastSeenRunId || '-'} | ${item.title} |`
      );
    }
  }
  lines.push('');
  lines.push('## Most Repeated Completed Items');
  lines.push('');
  lines.push('| ID | Completed Count | Seen | Last Seen Run | Title |');
  lines.push('|---|---:|---:|---|---|');
  if (snapshot.recurringItems.completed.length === 0) {
    lines.push('| - | 0 | 0 | - | - |');
  } else {
    for (const item of snapshot.recurringItems.completed) {
      lines.push(
        `| ${item.id} | ${item.completedCount} | ${item.seenCount} | ${item.lastSeenRunId || '-'} | ${item.title} |`
      );
    }
  }
  lines.push('');
  lines.push('## Definitions');
  lines.push('');
  lines.push('- Counted Run: `countsTowardSummary !== false` 인 run.');
  lines.push('- Failing Run: `checks.failed > 0` 인 counted run.');
  lines.push('- Regression Run: `checks.failed > 0` 또는 `pendingCount > 0` 인 counted run.');
  lines.push('- Deferred / Wont-Fix 는 추세에서 별도 표기하되 regression rate 계산에는 포함하지 않는다.');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function writeQaTrendArtifacts({
  trackerPath = TRACKER_PATH,
  markdownPath = TRENDS_MARKDOWN_PATH,
  jsonPath = TRENDS_JSON_PATH,
} = {}) {
  const tracker = JSON.parse(fs.readFileSync(trackerPath, 'utf8'));
  const snapshot = buildQaTrendSnapshot(tracker);

  fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(markdownPath, qaTrendsMarkdown(snapshot), 'utf8');
  fs.writeFileSync(jsonPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

  return {
    snapshot,
    markdownPath,
    jsonPath,
  };
}

module.exports = {
  TRACKER_PATH,
  TRENDS_JSON_PATH,
  TRENDS_MARKDOWN_PATH,
  buildQaTrendSnapshot,
  buildRecentDailyTrend,
  buildRecentRegressionRuns,
  buildRecurringItems,
  buildScopeDistribution,
  buildWindowSummaries,
  cloneTrackerForRepair,
  getRunChecks,
  hasActionableRegression,
  isCountedRun,
  kstDateKey,
  percentage,
  qaTrendsMarkdown,
  summarizeRuns,
  writeQaTrendArtifacts,
};
