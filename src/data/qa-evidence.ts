export const QA_EVIDENCE_ANCHORS = {
  qaStatus: 'qa-status',
  latestProofRun: 'latest-proof-run',
} as const;

export const QA_EVIDENCE = {
  validatedOnShort: '2026-03-22',
  validatedOnLong: 'March 22, 2026',
  qaSummary: {
    totalRuns: 159,
    totalChecks: 1216,
    completedItems: 234,
    expertOpenGaps: 0,
    wontFixItems: 8,
  },
  repoEvidence: {
    qaStatusPath: 'reports/qa/QA_STATUS.md',
    latestProofRunPath: 'reports/qa/runs/2026/qa-run-QA-20260322-0160.json',
  },
  latestProofRun: {
    runId: 'QA-20260322-0160',
    title: 'CI Manual Feedback Trace Status QA (run #23398040200)',
    scope: 'targeted',
    commitSha: 'ba7b15d70',
    ciRunId: '23398040200',
    ciRunUrl: 'https://github.com/skyasu2/openmanager-ai/actions/runs/23398040200',
    ciArtifacts: [
      'manual-feedback-trace-report-23398040200',
      'manual-feedback-trace-results-23398040200',
    ],
  },
} as const;

export const QA_EVIDENCE_CTA_LINKS = {
  statusHref: `/validation#${QA_EVIDENCE_ANCHORS.qaStatus}`,
  proofHref: `/validation#${QA_EVIDENCE_ANCHORS.latestProofRun}`,
  ciHref: QA_EVIDENCE.latestProofRun.ciRunUrl,
} as const;
