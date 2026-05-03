import { describe, expect, it } from 'vitest';
import {
  buildFrontendQueryRoutingDecision,
  measureAnalysisModeRoutingDelta,
} from './query-routing';

describe('frontend analysis mode routing measurement', () => {
  const complexityThreshold = 19;

  it('routes the same borderline query differently when thinking is enabled', () => {
    const query =
      'db-mysql-dc1-primary 서버의 디스크 사용률이 81%입니다. 현재 원인과 우선 조치 방법을 분석해줘.';

    expect(
      buildFrontendQueryRoutingDecision({
        query,
        complexityThreshold,
        analysisMode: 'auto',
      })
    ).toMatchObject({
      queryMode: 'streaming',
      modeAdjustedThreshold: 19,
      routeDecision: {
        intent: 'chat',
        executionPath: 'stream',
        reasonCodes: ['complexity_below_threshold'],
      },
    });

    expect(
      buildFrontendQueryRoutingDecision({
        query,
        complexityThreshold,
        analysisMode: 'thinking',
      })
    ).toMatchObject({
      queryMode: 'job-queue',
      modeAdjustedThreshold: 11,
      routeDecision: {
        intent: 'job',
        executionPath: 'job',
        reasonCodes: ['complexity_threshold_exceeded'],
      },
    });
  });

  it('measures auto vs thinking route deltas on a deterministic corpus', () => {
    const queries = [
      'CPU 알려줘',
      '서버 상태 알려줘',
      'db-mysql-dc1-primary 서버의 디스크 사용률이 81%입니다. 현재 원인과 우선 조치 방법을 분석해줘.',
      '전체 서버 장애 원인 분석 보고서 만들어줘',
      'Prometheus가 뭐야',
      '지난 24시간 전체 서버 CPU 평균 요약',
    ];

    const measurement = measureAnalysisModeRoutingDelta(queries, {
      complexityThreshold,
    });

    expect(measurement.summary).toEqual({
      total: 6,
      changed: 2,
      unchanged: 4,
      autoJobCount: 2,
      thinkingJobCount: 4,
      streamToJob: 2,
      jobToStream: 0,
    });
    expect(
      measurement.rows.filter((row) => row.changed).map((row) => row.query)
    ).toEqual([
      '서버 상태 알려줘',
      'db-mysql-dc1-primary 서버의 디스크 사용률이 81%입니다. 현재 원인과 우선 조치 방법을 분석해줘.',
    ]);
    expect(
      measurement.rows.slice(0, 3).map((row) => ({
        query: row.query,
        score: row.score,
        autoMode: row.autoMode,
        thinkingMode: row.thinkingMode,
      }))
    ).toMatchObject([
      { query: 'CPU 알려줘', score: 0, autoMode: 'streaming' },
      {
        query: '서버 상태 알려줘',
        score: 15,
        autoMode: 'streaming',
        thinkingMode: 'job-queue',
      },
      {
        score: 18,
        autoMode: 'streaming',
        thinkingMode: 'job-queue',
      },
    ]);
  });

  it('keeps attachments on streaming even when thinking is enabled', () => {
    expect(
      buildFrontendQueryRoutingDecision({
        query: '첨부한 대시보드 이미지 원인 분석해줘',
        complexityThreshold,
        analysisMode: 'thinking',
        hasAttachments: true,
      })
    ).toMatchObject({
      hasAttachments: true,
      queryMode: 'streaming',
      routeDecision: {
        intent: 'chat',
        executionPath: 'stream',
        reasonCodes: ['attachment_streaming'],
      },
    });
  });
});
