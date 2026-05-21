import { describe, expect, it } from 'vitest';
import {
  getNlqInstructions,
  NLQ_BASE_INSTRUCTIONS,
} from './nlq';

describe('Metrics Query instruction layering', () => {
  it('keeps base instructions compact enough for every Metrics Query request', () => {
    const lineCount = NLQ_BASE_INSTRUCTIONS.trim().split('\n').length;

    expect(lineCount).toBeLessThanOrEqual(80);
    expect(NLQ_BASE_INSTRUCTIONS).toContain('getServerMetrics');
    expect(NLQ_BASE_INSTRUCTIONS).toContain('getServerMetricsAdvanced');
    expect(NLQ_BASE_INSTRUCTIONS).toContain('filterServers');
    expect(NLQ_BASE_INSTRUCTIONS).not.toContain('searchKnowledgeBase');
  });

  it('injects status-summary context only for summary/status requests', () => {
    const instructions = getNlqInstructions('모든 서버 현황 요약해줘');

    expect(instructions).toContain('서버 현황 응답 필수 포맷');
    expect(instructions).toContain('서버 타입별 진단 명령어 참조표');
  });

  it('injects rank context without the heavy status-summary template', () => {
    const instructions = getNlqInstructions('CPU가 가장 높은 서버 top 3');

    expect(instructions).toContain('순위 조회');
    expect(instructions).toContain('getServerMetricsAdvanced');
    expect(instructions).not.toContain('서버 타입별 진단 명령어 참조표');
  });

  it('keeps actionable TOP-N metric requests on the ranking path', () => {
    const instructions = getNlqInstructions('메모리 높은 서버 TOP 3, 조치 방법도 알려줘');

    expect(instructions).toContain('순위 조회');
    expect(instructions).toContain('sortBy');
    expect(instructions).not.toContain('서버 현황 응답 필수 포맷');
  });

  it('documents ranking plus trend and AZ grouping tool usage', () => {
    const instructions = getNlqInstructions('메모리 사용률 상위 3개 서버와 추세를 봐줘');

    expect(instructions).toContain('순위 + 추세');
    expect(instructions).toContain('groupBy: "location"');
    expect(instructions).toContain('AZ별');
  });

  it('injects threshold context for explicit comparison filters', () => {
    const instructions = getNlqInstructions('CPU 80% 이상인 서버');

    expect(instructions).toContain('임계값 조건 조회');
    expect(instructions).toContain('filterServers');
  });

  it('keeps simple lookup prompts free from specialized contexts', () => {
    const instructions = getNlqInstructions('lb-haproxy-dc1-01 상태는?');

    expect(instructions).toContain(NLQ_BASE_INSTRUCTIONS);
    expect(instructions).not.toContain('서버 현황 응답 필수 포맷');
    expect(instructions).not.toContain('순위 조회');
    expect(instructions).not.toContain('임계값 조건 조회');
  });
});
