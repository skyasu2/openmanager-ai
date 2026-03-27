import { describe, expect, it } from 'vitest';

import { evaluateAgentResponseQuality } from './response-quality';

describe('evaluateAgentResponseQuality', () => {
  it('flags Analyst responses missing required sections', () => {
    const result = evaluateAgentResponseQuality(
      'Analyst Agent',
      '이상 징후를 탐지했습니다. 상태를 확인해 주세요.',
      { durationMs: 500 }
    );

    expect(result.formatCompliance).toBe(false);
    expect(result.qualityFlags).toContain('MISSING_PERCENT_EVIDENCE');
    expect(result.qualityFlags).toContain('MISSING_CAUSE_HYPOTHESIS');
    expect(result.qualityFlags).toContain('MISSING_ACTION_SECTION');
  });

  it('accepts NLQ response when it includes required structure', () => {
    const result = evaluateAgentResponseQuality(
      'NLQ Agent',
      [
        '📊 서버 현황 요약',
        '전체 3대: 정상 2대, 경고 1대',
        'CPU: 82% (평균 45.2, 피크 93.1), 메모리: 65.4%',
        '네트워크: 40%, 디스크: 32%',
        '오프라인: 없음',
        '⚠️ 경고 서버: db-mysql-dc1-01 CPU 82%',
        '권고: 대상 서버의 상위 5분간 CPU 트래픽과 프로세스를 확인하세요.',
      ].join('\n'),
      { durationMs: 1200 }
    );

    expect(result.qualityFlags).not.toContain('MISSING_METRIC_EVIDENCE');
    expect(result.formatCompliance).toBe(true);
  });

  it('marks fallback reason as a quality flag', () => {
    const result = evaluateAgentResponseQuality(
      'Advisor Agent',
      '문제 해결을 위해 명령어: `top -o %CPU` 실행',
      { durationMs: 900, fallbackReason: 'FORCED_TOOL_RETRY' }
    );

    expect(result.qualityFlags).toContain('FORCED_TOOL_RETRY');
    expect(result.qualityFlags).toContain('TOO_SHORT');
  });
});
