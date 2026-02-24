import { describe, expect, it, vi } from 'vitest';
import {
  createPrepareStep,
  getIntentCategory,
  selectExecutionMode,
} from './supervisor-routing';

// Mock Tavily availability for deterministic tests
vi.mock('../../lib/tavily-hybrid-rag', () => ({
  isTavilyAvailable: vi.fn(() => true),
}));

// ============================================================================
// selectExecutionMode
// ============================================================================

describe('selectExecutionMode', () => {
  describe('multi-agent mode', () => {
    it('should select multi for report/incident requests', () => {
      expect(selectExecutionMode('보고서 작성해줘')).toBe('multi');
      expect(selectExecutionMode('인시던트 분석해줘')).toBe('multi');
      expect(selectExecutionMode('장애 보고서 만들어줘')).toBe('multi');
      expect(selectExecutionMode('일일 리포트 생성')).toBe('multi');
    });

    it('should select multi for RCA requests', () => {
      expect(selectExecutionMode('원인 분석해줘')).toBe('multi');
      expect(selectExecutionMode('근본 원인 찾아줘')).toBe('multi');
      expect(selectExecutionMode('root cause analysis')).toBe('multi');
    });

    it('should select multi for resolution/advisory requests', () => {
      expect(selectExecutionMode('해결 방법 알려줘')).toBe('multi');
      expect(selectExecutionMode('과거 사례 검색')).toBe('multi');
      expect(selectExecutionMode('유사 장애 찾아줘')).toBe('multi');
      expect(selectExecutionMode('how to fix this issue')).toBe('multi');
      expect(selectExecutionMode('troubleshoot the problem')).toBe('multi');
    });

    it('should select multi for capacity planning', () => {
      expect(selectExecutionMode('용량 계획 세워줘')).toBe('multi');
      expect(selectExecutionMode('언제 부족해질까')).toBe('multi');
      expect(selectExecutionMode('증설 필요한지 알려줘')).toBe('multi');
    });

    it('should select multi for server summary requests', () => {
      expect(selectExecutionMode('서버 상태 요약해줘')).toBe('multi');
      expect(selectExecutionMode('인프라 현황 간단히 알려줘')).toBe('multi');
      expect(selectExecutionMode('server status summary')).toBe('multi');
      expect(selectExecutionMode('monitoring overview')).toBe('multi');
    });

    it('should select multi for analysis with infra context', () => {
      expect(selectExecutionMode('서버 왜 느려졌어?')).toBe('multi');
      expect(selectExecutionMode('CPU 왜 높아?')).toBe('multi');
      expect(selectExecutionMode('why is the server slow')).toBe('multi');
      expect(selectExecutionMode('메모리 예측 분석해줘')).toBe('multi');
    });

    it('should select multi for composite infra requests', () => {
      expect(selectExecutionMode('서버 상태와 원인 분석을 같이 해줘')).toBe('multi');
      expect(selectExecutionMode('CPU 추이 비교하고 해결 방법도 알려줘')).toBe('multi');
      expect(selectExecutionMode('server status and root cause analysis together')).toBe('multi');
    });

    it('should handle typos in Korean', () => {
      expect(selectExecutionMode('서벼 요약')).toBe('multi');
      expect(selectExecutionMode('요먁 해줘 서버')).toBe('multi');
    });

    it('should handle typos in English', () => {
      expect(selectExecutionMode('servr status summary')).toBe('multi');
      expect(selectExecutionMode('trubleshoot the issue')).toBe('multi');
    });
  });

  describe('single-agent mode', () => {
    it('should select single for simple metric queries', () => {
      expect(selectExecutionMode('CPU 알려줘')).toBe('single');
      expect(selectExecutionMode('메모리 사용률')).toBe('single');
      expect(selectExecutionMode('디스크 상태')).toBe('single');
    });

    it('should select single for greetings', () => {
      expect(selectExecutionMode('안녕')).toBe('single');
      expect(selectExecutionMode('hello')).toBe('single');
    });

    it('should select single for non-infra analysis queries', () => {
      expect(selectExecutionMode('왜 느려?')).toBe('single');
      expect(selectExecutionMode('예측해줘')).toBe('single');
    });

    it('should keep simple infra lookups in single mode', () => {
      expect(selectExecutionMode('서버 상태')).toBe('single');
      expect(selectExecutionMode('cpu 평균')).toBe('single');
    });
  });
});

// ============================================================================
// getIntentCategory
// ============================================================================

describe('getIntentCategory', () => {
  it('should classify anomaly queries', () => {
    expect(getIntentCategory('이상 탐지해줘')).toBe('anomaly');
    expect(getIntentCategory('스파이크 감지')).toBe('anomaly');
    expect(getIntentCategory('비정상 서버')).toBe('anomaly');
    expect(getIntentCategory('anomaly detection')).toBe('anomaly');
  });

  it('should classify prediction queries', () => {
    expect(getIntentCategory('트렌드 분석')).toBe('prediction');
    expect(getIntentCategory('추이 예측')).toBe('prediction');
    expect(getIntentCategory('forecast CPU usage')).toBe('prediction');
  });

  it('should classify RCA queries', () => {
    expect(getIntentCategory('장애 원인 분석')).toBe('rca');
    expect(getIntentCategory('타임라인 구성')).toBe('rca');
    expect(getIntentCategory('왜 이런 오류가?')).toBe('rca');
    expect(getIntentCategory('RCA 분석')).toBe('rca');
  });

  it('should classify advisor queries', () => {
    expect(getIntentCategory('해결 방법 알려줘')).toBe('advisor');
    expect(getIntentCategory('명령어 추천')).toBe('advisor');
    expect(getIntentCategory('과거 사례 검색')).toBe('advisor');
    expect(getIntentCategory('best practice 추천')).toBe('advisor');
    expect(getIntentCategory('보안 강화 가이드')).toBe('advisor');
  });

  it('should classify log queries', () => {
    expect(getIntentCategory('로그 보여줘')).toBe('logs');
    expect(getIntentCategory('에러 로그 분석')).toBe('logs');
    expect(getIntentCategory('show me the logs')).toBe('logs');
    expect(getIntentCategory('syslog 확인')).toBe('logs');
  });

  it('should not confuse "로그인" with "로그"', () => {
    expect(getIntentCategory('로그인 방법')).not.toBe('logs');
  });

  it('should classify server group queries', () => {
    expect(getIntentCategory('db 서버 상태')).toBe('serverGroup');
    expect(getIntentCategory('web 서버 확인')).toBe('serverGroup');
    expect(getIntentCategory('캐시 서버')).toBe('serverGroup');
    expect(getIntentCategory('로드 밸런서')).toBe('serverGroup');
  });

  it('should classify metric queries', () => {
    expect(getIntentCategory('cpu 사용률')).toBe('metrics');
    expect(getIntentCategory('서버 상태')).toBe('metrics');
    expect(getIntentCategory('디스크 용량')).toBe('metrics');
  });

  it('should return general for unclassified queries', () => {
    expect(getIntentCategory('안녕하세요')).toBe('general');
    expect(getIntentCategory('감사합니다')).toBe('general');
    expect(getIntentCategory('hello there')).toBe('general');
  });

  it('should prioritize anomaly over metrics', () => {
    // "이상" matches anomaly before "서버" matches metrics
    expect(getIntentCategory('서버 이상 탐지')).toBe('anomaly');
  });
});

// ============================================================================
// createPrepareStep
// ============================================================================

describe('createPrepareStep', () => {
  it('should return toolChoice none for simple greetings', async () => {
    const prepare = createPrepareStep('안녕!');
    const result = await prepare({ stepNumber: 0 });
    expect(result).toEqual({ toolChoice: 'none' });
  });

  it('should return empty object for stepNumber > 0', async () => {
    const prepare = createPrepareStep('CPU 분석해줘');
    const result = await prepare({ stepNumber: 1 });
    expect(result).toEqual({});
  });

  it('should route anomaly queries to anomaly tools', async () => {
    const prepare = createPrepareStep('이상 탐지해줘');
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toContain('detectAnomalies');
    expect(result.toolChoice).toBe('required');
  });

  it('should route prediction queries to trend tools', async () => {
    const prepare = createPrepareStep('트렌드 예측해줘');
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toContain('predictTrends');
    expect(result.toolChoice).toBe('required');
  });

  it('should route RCA queries to incident tools', async () => {
    const prepare = createPrepareStep('장애 원인 분석');
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toContain('findRootCause');
    expect(result.activeTools).toContain('buildIncidentTimeline');
    expect(result.toolChoice).toBe('required');
  });

  it('should route advisor queries to knowledge tools', async () => {
    const prepare = createPrepareStep('해결 방법 알려줘');
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toContain('searchKnowledgeBase');
    expect(result.activeTools).toContain('recommendCommands');
    expect(result.toolChoice).toBe('required');
  });

  it('should route log queries to log tools', async () => {
    const prepare = createPrepareStep('에러 로그 보여줘');
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toContain('getServerLogs');
    expect(result.toolChoice).toBe('required');
  });

  it('should route server group queries to group tools', async () => {
    const prepare = createPrepareStep('db 서버 상태');
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toContain('getServerByGroup');
    expect(result.toolChoice).toBe('auto');
  });

  it('should force web search when enableWebSearch is true', async () => {
    const prepare = createPrepareStep('CPU 상태', { enableWebSearch: true });
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toContain('searchWeb');
    expect(result.toolChoice).toEqual({ type: 'tool', toolName: 'searchWeb' });
  });

  it('should default to metric tools for generic queries', async () => {
    const prepare = createPrepareStep('서버 확인');
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toContain('getServerMetrics');
    expect(result.toolChoice).toBe('auto');
  });
});
