import { describe, expect, it } from 'vitest';
import { buildFrontendQueryRoutingDecision } from './query-routing';

describe('frontend query routing', () => {
  const complexityThreshold = 19;

  it('routes borderline queries with the configured threshold only', () => {
    const query =
      'db-mysql-dc1-primary 서버의 디스크 사용률이 81%입니다. 현재 원인과 우선 조치 방법을 분석해줘.';

    expect(
      buildFrontendQueryRoutingDecision({
        query,
        complexityThreshold,
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
  });

  it('keeps attachments on streaming', () => {
    expect(
      buildFrontendQueryRoutingDecision({
        query: '첨부한 대시보드 이미지 원인 분석해줘',
        complexityThreshold,
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

  it('keeps formatting-only report rewrites on the streaming path', () => {
    expect(
      buildFrontendQueryRoutingDecision({
        query:
          '방금 CPU 상위 3개 서버 결과를 운영 보고서용 2문장으로 다시 작성해줘',
        complexityThreshold,
      })
    ).toMatchObject({
      queryMode: 'streaming',
      analysis: {
        level: 'simple',
        factors: ['formatting_only_request'],
      },
      forceJobQueue: {
        force: false,
      },
      routeDecision: {
        intent: 'chat',
        executionPath: 'stream',
        reasonCodes: ['complexity_below_threshold'],
      },
    });
  });
});
