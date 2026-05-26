const { nowInSeoulText } = require('./qa-time-utils');
const { buildQaTrendSnapshot } = require('./qa-trends');
const {
  formatWontFixCategorySummary,
  groupWontFixItemsByCategory,
  groupWontFixItemsByReviewClass,
} = require('./qa-wont-fix-classification');

function formatLatencyValue(value) {
  return value != null ? `${value}ms` : '-';
}

function pushWarningSection(lines, title, warnings) {
  lines.push(`## ${title}`);
  lines.push('');
  if (!Array.isArray(warnings) || warnings.length === 0) {
    lines.push('- None');
  } else {
    for (const warning of warnings) {
      lines.push(
        `- [${warning.severity}] ${warning.code}: ${warning.headline}. ${warning.detail} Next: ${warning.recommendedAction}`
      );
    }
  }
  lines.push('');
}

function statusMarkdown(tracker) {
  const lines = [];
  const generatedAt = nowInSeoulText(new Date());
  const trendSnapshot = buildQaTrendSnapshot(tracker);
  const aiLatencyRollup = trendSnapshot.aiLatencyRollup24h || {
    windowHours: 24,
    windowStart: null,
    windowEnd: null,
    recordedRunCount: 0,
    countedRunCount: 0,
    sampleCount: 0,
    buckets: [],
  };
  const plannerShadowRollup = trendSnapshot.plannerShadowRollup24h || {
    windowHours: 24,
    windowStart: null,
    windowEnd: null,
    recordedRunCount: 0,
    countedRunCount: 0,
    sampleCount: 0,
    driftCount: 0,
    driftRatePct: 0,
    avgLatencyMs: null,
    p95LatencyMs: null,
    classificationCounts: {},
    reasonCodeCounts: {},
    buckets: [],
  };
  const itemList = Object.values(tracker.items);
  const completed = itemList
    .filter((item) => item.status === 'completed')
    .sort((a, b) => a.id.localeCompare(b.id));
  const pending = itemList
    .filter((item) => item.status === 'pending')
    .sort((a, b) => {
      if (a.priority === b.priority) return a.id.localeCompare(b.id);
      return a.priority.localeCompare(b.priority);
    });
  const deferred = itemList
    .filter((item) => item.status === 'deferred')
    .sort((a, b) => {
      if (a.priority === b.priority) return a.id.localeCompare(b.id);
      return a.priority.localeCompare(b.priority);
    });
  const wontFix = itemList
    .filter((item) => item.status === 'wont-fix')
    .sort((a, b) => {
      if (a.priority === b.priority) return a.id.localeCompare(b.id);
      return a.priority.localeCompare(b.priority);
    });
  const recentRuns = tracker.runs.slice(-20).reverse();
  const expertList = Object.values(tracker.experts || {}).sort((a, b) =>
    a.domainId.localeCompare(b.domainId)
  );
  const latestRun = tracker.runs[tracker.runs.length - 1] || null;
  const latestRunExperts = latestRun?.expertAssessments || [];
  const latestRunUsageChecks = latestRun?.usageChecks || [];
  const latestRunScope = latestRun?.scope || 'legacy';
  const latestRunReleaseFacing = latestRun?.releaseFacing === true;
  const latestRunCoveragePacks = latestRun?.coveragePacks || [];
  const latestRunCoveredSurfaces = latestRun?.coveredSurfaces || [];
  const latestRunSkippedSurfaces = latestRun?.skippedSurfaces || [];
  const latestRunLinks = latestRun?.links || [];
  const latestRunArtifacts = latestRun?.artifacts || [];
  const latestRunEnvironment =
    latestRun && typeof latestRun.environment === 'object' ? latestRun.environment : {};
  const totalRecordedRuns = tracker.summary.totalRecordedRuns ?? tracker.runs.length;
  const totalCountedRuns = tracker.summary.totalRuns ?? 0;
  const excludedRuns = tracker.summary.excludedRuns ?? Math.max(totalRecordedRuns - totalCountedRuns, 0);

  lines.push('# QA Status Dashboard');
  lines.push('');
  lines.push('> Auto-generated file. Edit `qa-tracker.json` or use `npm run qa:record`.');
  lines.push(`> Generated at: ${generatedAt}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|---|---:|');
  lines.push(`| Total Recorded Runs | ${totalRecordedRuns} |`);
  lines.push(`| Total Runs (Counted) | ${totalCountedRuns} |`);
  lines.push(`| Non-counted Runs | ${excludedRuns} |`);
  lines.push(`| Total Checks | ${tracker.summary.totalChecks} |`);
  lines.push(`| Passed | ${tracker.summary.totalPassed} |`);
  lines.push(`| Failed | ${tracker.summary.totalFailed} |`);
  lines.push(`| Completed Items | ${tracker.summary.completedItems} |`);
  lines.push(`| Pending Items | ${tracker.summary.pendingItems} |`);
  lines.push(`| Deferred Items | ${tracker.summary.deferredItems || deferred.length} |`);
  lines.push(`| Wont-Fix Items | ${tracker.summary.wontFixItems || wontFix.length} |`);
  lines.push(`| Expert Domains Tracked | ${tracker.summary.expertDomainsTracked || 0} |`);
  lines.push(`| Expert Open Gaps | ${tracker.summary.expertDomainsOpenGaps || 0} |`);
  lines.push(`| Completion Rate | ${tracker.summary.completionRate}% |`);
  lines.push(
    `| Last Counted Run | ${tracker.summary.lastRunId || '-'} (${tracker.summary.lastRecordedAt || '-'}) |`
  );
  lines.push(
    `| Latest Recorded Run | ${tracker.summary.latestRecordedRunId || '-'} (${tracker.summary.latestRecordedAt || '-'}) |`
  );
  lines.push('| Summary Rule | `countsTowardSummary !== false` 인 run만 Counted 집계에 반영 |');
  lines.push('');
  pushWarningSection(
    lines,
    'Active Gate Warnings',
    trendSnapshot.activeGateWarnings || []
  );
  pushWarningSection(
    lines,
    'Historical Trend Warnings',
    trendSnapshot.historicalTrendWarnings || []
  );
  lines.push('## Expert Domain Assessment (Latest Run)');
  lines.push('');
  lines.push(
    `Latest run: ${latestRun ? `${latestRun.runId} (${latestRun.recordedAt})` : '-'}`
  );
  lines.push('');
  lines.push('| Domain | Fit | Improvement Needed | Next Action |');
  lines.push('|---|---|---|---|');
  if (latestRunExperts.length === 0) {
    lines.push('| - | - | - | - |');
  } else {
    for (const expert of latestRunExperts) {
      lines.push(
        `| ${expert.domainName} | ${expert.fit} | ${expert.improvementNeeded ? 'yes' : 'no'} | ${expert.nextAction || '-'} |`
      );
    }
  }
  lines.push('');
  lines.push('## Usage Checks (Latest Run)');
  lines.push('');
  lines.push('| Platform | Method | Collection | Result | Summary |');
  lines.push('|---|---|---|---|---|');
  if (latestRunUsageChecks.length === 0) {
    lines.push('| - | - | - | - | - |');
  } else {
    for (const usageCheck of latestRunUsageChecks) {
      lines.push(
        `| ${usageCheck.platform} | ${usageCheck.method} | ${usageCheck.status} | ${usageCheck.result || 'unknown'} | ${usageCheck.summary || '-'} |`
      );
    }
  }
  lines.push('');
  lines.push('## AI Latency Rollup (Last 24h)');
  lines.push('');
  if (aiLatencyRollup.windowStart && aiLatencyRollup.windowEnd) {
    lines.push(
      `- Window: ${aiLatencyRollup.windowStart} -> ${aiLatencyRollup.windowEnd} (${aiLatencyRollup.windowHours}h)`
    );
  }
  lines.push(
    `- Runs with observations: ${aiLatencyRollup.recordedRunCount} recorded / ${aiLatencyRollup.countedRunCount} counted`
  );
  lines.push(`- Samples: ${aiLatencyRollup.sampleCount}`);
  lines.push('');
  lines.push('| Agent | Provider | Samples | Avg Latency | P95 Latency | Avg TTFB | P95 TTFB | Avg Processing | P95 Processing | Latest Run |');
  lines.push('|---|---|---:|---:|---:|---:|---:|---:|---:|---|');
  if (aiLatencyRollup.buckets.length === 0) {
    lines.push('| - | - | 0 | - | - | - | - | - | - | - |');
  } else {
    for (const bucket of aiLatencyRollup.buckets) {
      lines.push(
        `| ${bucket.agent} | ${bucket.provider} | ${bucket.sampleCount} | ${formatLatencyValue(bucket.avgLatencyMs)} | ${formatLatencyValue(bucket.p95LatencyMs)} | ${formatLatencyValue(bucket.avgTtfbMs)} | ${formatLatencyValue(bucket.p95TtfbMs)} | ${formatLatencyValue(bucket.avgProcessingTimeMs)} | ${formatLatencyValue(bucket.p95ProcessingTimeMs)} | ${bucket.latestRunId || '-'} |`
      );
    }
  }
  lines.push('');
  lines.push('## Planner Shadow Rollup (Last 24h)');
  lines.push('');
  if (plannerShadowRollup.windowStart && plannerShadowRollup.windowEnd) {
    lines.push(
      `- Window: ${plannerShadowRollup.windowStart} -> ${plannerShadowRollup.windowEnd} (${plannerShadowRollup.windowHours}h)`
    );
  }
  lines.push(
    `- Runs with observations: ${plannerShadowRollup.recordedRunCount} recorded / ${plannerShadowRollup.countedRunCount} counted`
  );
  lines.push(`- Samples: ${plannerShadowRollup.sampleCount}`);
  lines.push(`- Drift rate: ${plannerShadowRollup.driftRatePct}%`);
  lines.push('');
  lines.push('| Route | Execution Mode | Samples | Drift Rate | Avg Latency | P95 Latency | Latest Run |');
  lines.push('|---|---|---:|---:|---:|---:|---|');
  if (plannerShadowRollup.buckets.length === 0) {
    lines.push('| - | - | 0 | 0% | - | - | - |');
  } else {
    for (const bucket of plannerShadowRollup.buckets) {
      lines.push(
        `| ${bucket.route} | ${bucket.executionMode} | ${bucket.sampleCount} | ${bucket.driftRatePct}% | ${formatLatencyValue(bucket.avgLatencyMs)} | ${formatLatencyValue(bucket.p95LatencyMs)} | ${bucket.latestRunId || '-'} |`
      );
    }
  }
  lines.push('');
  lines.push('## Coverage (Latest Run)');
  lines.push('');
  lines.push(`- Scope: ${latestRunScope}`);
  lines.push(`- Release-Facing: ${latestRunReleaseFacing ? 'yes' : 'no'}`);
  lines.push(`- Counts Toward Summary: ${latestRun?.countsTowardSummary === false ? 'no' : 'yes'}`);
  if (latestRunEnvironment.deploymentId || latestRunEnvironment.commitSha) {
    const deploymentParts = [];
    if (latestRunEnvironment.deploymentId) {
      deploymentParts.push(latestRunEnvironment.deploymentId);
    }
    if (latestRunEnvironment.commitSha) {
      deploymentParts.push(`SHA ${latestRunEnvironment.commitSha.slice(0, 8)}`);
    }
    lines.push(`- Deployment: ${deploymentParts.join(' / ')}`);
  }
  if (latestRunCoveragePacks.length > 0) {
    lines.push(`- Coverage Packs: ${latestRunCoveragePacks.join(', ')}`);
  }
  lines.push(
    `- Covered Surfaces: ${latestRunCoveredSurfaces.length > 0 ? latestRunCoveredSurfaces.join(', ') : '-'}`
  );
  lines.push(
    `- Skipped Surfaces: ${latestRunSkippedSurfaces.length > 0 ? latestRunSkippedSurfaces.join(', ') : '-'}`
  );
  lines.push('');
  lines.push('## Links (Latest Run)');
  lines.push('');
  lines.push('| Type | Label | URL | Note |');
  lines.push('|---|---|---|---|');
  if (latestRunLinks.length === 0) {
    lines.push('| - | - | - | - |');
  } else {
    for (const link of latestRunLinks) {
      const linkText = link.label || link.type || 'external link';
      lines.push(
        `| ${link.type || 'general'} | ${link.label || '-'} | [${linkText}](${link.url}) | ${link.note || '-'} |`
      );
    }
  }
  lines.push('');
  lines.push('## Artifacts (Latest Run)');
  lines.push('');
  lines.push('| Type | Label | Location | Viewer |');
  lines.push('|---|---|---|---|');
  if (latestRunArtifacts.length === 0) {
    lines.push('| - | - | - | - |');
  } else {
    for (const artifact of latestRunArtifacts) {
      const location = artifact.url
        ? `[${artifact.label || artifact.type || 'artifact'}](${artifact.url})`
        : artifact.path
          ? `\`${artifact.path}\``
          : '-';
      const viewer = artifact.viewerUrl ? `[trace viewer](${artifact.viewerUrl})` : '-';
      lines.push(`| ${artifact.type} | ${artifact.label || '-'} | ${location} | ${viewer} |`);
    }
  }
  lines.push('');
  lines.push('## Expert Domain Open Gaps');
  lines.push('');
  const openExpertGaps = expertList.filter((expert) => expert.lastImprovementNeeded);
  if (openExpertGaps.length === 0) {
    lines.push('- None');
  } else {
    for (const expert of openExpertGaps) {
      lines.push(`- ${expert.domainId}: ${expert.domainName} (last ${expert.lastRunId})`);
      if (expert.lastNextAction) {
        lines.push(`  next: ${expert.lastNextAction}`);
      }
    }
  }
  lines.push('');
  lines.push('## Pending Improvements');
  lines.push('');
  if (pending.length === 0) {
    lines.push('- None');
  } else {
    for (const item of pending) {
      lines.push(
        `- [${item.priority}] ${item.id}: ${item.title} (seen ${item.seenCount}회, last ${item.lastSeenRunId})`
      );
    }
  }
  lines.push('');
  lines.push('## Deferred Improvements');
  lines.push('');
  if (deferred.length === 0) {
    lines.push('- None');
  } else {
    for (const item of deferred) {
      lines.push(
        `- [${item.priority}] ${item.id}: ${item.title} (seen ${item.seenCount}회, last ${item.lastSeenRunId})`
      );
      if (item.lastPolicyNote) {
        lines.push(`  - note: ${item.lastPolicyNote}`);
      }
    }
  }
  lines.push('');
  lines.push('## Wont-Fix Improvements');
  lines.push('');
  if (wontFix.length === 0) {
    lines.push('- None');
  } else {
    const wontFixGroups = groupWontFixItemsByCategory(wontFix);
    const wontFixReviewGroups = groupWontFixItemsByReviewClass(wontFix);
    lines.push(
      `- Reason categories: ${formatWontFixCategorySummary(wontFixGroups)}`
    );
    lines.push(
      `- Review classes: ${formatWontFixCategorySummary(wontFixReviewGroups)}`
    );
    lines.push('');
    lines.push('### Review Classes');
    lines.push('');
    for (const group of wontFixReviewGroups) {
      lines.push(`- ${group.label} ${group.items.length}: ${group.description}`);
    }
    lines.push('');
    for (const [groupIndex, group] of wontFixGroups.entries()) {
      lines.push(`### ${group.label}`);
      lines.push('');
      lines.push(`_${group.description}_`);
      lines.push('');
      for (const item of group.items) {
        lines.push(
          `- [${item.priority}] ${item.id}: ${item.title} (seen ${item.seenCount}회, last ${item.lastSeenRunId})`
        );
        if (item.lastPolicyNote) {
          lines.push(`  - note: ${item.lastPolicyNote}`);
        }
      }
      if (groupIndex < wontFixGroups.length - 1) {
        lines.push('');
      }
    }
  }
  lines.push('');
  lines.push('## Completed Improvements');
  lines.push('');
  if (completed.length === 0) {
    lines.push('- None');
  } else {
    const latestCompleted = completed.slice().sort((a, b) =>
      (b.lastSeenAt || '').localeCompare(a.lastSeenAt || '')
    ).slice(0, 5);
    lines.push(`- Total: ${completed.length} items completed (full list in qa-tracker.json)`);
    lines.push('- Recently completed:');
    for (const item of latestCompleted) {
      lines.push(`  - ${item.id}: ${item.title} (last ${item.lastSeenRunId})`);
    }
  }
  lines.push('');
  lines.push('## Recent Runs');
  lines.push('');
  lines.push('| Run ID | Time (UTC) | Scope | Release-Facing | In Summary | Title | Checks | Completed | Pending | Deferred | Wont-Fix | Expert Gaps |');
  lines.push('|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|');
  if (recentRuns.length === 0) {
    lines.push('| - | - | - | - | - | - | 0 | 0 | 0 | 0 | 0 | 0 |');
  } else {
    for (const run of recentRuns) {
      lines.push(
        `| ${run.runId} | ${run.recordedAt} | ${run.scope || 'legacy'} | ${run.releaseFacing ? 'yes' : 'no'} | ${run.countsTowardSummary === false ? 'no' : 'yes'} | ${run.title} | ${run.checks.total} | ${run.completedCount} | ${run.pendingCount || 0} | ${run.deferredCount || 0} | ${run.wontFixCount || 0} | ${run.expertNeedsImprovementCount || 0} |`
      );
    }
  }
  lines.push('');

  return `${lines.join('\n').trimEnd()}\n`;
}

module.exports = {
  statusMarkdown,
};
