import { describe, expect, it, vi } from 'vitest';

vi.mock('./agents/context-store', () => ({
  appendAffectedServers: vi.fn(),
  appendAnomalies: vi.fn(),
  appendMetrics: vi.fn(),
  updateSessionContext: vi.fn(),
}));

vi.mock('./agents/vision-agent', () => ({
  isVisionQuery: vi.fn((query: string) =>
    /스크린샷|이미지|대시보드|screenshot|image|dashboard/i.test(query)
  ),
}));

import { preFilterQuery } from './agents/orchestrator-context';
import { selectExecutionMode } from './supervisor-routing';

describe('routing policy consistency', () => {
  it('keeps greetings on the cheapest path', () => {
    const preFilter = preFilterQuery('안녕하세요');

    expect(selectExecutionMode('안녕하세요')).toBe('single');
    expect(preFilter.shouldHandoff).toBe(false);
    expect(preFilter.directResponse).toContain('서버 모니터링 AI');
  });

  it('keeps simple metric lookups on single-agent while preserving NLQ fast-path for multi mode', () => {
    const preFilter = preFilterQuery('CPU 알려줘');

    expect(selectExecutionMode('CPU 알려줘')).toBe('single');
    expect(preFilter.shouldHandoff).toBe(true);
    expect(preFilter.suggestedAgent).toBe('NLQ Agent');
    expect(preFilter.confidence).toBe(0.86);
  });

  it('keeps summary/report/advisor requests aligned on multi-agent specialist routing', () => {
    expect(selectExecutionMode('서버 상태 요약해줘')).toBe('multi');
    expect(preFilterQuery('서버 상태 요약해줘')).toMatchObject({
      shouldHandoff: true,
      suggestedAgent: 'NLQ Agent',
      confidence: 0.86,
    });

    expect(selectExecutionMode('장애 보고서 생성해줘')).toBe('multi');
    expect(preFilterQuery('장애 보고서 생성해줘')).toMatchObject({
      shouldHandoff: true,
      suggestedAgent: 'Reporter Agent',
    });

    expect(selectExecutionMode('메모리 부족 해결 방법 알려줘')).toBe('multi');
    expect(preFilterQuery('메모리 부족 해결 방법 알려줘')).toMatchObject({
      shouldHandoff: true,
      suggestedAgent: 'Advisor Agent',
    });
  });

  it('treats composite infra queries as multi-agent with a lower-confidence specialist hint', () => {
    const query = '서버 상태와 원인 분석을 비교하고 해결 방법도 알려줘';
    const preFilter = preFilterQuery(query);

    expect(selectExecutionMode(query)).toBe('multi');
    expect(preFilter.shouldHandoff).toBe(true);
    expect(preFilter.suggestedAgent).toBeDefined();
    expect(preFilter.confidence).toBe(0.68);
  });
});
