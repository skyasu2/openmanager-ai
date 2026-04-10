function recalculateSummary(tracker) {
  tracker.runs = Array.isArray(tracker.runs) ? tracker.runs : [];
  tracker.items =
    tracker.items && typeof tracker.items === 'object' ? tracker.items : {};
  tracker.experts =
    tracker.experts && typeof tracker.experts === 'object' ? tracker.experts : {};

  const countedRuns = tracker.runs.filter((run) => run?.countsTowardSummary !== false);

  const totalRuns = countedRuns.length;
  const totalRecordedRuns = tracker.runs.length;
  const excludedRuns = Math.max(totalRecordedRuns - totalRuns, 0);
  const totalChecks = countedRuns.reduce(
    (sum, run) => sum + (run.checks?.total || 0),
    0
  );
  const totalPassed = countedRuns.reduce(
    (sum, run) => sum + (run.checks?.passed || 0),
    0
  );
  const totalFailed = countedRuns.reduce(
    (sum, run) => sum + (run.checks?.failed || 0),
    0
  );

  const itemList = Object.values(tracker.items);
  const completedItems = itemList.filter((item) => item.status === 'completed').length;
  const pendingItems = itemList.filter((item) => item.status === 'pending').length;
  const deferredItems = itemList.filter((item) => item.status === 'deferred').length;
  const wontFixItems = itemList.filter((item) => item.status === 'wont-fix').length;
  const completionRateBase = completedItems + pendingItems + deferredItems;
  const completionRate =
    completionRateBase === 0
      ? 0
      : Number(((completedItems / completionRateBase) * 100).toFixed(2));

  const expertList = Object.values(tracker.experts || {});
  const expertDomainsTracked = expertList.length;
  const expertDomainsOpenGaps = expertList.filter(
    (expert) => expert.lastImprovementNeeded
  ).length;

  const lastCountedRun = countedRuns[countedRuns.length - 1] || null;
  const latestRecordedRun = tracker.runs[tracker.runs.length - 1] || null;
  tracker.summary = {
    totalRecordedRuns,
    totalRuns,
    excludedRuns,
    totalChecks,
    totalPassed,
    totalFailed,
    completionRate,
    completedItems,
    pendingItems,
    deferredItems,
    wontFixItems,
    expertDomainsTracked,
    expertDomainsOpenGaps,
    lastRunId: lastCountedRun ? lastCountedRun.runId : null,
    lastRecordedAt: lastCountedRun ? lastCountedRun.recordedAt : null,
    latestRecordedRunId: latestRecordedRun ? latestRecordedRun.runId : null,
    latestRecordedAt: latestRecordedRun ? latestRecordedRun.recordedAt : null,
  };
}

function extractRunNumber(runId) {
  const match = String(runId || '').match(/-(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function repairTrackerDerivedFields(tracker) {
  tracker.meta = tracker.meta || {};
  tracker.sequence = tracker.sequence || {};
  tracker.runs = Array.isArray(tracker.runs) ? tracker.runs : [];
  tracker.items =
    tracker.items && typeof tracker.items === 'object' ? tracker.items : {};
  tracker.experts =
    tracker.experts && typeof tracker.experts === 'object' ? tracker.experts : {};

  const lastRun = tracker.runs[tracker.runs.length - 1] || null;
  const maxRunNumber = tracker.runs.reduce((max, run) => {
    return Math.max(max, extractRunNumber(run?.runId));
  }, 0);

  tracker.sequence.nextRunNumber = maxRunNumber > 0 ? maxRunNumber + 1 : 1;
  if (!tracker.meta.createdAt) {
    tracker.meta.createdAt = lastRun?.recordedAt || new Date().toISOString();
  }
  tracker.meta.updatedAt =
    lastRun?.recordedAt || tracker.meta.updatedAt || new Date().toISOString();

  recalculateSummary(tracker);
  return tracker;
}

module.exports = {
  recalculateSummary,
  repairTrackerDerivedFields,
};
