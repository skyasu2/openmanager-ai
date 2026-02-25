import { describe, expect, it, vi } from 'vitest';

vi.mock('./context-store', () => ({
  appendAffectedServers: vi.fn(),
  appendAnomalies: vi.fn(),
  appendMetrics: vi.fn(),
  updateSessionContext: vi.fn(),
}));

vi.mock('./vision-agent', () => ({
  isVisionQuery: vi.fn((query: string) =>
    /스크린샷|이미지|대시보드|screenshot|image|dashboard/i.test(query)
  ),
}));

import { preFilterQuery } from './orchestrator-context';

describe('preFilterQuery', () => {
  it('returns direct response for greetings', () => {
    const result = preFilterQuery('안녕하세요');
    expect(result.shouldHandoff).toBe(false);
    expect(result.directResponse).toContain('서버 모니터링 AI');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('returns generic NLQ suggestion for simple server metric query', () => {
    const result = preFilterQuery('서버 상태 알려줘');
    expect(result.shouldHandoff).toBe(true);
    expect(result.suggestedAgent).toBe('NLQ Agent');
    expect(result.confidence).toBe(0.86);
  });

  it('prefers analyst/reporter/advisor with high confidence for clear intent', () => {
    expect(preFilterQuery('CPU 급증 원인 분석해줘').suggestedAgent).toBe('Analyst Agent');
    expect(preFilterQuery('장애 보고서 작성해줘').suggestedAgent).toBe('Reporter Agent');
    expect(preFilterQuery('메모리 부족 해결 방법 알려줘').suggestedAgent).toBe('Advisor Agent');
  });

  it('avoids forced suggestion for composite infra query', () => {
    const result = preFilterQuery('서버 상태와 원인 분석을 비교하고 해결 방법도 알려줘');
    expect(result.shouldHandoff).toBe(true);
    expect(result.suggestedAgent).toBeUndefined();
    expect(result.confidence).toBe(0.68);
  });
});
