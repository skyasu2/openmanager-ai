/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/shared/OpenManagerLogo', () => ({
  OpenManagerLogo: () => <div>OpenManagerLogo</div>,
}));

const baseEvidence = {
  version: '1.0.0',
  generatedAt: '2026-03-23T00:00:00.000Z',
  source: {
    trackerPath: 'reports/qa/qa-tracker.json',
    statusPath: 'reports/qa/QA_STATUS.md',
    publicPath: 'public/data/qa/validation-evidence.json',
    publicHref: '/data/qa/validation-evidence.json',
    latestRunId: 'QA-20260323-0169',
  },
  summary: {
    totalRuns: 168,
    totalChecks: 1255,
    completedItems: 239,
    expertDomainsOpenGaps: 0,
    wontFixItems: 8,
    lastRecordedAt: '2026-03-23T07:36:31.950Z',
  },
  trackerUpdated: {
    iso: '2026-03-23T07:36:31.950Z',
    short: '2026-03-23',
    long: 'March 23, 2026',
  },
  publicEvidenceUpdated: {
    iso: '2026-03-23T07:36:31.950Z',
    short: '2026-03-23',
    long: 'March 23, 2026',
  },
  latestProofRecorded: {
    iso: '2026-03-22T03:00:00.000Z',
    short: '2026-03-22',
    long: 'March 22, 2026',
  },
  latestProofRun: {
    runId: 'QA-20260322-0160',
    title: 'validation proof run',
    scope: 'targeted',
    recordedAt: '2026-03-22T03:00:00.000Z',
    commitSha: 'abcdef12',
    repoPath: 'reports/qa/runs/2026/qa-run-QA-20260322-0160.json',
    ciRunLink: {
      type: 'github-actions-run',
      label: 'GitHub Actions evidence run',
      url: 'https://github.com/example/actions/runs/1',
      note: '',
    },
    ciArtifactLinks: [],
  },
};

type MockEvidence = typeof baseEvidence;
type MockEvidenceOverrides = Partial<MockEvidence> & {
  source?: Partial<MockEvidence['source']>;
  summary?: Partial<MockEvidence['summary']>;
  trackerUpdated?: Partial<MockEvidence['trackerUpdated']>;
  publicEvidenceUpdated?: Partial<MockEvidence['publicEvidenceUpdated']>;
  latestProofRecorded?: Partial<MockEvidence['latestProofRecorded']>;
  latestProofRun?: Partial<MockEvidence['latestProofRun']>;
};

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function buildEvidence(overrides: MockEvidenceOverrides = {}): MockEvidence {
  return {
    ...baseEvidence,
    ...overrides,
    source: {
      ...baseEvidence.source,
      ...overrides.source,
    },
    summary: {
      ...baseEvidence.summary,
      ...overrides.summary,
    },
    trackerUpdated: {
      ...baseEvidence.trackerUpdated,
      ...overrides.trackerUpdated,
    },
    publicEvidenceUpdated: {
      ...baseEvidence.publicEvidenceUpdated,
      ...overrides.publicEvidenceUpdated,
    },
    latestProofRecorded: {
      ...baseEvidence.latestProofRecorded,
      ...overrides.latestProofRecorded,
    },
    latestProofRun: {
      ...baseEvidence.latestProofRun,
      ...overrides.latestProofRun,
    },
  };
}

async function renderPageWithEvidence(overrides: MockEvidenceOverrides = {}) {
  vi.resetModules();
  vi.doMock('../../../public/data/qa/validation-evidence.json', () => ({
    default: buildEvidence(overrides),
  }));

  const { default: ValidationEvidencePage } = await import('./page');

  render(<ValidationEvidencePage />);
}

afterEach(() => {
  vi.doUnmock('../../../public/data/qa/validation-evidence.json');
  vi.resetModules();
});

describe('ValidationEvidencePage', () => {
  it('snapshot이 7일 이상 오래되면 stale 배너를 보여준다', async () => {
    await renderPageWithEvidence({
      generatedAt: daysAgo(8),
    });

    expect(
      screen.getByText(/이 스냅샷은 .*일 전 빌드 기준입니다\./)
    ).toBeInTheDocument();
    expect(screen.getByText(/최신 QA 기록은 저장소의/)).toBeInTheDocument();
  });

  it('snapshot이 7일 미만이면 stale 배너를 숨긴다', async () => {
    await renderPageWithEvidence({
      generatedAt: daysAgo(2),
    });

    expect(
      screen.queryByText(/이 스냅샷은 .*일 전 빌드 기준입니다\./)
    ).not.toBeInTheDocument();
  });

  it('public validation snapshot이 latest proof보다 최신이면 차이를 설명한다', async () => {
    await renderPageWithEvidence({
      publicEvidenceUpdated: {
        iso: '2026-03-23T07:36:31.950Z',
        short: '2026-03-23',
        long: 'March 23, 2026',
      },
      latestProofRecorded: {
        iso: '2026-03-22T03:00:00.000Z',
        short: '2026-03-22',
        long: 'March 22, 2026',
      },
    });

    expect(
      screen.getByText(
        /Public validation snapshot이 latest CI proof보다 1일 더 최신입니다\./
      )
    ).toBeInTheDocument();
  });

  it('public validation snapshot과 latest proof가 같은 기준이면 동일 시점으로 설명한다', async () => {
    await renderPageWithEvidence({
      publicEvidenceUpdated: {
        iso: '2026-03-23T07:36:31.950Z',
      },
      latestProofRecorded: {
        iso: '2026-03-23T07:36:31.950Z',
      },
    });

    expect(
      screen.getByText(
        /public validation snapshot과 latest CI proof가 같은 기준 시점/
      )
    ).toBeInTheDocument();
  });

  it('latest proof가 더 최신이면 반대 방향 차이를 설명한다', async () => {
    await renderPageWithEvidence({
      publicEvidenceUpdated: {
        iso: '2026-03-22T03:00:00.000Z',
      },
      latestProofRecorded: {
        iso: '2026-03-23T07:36:31.950Z',
      },
    });

    expect(
      screen.getByText(
        /Latest CI proof가 public validation snapshot보다 1일 더 최신입니다\./
      )
    ).toBeInTheDocument();
  });

  it('표시 날짜가 다르면 24시간 미만 차이도 최소 1일로 설명한다', async () => {
    await renderPageWithEvidence({
      publicEvidenceUpdated: {
        iso: '2026-03-24T00:10:00.000Z',
        short: '2026-03-24',
        long: 'March 24, 2026',
      },
      latestProofRecorded: {
        iso: '2026-03-23T23:55:00.000Z',
        short: '2026-03-23',
        long: 'March 23, 2026',
      },
    });

    expect(
      screen.getByText(
        /Public validation snapshot이 latest CI proof보다 1일 더 최신입니다\./
      )
    ).toBeInTheDocument();
  });

  it('generatedAt이 잘못되면 stale 배너를 숨긴다', async () => {
    await renderPageWithEvidence({
      generatedAt: 'not-a-date',
    });

    expect(
      screen.queryByText(/이 스냅샷은 .*일 전 빌드 기준입니다\./)
    ).not.toBeInTheDocument();
  });
});
