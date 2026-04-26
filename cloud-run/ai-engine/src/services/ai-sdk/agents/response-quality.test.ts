import { describe, expect, it } from 'vitest';

import { classifyLatencyTier, evaluateAgentResponseQuality } from './response-quality';

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

  it('flags NLQ response when no server scope is provided', () => {
    const result = evaluateAgentResponseQuality(
      'NLQ Agent',
      [
        '이상은 없습니다.',
        'CPU: 52%',
        '권고: 현재 추세를 계속 모니터링하세요.',
      ].join('\n'),
      { durationMs: 900 }
    );

    expect(result.qualityFlags).toContain('MISSING_SERVER_REFERENCE');
    expect(result.formatCompliance).toBe(false);
  });

  it('accepts NLQ response when overall server count is included', () => {
    const result = evaluateAgentResponseQuality(
      'NLQ Agent',
      [
        '서버 현황 요약: 전체 18대 모두 정상입니다.',
        'CPU: 52%, 메모리: 48%, 디스크: 41%, 네트워크: 22%',
        '권고: 현재 임계값을 유지하면서 추세만 확인하고, 변화가 10% 이상 커질 때만 재점검하세요.',
      ].join('\n'),
      { durationMs: 900 }
    );

    expect(result.qualityFlags).not.toContain('MISSING_SERVER_REFERENCE');
  });

  describe('Advisor Agent latency thresholds', () => {
    it('classifies Advisor ≤8s as fast', () => {
      expect(classifyLatencyTier(7_500, 'Advisor Agent')).toBe('fast');
    });

    it('classifies Advisor 8~20s as normal', () => {
      expect(classifyLatencyTier(15_000, 'Advisor Agent')).toBe('normal');
    });

    it('classifies Advisor 20~40s as slow (not very_slow)', () => {
      expect(classifyLatencyTier(35_000, 'Advisor Agent')).toBe('slow');
    });

    it('classifies Advisor >40s as very_slow', () => {
      expect(classifyLatencyTier(86_000, 'Advisor Agent')).toBe('very_slow');
    });

    it('does NOT flag LATENCY_VERY_SLOW for 35s Advisor response', () => {
      const text = [
        '## 문제 요약: CPU 과부하',
        '### 💡 원인 분석',
        '- 원인: 과도한 프로세스 실행 (신뢰도: 85%)',
        '### 🛠️ 권장 조치 절차',
        '1. **진단**: `top -o %CPU`',
        '2. **조치**: `kill -9 <PID>` ⚠️ 서비스 중단 주의',
        '3. **검증**: `top -o %CPU`',
        '### ⚠️ 주의사항',
        '- 서비스 재시작 전 백업 확인',
      ].join('\n');
      const result = evaluateAgentResponseQuality('Advisor Agent', text, { durationMs: 35_000 });
      expect(result.qualityFlags).not.toContain('LATENCY_VERY_SLOW');
      expect(result.latencyTier).toBe('slow');
    });
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
