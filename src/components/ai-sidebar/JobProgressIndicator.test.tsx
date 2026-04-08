/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JobProgressIndicator } from './JobProgressIndicator';

describe('JobProgressIndicator', () => {
  it('renders execution path and handoff metadata when provided', () => {
    render(
      <JobProgressIndicator
        progress={{
          stage: 'analyst',
          progress: 68,
          message: '심층 분석으로 전달 중...',
          agent: 'analyst',
          handoffFrom: 'supervisor',
          handoffTo: 'analyst',
          executionPath: ['supervisor', 'analyst', 'reporter'],
          handoffCount: 2,
          stageLabel: '심층 분석',
          stageDetail: '분석 조율 → 심층 분석 → 보고서 생성',
        }}
        isLoading
        jobId="job-path-12345678"
      />
    );

    expect(screen.getByText('심층 분석으로 전달 중...')).toBeInTheDocument();
    expect(
      screen.getByText('분석 조율 → 심층 분석 → 보고서 생성')
    ).toBeInTheDocument();
    expect(screen.getByText('전달: 분석 조율 → 심층 분석')).toBeInTheDocument();
    expect(screen.getByText('handoff 2회')).toBeInTheDocument();
    expect(screen.getByText('심층 분석')).toBeInTheDocument();
  });
});
