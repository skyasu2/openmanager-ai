function recalculateSummary(tracker) {
  tracker.runs = Array.isArray(tracker.runs) ? tracker.runs : [];
  tracker.items =
    tracker.items && typeof tracker.items === 'object' ? tracker.items : {};
  tracker.experts =
    tracker.experts && typeof tracker.experts === 'object' ? tracker.experts : {};

  const totalRuns = tracker.runs.length;
  const totalChecks = tracker.runs.reduce(
    (sum, run) => sum + (run.checks?.total || 0),
    0
  );
  const totalPassed = tracker.runs.reduce(
    (sum, run) => sum + (run.checks?.passed || 0),
    0
  );
  const totalFailed = tracker.runs.reduce(
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

  const lastRun = tracker.runs[tracker.runs.length - 1] || null;
  tracker.summary = {
    totalRuns,
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
    lastRunId: lastRun ? lastRun.runId : null,
    lastRecordedAt: lastRun ? lastRun.recordedAt : null,
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
