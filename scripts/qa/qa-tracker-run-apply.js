const { recalculateSummary } = require('./qa-tracker-utils');

function upsertTrackerItem({
  tracker,
  runId,
  recordedAt,
  normalizedItem,
  status,
}) {
  const existing = tracker.items[normalizedItem.id];
  const next = existing
    ? { ...existing }
    : {
        id: normalizedItem.id,
        title: normalizedItem.title,
        priority: normalizedItem.priority,
        status,
        firstSeenRunId: runId,
        firstSeenAt: recordedAt,
        lastSeenRunId: runId,
        lastSeenAt: recordedAt,
        seenCount: 0,
        completedCount: 0,
        pendingCount: 0,
        deferredCount: 0,
        wontFixCount: 0,
        aliases: [],
        owner: normalizedItem.owner || '',
        lastEvidence: '',
        lastNote: '',
        isBlocking: false,
        isBlockingExplicit: false,
        overengineeringScope: '',
        lastPolicyNote: '',
      };

  if (!next.aliases) next.aliases = [];
  if (!next.deferredCount) next.deferredCount = 0;

  if (normalizedItem.originalId && !next.aliases.includes(normalizedItem.originalId)) {
    next.aliases.push(normalizedItem.originalId);
  }

  next.title = normalizedItem.title;
  next.priority = normalizedItem.priority || next.priority || 'P2';
  if (normalizedItem.owner) next.owner = normalizedItem.owner;
  next.lastSeenRunId = runId;
  next.lastSeenAt = recordedAt;
  next.seenCount += 1;
  next.status = status;
  if (status === 'completed') next.completedCount += 1;
  if (status === 'pending') next.pendingCount += 1;
  if (status === 'deferred') next.deferredCount += 1;
  if (status === 'wont-fix') next.wontFixCount += 1;
  if (normalizedItem.evidence) next.lastEvidence = normalizedItem.evidence;
  if (normalizedItem.note) next.lastNote = normalizedItem.note;
  next.isBlocking =
    normalizedItem.isBlocking === true
      ? true
      : normalizedItem.isBlocking === false
        ? false
        : next.isBlocking || false;
  next.isBlockingExplicit = normalizedItem.isBlockingExplicit === true;
  if (normalizedItem.overengineeringScope) {
    next.overengineeringScope = normalizedItem.overengineeringScope;
  }
  next.lastPolicyNote = normalizedItem.policyNote || '';
  next.lastStatusChangeAt = recordedAt;

  tracker.items[normalizedItem.id] = next;
}

function upsertTrackerExpert({
  tracker,
  runId,
  recordedAt,
  assessment,
}) {
  const existing = tracker.experts[assessment.domainId];
  const next = existing
    ? { ...existing }
    : {
        domainId: assessment.domainId,
        domainName: assessment.domainName,
        firstSeenRunId: runId,
        firstSeenAt: recordedAt,
        seenCount: 0,
        appropriateCount: 0,
        partialCount: 0,
        inappropriateCount: 0,
        improvementNeededCount: 0,
      };

  next.domainName = assessment.domainName;
  next.seenCount += 1;
  next.lastRunId = runId;
  next.lastSeenAt = recordedAt;
  next.lastFit = assessment.fit;
  next.lastImprovementNeeded = assessment.improvementNeeded;
  next.lastRationale = assessment.rationale;
  next.lastNextAction = assessment.nextAction;

  if (assessment.fit === 'appropriate') next.appropriateCount += 1;
  if (assessment.fit === 'partially-appropriate') next.partialCount += 1;
  if (assessment.fit === 'inappropriate') next.inappropriateCount += 1;
  if (assessment.improvementNeeded) next.improvementNeededCount += 1;

  tracker.experts[assessment.domainId] = next;
}

function applyRunToTracker({
  tracker,
  runId,
  runNumber,
  recordedAt,
  recordedAtKst,
  runTitle,
  owner,
  runRecord,
  runFileRelative,
  environment,
  scope,
  releaseFacing,
  coveragePacks,
  coveredSurfaces,
  skippedSurfaces,
  expertAssessments,
  usageChecks,
  artifacts,
  links,
  finalCompletedImprovements,
  finalPendingImprovements,
  finalDeferredImprovements,
  finalWontFixImprovements,
}) {
  for (const completedItem of finalCompletedImprovements) {
    upsertTrackerItem({
      tracker,
      runId,
      recordedAt,
      normalizedItem: completedItem,
      status: 'completed',
    });
  }
  for (const pendingItem of finalPendingImprovements) {
    upsertTrackerItem({
      tracker,
      runId,
      recordedAt,
      normalizedItem: pendingItem,
      status: 'pending',
    });
  }
  for (const deferredItem of finalDeferredImprovements) {
    upsertTrackerItem({
      tracker,
      runId,
      recordedAt,
      normalizedItem: deferredItem,
      status: 'deferred',
    });
  }
  for (const wontFixItem of finalWontFixImprovements) {
    upsertTrackerItem({
      tracker,
      runId,
      recordedAt,
      normalizedItem: wontFixItem,
      status: 'wont-fix',
    });
  }
  for (const expertAssessment of expertAssessments) {
    upsertTrackerExpert({
      tracker,
      runId,
      recordedAt,
      assessment: expertAssessment,
    });
  }

  const expertNeedsImprovementCount = expertAssessments.filter(
    (entry) => entry.improvementNeeded
  ).length;

  tracker.runs.push({
    runId,
    recordedAt,
    recordedAtKst,
    title: runTitle,
    owner,
    source: runRecord.source,
    file: runFileRelative,
    environment,
    scope,
    releaseFacing,
    coveragePacks,
    coveredSurfaces,
    skippedSurfaces,
    checks: runRecord.checks,
    expertAssessments,
    usageChecks,
    artifacts,
    links,
    expertCount: expertAssessments.length,
    expertNeedsImprovementCount,
    completedCount: finalCompletedImprovements.length,
    pendingCount: finalPendingImprovements.length,
    deferredCount: finalDeferredImprovements.length,
    wontFixCount: finalWontFixImprovements.length,
  });
  tracker.sequence.nextRunNumber = runNumber + 1;
  tracker.meta.updatedAt = recordedAt;
  if (!tracker.meta.createdAt) tracker.meta.createdAt = recordedAt;
  recalculateSummary(tracker);

  return tracker;
}

module.exports = {
  applyRunToTracker,
};
