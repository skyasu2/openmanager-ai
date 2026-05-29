import { describe, expect, it } from 'vitest';
import { createAgentDataSourceContext } from './domain-data-source';
import { extractContextualServerTargetsFromMessages } from '../../../domains/monitoring/current-metrics-request-helpers';

describe('createAgentDataSourceContext conversation history threading', () => {
  it('falls back to the current query when no conversation history is provided', () => {
    const context = createAgentDataSourceContext({
      query: '현재 서버 상태 요약해줘',
      sessionId: 'session-1',
    });

    expect(context.message).toBe('현재 서버 상태 요약해줘');
    expect(context.messages).toEqual([
      { role: 'user', content: '현재 서버 상태 요약해줘' },
    ]);
  });

  it('preserves prior assistant turns so contextual follow-ups can resolve server ids', () => {
    // Regression: Q5 "방금 분석한 서버 중 …" 가 프로덕션 스트림 경로에서
    // 직전 assistant 응답의 서버 ID를 보지 못하고 group(loadbalancer) 추론으로
    // 폴백하던 문제. 대화 히스토리를 evidence 컨텍스트까지 전달해야 한다.
    const query = '방금 분석한 서버 중 네트워크 문제가 있는 것만 골라줘';
    const conversationMessages = [
      { role: 'user' as const, content: '지금 당장 조치가 필요한 서버가 있어?' },
      {
        role: 'assistant' as const,
        content:
          '주의 관찰 대상: lb-haproxy-dc1-01, web-nginx-dc1-01, db-mysql-dc1-primary 입니다.',
      },
      { role: 'user' as const, content: query },
    ];

    const context = createAgentDataSourceContext({
      query,
      sessionId: 'session-2',
      conversationMessages,
    });

    expect(context.message).toBe(query);
    expect(context.messages).toBe(conversationMessages);

    const targets = extractContextualServerTargetsFromMessages(context);

    expect(targets).toEqual([
      'lb-haproxy-dc1-01',
      'web-nginx-dc1-01',
      'db-mysql-dc1-primary',
    ]);
  });
});
