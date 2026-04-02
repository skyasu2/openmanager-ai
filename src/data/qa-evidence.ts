export const QA_EVIDENCE_ANCHORS = {
  qaStatus: 'qa-status',
  latestProofRun: 'latest-proof-run',
} as const;

export const QA_EVIDENCE_CTA_LINKS = {
  overviewHref: '/validation',
  statusHref: `/validation#${QA_EVIDENCE_ANCHORS.qaStatus}`,
  proofHref: `/validation#${QA_EVIDENCE_ANCHORS.latestProofRun}`,
  publicSnapshotHref: '/data/qa/validation-evidence.json',
} as const;

export const QA_EVIDENCE_LABELS = {
  badge: 'Production QA Snapshot',
  criteria: '실환경 검증 기준',
  validationPage: 'Validation Evidence',
} as const;
