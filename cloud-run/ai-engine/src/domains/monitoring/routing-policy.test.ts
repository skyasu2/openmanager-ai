import { describe, expect, it, vi } from 'vitest';
import type { DomainIntentFrame } from '../../core/assistant-runtime';
import {
  createSystemPrompt,
  createPrepareStep,
  getIntentCategory,
  getLLMParamsForIntent,
  selectExecutionMode,
  shouldForceWebSearch,
} from './routing-policy';

// Mock Tavily availability for deterministic tests
vi.mock('../../lib/tavily-web-search-client', () => ({
  isTavilyAvailable: vi.fn(() => true),
}));

function buildIntentFrame(
  executionMode: DomainIntentFrame['executionMode'],
  confidence = 0.91
): DomainIntentFrame {
  return {
    domainId: 'openmanager-monitoring',
    intent: executionMode === 'multi' ? 'server_health' : 'metric_current',
    capabilityId:
      executionMode === 'multi'
        ? 'monitoring.server_health'
        : 'monitoring.metric_ranking',
    scope: 'whole_fleet',
    targets: [],
    aggregation: 'summary',
    ambiguity: 'low',
    executionMode,
    confidence,
  };
}

function buildSemanticIntentFrame(
  overrides: Partial<DomainIntentFrame> = {}
): DomainIntentFrame {
  return {
    domainId: 'openmanager-monitoring',
    intent: 'anomaly_detection',
    capabilityId: 'monitoring.anomaly_detection',
    scope: 'whole_fleet',
    targets: [],
    ambiguity: 'low',
    executionMode: 'multi',
    confidence: 0.91,
    ...overrides,
  };
}

describe('createSystemPrompt', () => {
  it('should include answer quality rules for exact counts and free-tier aligned recommendations', () => {
    const prompt = createSystemPrompt('desktop');

    expect(prompt).toContain('정확히 그 개수만큼');
    expect(prompt).toContain('리소스 증설/업그레이드는 마지막 수단');
    expect(prompt).toContain('CPU 질의에는 CPU 원인 확인과 부하 분산 조치');
  });

  it('should include agent routing context hints', () => {
    const prompt = createSystemPrompt('desktop');

    expect(prompt).toContain('에이전트 라우팅 힌트');
    expect(prompt).toContain('이상감지/분석 질의는 Analyst Agent');
    expect(prompt).toContain('보고서 생성은 Reporter Agent');
    expect(prompt).toContain('해결 방법/명령어 추천은 Advisor Agent');
    expect(prompt).toContain('단순 메트릭 조회는 Metrics Query Agent');
    expect(prompt).toContain('이미지/스크린샷 분석은 Vision Agent');
  });

  it('should include formatting-only rewrite quality rules', () => {
    const prompt = createSystemPrompt('desktop');

    expect(prompt).toContain('재작성/문장화 요청 처리');
    expect(prompt).toContain('직전 답변의 사실만 재표현');
    expect(prompt).toContain('정확히 그 개수와 형식');
    expect(prompt).toContain('완결된 한국어 문장');
  });

  it('should keep few-shot operational commands approval-safe', () => {
    const prompt = createSystemPrompt('desktop');

    expect(prompt).toContain('내부 판단 절차');
    expect(prompt).toContain('승인된 운영 절차');
    expect(prompt).toContain('find /tmp -xdev -type f -mtime +7 -print');
    expect(prompt).not.toContain('rm -rf');
  });
});

// ============================================================================
// selectExecutionMode
// ============================================================================

describe('selectExecutionMode', () => {
  describe('intentFrame trust path', () => {
    it('trusts high-confidence NLQ executionMode before regex fallback', () => {
      expect(
        selectExecutionMode('CPU 알려줘', buildIntentFrame('multi'))
      ).toBe('multi');
      expect(
        selectExecutionMode(
          '장애 보고서 만들어줘',
          buildIntentFrame('single')
        )
      ).toBe('single');
    });

    it('keeps explicit single-server ops advice on Advisor before metric intentFrame', () => {
      const metricFrame = buildSemanticIntentFrame({
        intent: 'metric_ranking',
        capabilityId: 'monitoring.metric_ranking',
        scope: 'entity',
        targets: ['db-mysql-dc1-primary'],
        metric: 'disk',
        aggregation: 'top_n',
        executionMode: 'single',
        confidence: 0.93,
      });
      const query =
        'db-mysql-dc1-primary 서버 디스크 사용량이 높은데 성능 개선 조언 해줘';

      expect(selectExecutionMode(query, metricFrame)).toBe('multi');
      expect(getIntentCategory(query, metricFrame)).toBe('advisor');
    });

    it('falls back when executionMode is unknown or confidence is low', () => {
      expect(
        selectExecutionMode(
          '장애 보고서 만들어줘',
          buildIntentFrame('unknown')
        )
      ).toBe('multi');
      expect(
        selectExecutionMode(
          'CPU 알려줘',
          buildIntentFrame('multi', 0.79)
        )
      ).toBe('single');
    });

    it('accepts legacy 0-100 confidence frames from older callers', () => {
      expect(
        selectExecutionMode('CPU 알려줘', buildIntentFrame('multi', 91))
      ).toBe('multi');
    });

    it('forces log paste input to multi before intentFrame and regex fallback', () => {
      expect(
        selectExecutionMode(
          'CPU 알려줘',
          buildIntentFrame('single', 0.99),
          'log_paste'
        )
      ).toBe('multi');
    });
  });

  describe('multi-agent mode', () => {
    it('should select multi for report/incident requests', () => {
      expect(selectExecutionMode('보고서 작성해줘')).toBe('multi');
      expect(selectExecutionMode('인시던트 분석해줘')).toBe('multi');
      expect(selectExecutionMode('장애 보고서 만들어줘')).toBe('multi');
      expect(selectExecutionMode('일일 리포트 생성')).toBe('multi');
    });

    it('should use intentFrame for RCA requests instead of broad regex', () => {
      expect(selectExecutionMode('원인 분석해줘')).toBe('single');
      expect(
        selectExecutionMode(
          '원인 분석해줘',
          buildIntentFrame('multi')
        )
      ).toBe('multi');
      expect(selectExecutionMode('근본 원인 찾아줘')).toBe('single');
      expect(selectExecutionMode('root cause analysis')).toBe('single');
    });

    it('should select multi for resolution/advisory requests', () => {
      expect(selectExecutionMode('해결 방법 알려줘')).toBe('multi');
      expect(selectExecutionMode('과거 사례 검색')).toBe('multi');
      expect(selectExecutionMode('유사 장애 찾아줘')).toBe('multi');
      expect(selectExecutionMode('how to fix this issue')).toBe('multi');
      expect(selectExecutionMode('troubleshoot the problem')).toBe('multi');
    });

    it('should use intentFrame for capacity planning beyond advisor fallback', () => {
      expect(selectExecutionMode('용량 계획 세워줘')).toBe('single');
      expect(
        selectExecutionMode(
          '용량 계획 세워줘',
          buildIntentFrame('multi')
        )
      ).toBe('multi');
      expect(selectExecutionMode('언제 부족해질까')).toBe('single');
      expect(selectExecutionMode('증설 필요한지 알려줘')).toBe('single');
    });

    it('should select multi for metric threshold capacity forecast questions', () => {
      expect(selectExecutionMode('디스크 사용률 언제 90% 넘을까?')).toBe('multi');
      expect(selectExecutionMode('메모리 용량 예측해줘')).toBe('multi');
    });

    it('should use intentFrame for server summary requests instead of typo regex', () => {
      expect(selectExecutionMode('서버 상태 요약해줘')).toBe('single');
      expect(
        selectExecutionMode(
          '서버 상태 요약해줘',
          buildIntentFrame('multi')
        )
      ).toBe('multi');
      expect(selectExecutionMode('인프라 현황 간단히 알려줘')).toBe('single');
      expect(selectExecutionMode('server status summary')).toBe('single');
      expect(selectExecutionMode('monitoring overview')).toBe('single');
    });

    it('should force multi for topology/architecture KB queries', () => {
      expect(selectExecutionMode('현재 인프라 토폴로지 알려줘')).toBe('multi');
      expect(
        selectExecutionMode('현재 인프라 아키텍처와 트래픽 경로를 사내 지식베이스 기준으로 짧게 정리해줘.'),
      ).toBe('multi');
      expect(
        selectExecutionMode(
          'Vercel BFF와 Cloud Run AI Engine 책임 경계를 알려줘. KRL 근거가 있으면 함께 알려줘.'
        )
      ).toBe('multi');
    });

    it('lets explicit KRL/SSOT wording override high-confidence metric intent frames', () => {
      const metricFrame = buildIntentFrame('single', 0.95);

      expect(
        selectExecutionMode(
          'OpenManager OTel 데이터 SSOT와 18대 서버 상태 판단 기준을 KRL 근거로 요약해줘.',
          metricFrame
        )
      ).toBe('multi');
      expect(
        getIntentCategory(
          'OpenManager OTel 데이터 SSOT와 18대 서버 상태 판단 기준을 KRL 근거로 요약해줘.',
          metricFrame
        )
      ).toBe('advisor');
    });

    it('should use intentFrame for analysis with infra context', () => {
      expect(selectExecutionMode('서버 왜 느려졌어?')).toBe('single');
      expect(
        selectExecutionMode(
          'CPU 왜 높아?',
          buildIntentFrame('multi')
        )
      ).toBe('multi');
      expect(selectExecutionMode('why is the server slow')).toBe('single');
      expect(selectExecutionMode('메모리 예측 분석해줘')).toBe('single');
    });

    it('should keep only explicit advisor composite requests in regex fallback', () => {
      expect(selectExecutionMode('서버 상태와 원인 분석을 같이 해줘')).toBe('single');
      expect(selectExecutionMode('CPU 추이 비교하고 해결 방법도 알려줘')).toBe('multi');
      expect(selectExecutionMode('server status and root cause analysis together')).toBe('single');
    });

    it('should leave typo-heavy summaries to the NLQ frame path', () => {
      expect(selectExecutionMode('서벼 요약')).toBe('single');
      expect(
        selectExecutionMode(
          '서벼 요약',
          buildIntentFrame('multi')
        )
      ).toBe('multi');
      expect(selectExecutionMode('요먁 해줘 서버')).toBe('single');
    });

    it('should leave English typo variants to the NLQ frame path', () => {
      expect(selectExecutionMode('servr status summary')).toBe('single');
      expect(
        selectExecutionMode(
          'trubleshoot the issue',
          buildIntentFrame('multi')
        )
      ).toBe('multi');
      expect(selectExecutionMode('trubleshoot the issue')).toBe('single');
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

    it('should keep formatting-only report rewrites in single mode', async () => {
      const query =
        '방금 CPU 상위 3개 서버 결과를 운영 보고서용 2문장으로 다시 작성해줘';

      expect(selectExecutionMode(query)).toBe('single');
      await expect(createPrepareStep(query)({ stepNumber: 0 })).resolves.toEqual({
        activeTools: ['finalAnswer'],
        toolChoice: 'required',
      });
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
    expect(getIntentCategory('디스크 사용률 언제 90% 넘을까?')).toBe('prediction');
  });

  it('should classify math queries', () => {
    expect(getIntentCategory('12*5 계산해줘')).toBe('math');
    expect(getIntentCategory('표준편차 계산해줘')).toBe('math');
    expect(getIntentCategory('퍼센트는 어떻게 계산해?')).toBe('math');
    expect(getIntentCategory('cpu 80% 상태는 어떤가요')).toBe('metrics');
    expect(
      getIntentCategory('HAProxy가 지금 어떤 상태야? 백엔드 서버들 잘 분산되고 있어?')
    ).not.toBe('math');
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

  it('should prefer high-confidence semantic intentFrame over regex fallback', () => {
    expect(
      getIntentCategory(
        '서버 상태 알려줘',
        buildSemanticIntentFrame({
          intent: 'anomaly_detection',
          capabilityId: 'monitoring.anomaly_detection',
          confidence: 0.91,
        })
      )
    ).toBe('anomaly');

    expect(
      getIntentCategory(
        '서버 상태 알려줘',
        buildSemanticIntentFrame({
          intent: 'ops_advice',
          capabilityId: 'monitoring.ops_advice',
          confidence: 0.8,
        })
      )
    ).toBe('advisor');

    expect(
      getIntentCategory(
        '서버 상태 알려줘',
        buildSemanticIntentFrame({
          intent: 'metric_trend',
          capabilityId: 'monitoring.metric_trend',
          confidence: 0.86,
        })
      )
    ).toBe('prediction');
  });

  it('should keep regex fallback for low-confidence semantic intentFrame', () => {
    expect(
      getIntentCategory(
        '서버 상태 알려줘',
        buildSemanticIntentFrame({
          intent: 'anomaly_detection',
          capabilityId: 'monitoring.anomaly_detection',
          confidence: 0.7,
        })
      )
    ).toBe('metrics');
  });

  it('should ignore semantic categories that only contain known intents as substrings', () => {
    expect(
      getIntentCategory(
        '안녕하세요',
        buildSemanticIntentFrame({
          capabilityId: 'monitoring.not_incident_report',
          intent: 'incident_report_bypass',
          confidence: 0.94,
        })
      )
    ).toBe('general');
  });
});

describe('getLLMParamsForIntent', () => {
  it('uses deterministic parameters for metric-like lookups', () => {
    expect(getLLMParamsForIntent('metrics')).toEqual({
      temperature: 0.1,
      maxOutputTokens: 1536,
    });
    expect(getLLMParamsForIntent('serverGroup')).toEqual({
      temperature: 0.1,
      maxOutputTokens: 1536,
    });
  });

  it('keeps deeper analysis intents within the existing retry-free token budget', () => {
    expect(getLLMParamsForIntent('rca')).toEqual({
      temperature: 0.25,
      maxOutputTokens: 3072,
    });
    expect(getLLMParamsForIntent('general')).toEqual({
      temperature: 0.5,
      maxOutputTokens: 2048,
    });
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

  it('should keep intent-based tool filtering for stepNumber > 0', async () => {
    const prepare = createPrepareStep('CPU 분석해줘');
    const result = await prepare({ stepNumber: 1 });
    expect(result.activeTools).toContain('getServerMetrics');
    expect(result.activeTools).toContain('finalAnswer');
    expect(result.toolChoice).toBe('auto');
  });

  it('should route anomaly queries to anomaly tools', async () => {
    const prepare = createPrepareStep('이상 탐지해줘');
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toContain('detectAnomaliesAllServers');
    expect(result.activeTools).toContain('detectAnomalies');
    expect(result.toolChoice).toBe('required');
  });

  it('should route semantic anomaly intentFrame to anomaly tools even when regex reads as metrics', async () => {
    const prepare = createPrepareStep('서버 상태 알려줘', {
      intentFrame: buildSemanticIntentFrame({
        intent: 'anomaly_detection',
        capabilityId: 'monitoring.anomaly_detection',
        confidence: 0.91,
      }),
    });

    const result = await prepare({ stepNumber: 0 });

    expect(result.activeTools).toContain('detectAnomaliesAllServers');
    expect(result.activeTools).toContain('detectAnomalies');
    expect(result.toolChoice).toBe('required');
  });

  it('should keep regex tool policy for low-confidence semantic intentFrame', async () => {
    const prepare = createPrepareStep('서버 상태 알려줘', {
      intentFrame: buildSemanticIntentFrame({
        intent: 'anomaly_detection',
        capabilityId: 'monitoring.anomaly_detection',
        confidence: 0.7,
      }),
    });

    const result = await prepare({ stepNumber: 0 });

    expect(result.activeTools).toContain('getServerMetrics');
    expect(result.activeTools).not.toContain('detectAnomalies');
    expect(result.toolChoice).toBe('auto');
  });

  it('should route math queries to math tools', async () => {
    const prepare = createPrepareStep('12*5 계산해줘');
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toContain('evaluateMathExpression');
    expect(result.activeTools).toContain('computeSeriesStats');
    expect(result.activeTools).toContain('estimateCapacityProjection');
    expect(result.toolChoice).toBe('required');
  });

  it('should route prediction queries to trend tools including capacity projection', async () => {
    const prepare = createPrepareStep('트렌드 예측해줘');
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toContain('detectAnomaliesAllServers');
    expect(result.activeTools).toContain('predictTrends');
    expect(result.activeTools).toContain('estimateCapacityProjection');
    expect(result.toolChoice).toBe('required');
  });

  it('should route threshold crossing questions to prediction tools', async () => {
    const prepare = createPrepareStep('디스크 사용률 언제 90% 넘을까?');
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toContain('predictTrends');
    expect(result.activeTools).toContain('estimateCapacityProjection');
    expect(result.toolChoice).toBe('required');
  });

  it('should route RCA queries to incident tools', async () => {
    const prepare = createPrepareStep('장애 원인 분석');
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toContain('detectAnomaliesAllServers');
    expect(result.activeTools).toContain('findRootCause');
    expect(result.activeTools).toContain('buildIncidentTimeline');
    expect(result.toolChoice).toBe('required');
  });

  it('should route advisor queries to recommendCommands (no search tools by default)', async () => {
    const prepare = createPrepareStep('해결 방법 알려줘');
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toContain('recommendCommands');
    expect(result.activeTools).not.toContain('getServerMetrics');
    expect(result.activeTools).not.toContain('searchKnowledgeBase');
    expect(result.activeTools).not.toContain('searchWeb');
    expect(result.toolChoice).toBe('required');

    const nextStep = await prepare({ stepNumber: 1 });
    expect(nextStep.toolChoice).toBe('required');
  });

  it('should route beginner operations guidance to advisor commands', async () => {
    const prepare = createPrepareStep(
      'lb-haproxy-dc1-01 CPU가 73%인데 이거 위험한 거야? 뭘 해야 해?'
    );
    const result = await prepare({ stepNumber: 0 });

    expect(result.activeTools).toContain('recommendCommands');
    expect(result.activeTools).toContain('getServerMetrics');
    expect(result.activeTools).toContain('finalAnswer');
    expect(result.activeTools).not.toContain('computeSeriesStats');
    expect(result.toolChoice).toEqual({
      type: 'tool',
      toolName: 'getServerMetrics',
    });

    const commandStep = await prepare({ stepNumber: 1 });
    expect(commandStep.toolChoice).toEqual({
      type: 'tool',
      toolName: 'recommendCommands',
    });

    const finalStep = await prepare({ stepNumber: 2 });
    expect(finalStep).toEqual({
      activeTools: ['finalAnswer'],
      toolChoice: 'required',
    });
  });

  it('should force Advisor command evidence for named-server performance advice', async () => {
    const prepare = createPrepareStep(
      'db-mysql-dc1-primary 서버 디스크 사용량이 높은데 성능 개선 조언 해줘',
      {
        intentFrame: buildSemanticIntentFrame({
          intent: 'metric_ranking',
          capabilityId: 'monitoring.metric_ranking',
          scope: 'entity',
          targets: ['db-mysql-dc1-primary'],
          metric: 'disk',
          aggregation: 'top_n',
          executionMode: 'single',
          confidence: 0.93,
        }),
      }
    );
    const result = await prepare({ stepNumber: 0 });

    expect(result.activeTools).toContain('getServerMetrics');
    expect(result.activeTools).toContain('recommendCommands');
    expect(result.activeTools).toContain('finalAnswer');
    expect(result.toolChoice).toEqual({
      type: 'tool',
      toolName: 'getServerMetrics',
    });

    const commandStep = await prepare({ stepNumber: 1 });
    expect(commandStep.activeTools).toContain('getServerMetrics');
    expect(commandStep.activeTools).toContain('recommendCommands');
    expect(commandStep.toolChoice).toEqual({
      type: 'tool',
      toolName: 'recommendCommands',
    });

    const finalStep = await prepare({ stepNumber: 2 });
    expect(finalStep).toEqual({
      activeTools: ['finalAnswer'],
      toolChoice: 'required',
    });
  });

  it('should not short-circuit named-server advice into realtime metrics only', async () => {
    const prepare = createPrepareStep(
      'db-mysql-dc1-primary 서버 성능 개선 조언 해줘'
    );
    const result = await prepare({ stepNumber: 0 });

    expect(result.activeTools).toContain('getServerMetrics');
    expect(result.activeTools).toContain('recommendCommands');
    expect(result.activeTools).toContain('finalAnswer');
    expect(result.toolChoice).toEqual({
      type: 'tool',
      toolName: 'getServerMetrics',
    });

    const commandStep = await prepare({ stepNumber: 1 });
    expect(commandStep.activeTools).toContain('getServerMetrics');
    expect(commandStep.activeTools).toContain('recommendCommands');
    expect(commandStep.toolChoice).toEqual({
      type: 'tool',
      toolName: 'recommendCommands',
    });
  });

  it('should keep HAProxy load-distribution wording out of math tools', async () => {
    const prepare = createPrepareStep(
      'HAProxy가 지금 어떤 상태야? 백엔드 서버들 잘 분산되고 있어?'
    );
    const result = await prepare({ stepNumber: 0 });

    expect(result.activeTools).not.toContain('evaluateMathExpression');
    expect(result.activeTools).not.toContain('computeSeriesStats');
    expect(result.activeTools).toContain('getServerByGroup');
  });

  it('should inject searchKnowledgeBase into advisor tools when RAG is ON', async () => {
    const prepare = createPrepareStep('해결 방법 알려줘', {
      enableRAG: true,
    });
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toContain('searchKnowledgeBase');
    expect(result.activeTools).toContain('recommendCommands');
    expect(result.toolChoice).toBe('required');
  });

  it('should force searchKnowledgeBase for topology queries when RAG is ON', async () => {
    const prepare = createPrepareStep('현재 인프라 토폴로지 알려줘', {
      enableRAG: true,
    });
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toContain('searchKnowledgeBase');
    expect(result.activeTools).toContain('recommendCommands');
    expect(result.toolChoice).toEqual({
      type: 'tool',
      toolName: 'searchKnowledgeBase',
    });
  });

  it('should force searchKnowledgeBase for internal document path queries when RAG is ON', async () => {
    const prepare = createPrepareStep(
      'Pre-generated OTel 데이터 SSOT 문서와 파일 경로 알려줘',
      {
        enableRAG: true,
      }
    );
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toContain('searchKnowledgeBase');
    expect(result.toolChoice).toEqual({
      type: 'tool',
      toolName: 'searchKnowledgeBase',
    });
  });

  it('should omit searchKnowledgeBase after the forced topology lookup step', async () => {
    const prepare = createPrepareStep('현재 인프라 토폴로지 알려줘', {
      enableRAG: true,
    });
    const result = await prepare({ stepNumber: 1 });
    expect(result.activeTools).not.toContain('searchKnowledgeBase');
    expect(result.activeTools).toContain('recommendCommands');
    expect(result.activeTools).toContain('finalAnswer');
    expect(result.toolChoice).toBe('required');
  });

  it('should omit searchKnowledgeBase when RAG is disabled', async () => {
    const prepare = createPrepareStep('해결 방법 알려줘', {
      enableRAG: false,
    });
    const result = await prepare({ stepNumber: 0 });
    expect((result as { activeTools?: string[] }).activeTools).not.toContain(
      'searchKnowledgeBase'
    );
    expect((result as { activeTools?: string[] }).activeTools).toContain(
      'recommendCommands'
    );
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

  it('should force getServerMetrics for direct current metric queries on a specific server', async () => {
    const prepare = createPrepareStep('cache-redis-dc1-01 메모리 사용률 몇 %야?');
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toEqual(['getServerMetrics', 'finalAnswer']);
    expect(result.toolChoice).toEqual({
      type: 'tool',
      toolName: 'getServerMetrics',
    });
  });

  it('should finalize direct current metric queries after the forced metric lookup step', async () => {
    const prepare = createPrepareStep('cache-redis-dc1-01 메모리 사용률 몇 %야?');
    const result = await prepare({ stepNumber: 1 });
    expect(result.activeTools).toEqual(['finalAnswer']);
    expect(result.toolChoice).toBe('required');
  });

  it('should not force getServerMetrics for historical metric aggregation queries', async () => {
    const prepare = createPrepareStep('cache-redis-dc1-01 지난 6시간 메모리 평균 알려줘');
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).not.toEqual(['getServerMetrics', 'finalAnswer']);
    expect(result.toolChoice).not.toEqual({
      type: 'tool',
      toolName: 'getServerMetrics',
    });
  });

  it('should force getServerMetricsAdvanced for current metric ranking queries', async () => {
    const prepare = createPrepareStep('CPU가 가장 높은 서버 3대 알려줘');
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toEqual(['getServerMetricsAdvanced', 'finalAnswer']);
    expect(result.toolChoice).toEqual({
      type: 'tool',
      toolName: 'getServerMetricsAdvanced',
    });
  });

  it('should force getServerMetricsAdvanced for current memory usage ranking queries', async () => {
    const prepare = createPrepareStep('현재 메모리 사용률 상위 3대 알려줘');
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toEqual([
      'getServerMetricsAdvanced',
      'finalAnswer',
    ]);
    expect(result.toolChoice).toEqual({
      type: 'tool',
      toolName: 'getServerMetricsAdvanced',
    });
  });

  it('should force getServerMetricsAdvanced for actionable memory TOP-N ranking queries', async () => {
    const prepare = createPrepareStep('메모리 높은 서버 TOP 3, 조치 방법도 알려줘');
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toEqual([
      'getServerMetricsAdvanced',
      'finalAnswer',
    ]);
    expect(result.toolChoice).toEqual({
      type: 'tool',
      toolName: 'getServerMetricsAdvanced',
    });
  });

  it('should force getServerMetricsAdvanced for ranking plus trend queries', async () => {
    const prepare = createPrepareStep('메모리 사용률 상위 3개 서버와 추세를 봐줘');
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toEqual([
      'getServerMetricsAdvanced',
      'finalAnswer',
    ]);
    expect(result.toolChoice).toEqual({
      type: 'tool',
      toolName: 'getServerMetricsAdvanced',
    });
  });

  it('should force getServerMetricsAdvanced for AZ load-balance queries', async () => {
    const prepare = createPrepareStep(
      'DC1-AZ1/AZ2/AZ3 구역별 부하 균형이 잡혀 있어?'
    );
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toEqual([
      'getServerMetricsAdvanced',
      'finalAnswer',
    ]);
    expect(result.toolChoice).toEqual({
      type: 'tool',
      toolName: 'getServerMetricsAdvanced',
    });
  });

  it('should force getServerMetricsAdvanced for availability-zone load-balance phrasing', async () => {
    const prepare = createPrepareStep('가용 영역별 부하 균형을 비교해줘');
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toEqual([
      'getServerMetricsAdvanced',
      'finalAnswer',
    ]);
    expect(result.toolChoice).toEqual({
      type: 'tool',
      toolName: 'getServerMetricsAdvanced',
    });
  });

  it('should finalize metric ranking queries after the forced advanced lookup step', async () => {
    const prepare = createPrepareStep('메모리 상위 3대 알려줘');
    const result = await prepare({ stepNumber: 1 });
    expect(result.activeTools).toEqual(['finalAnswer']);
    expect(result.toolChoice).toBe('required');
  });

  it('should not force ranking path for historical ranking queries', async () => {
    const prepare = createPrepareStep('지난 6시간 CPU가 가장 높았던 서버 알려줘');
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).not.toEqual([
      'getServerMetricsAdvanced',
      'finalAnswer',
    ]);
    expect(result.toolChoice).not.toEqual({
      type: 'tool',
      toolName: 'getServerMetricsAdvanced',
    });
  });

  it('should inject searchWeb into pattern tools when enableWebSearch is true', async () => {
    const prepare = createPrepareStep('CPU 상태', { enableWebSearch: true });
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toContain('searchWeb');
    expect(result.activeTools).toContain('getServerMetrics'); // 의도 기반 도구 보존
    expect(result.toolChoice).toBe('auto'); // LLM이 자율적으로 판단
  });

  it('should not include searchWeb when enableWebSearch is false', async () => {
    const prepare = createPrepareStep('해결 방법 알려줘', { enableWebSearch: false });
    const result = await prepare({ stepNumber: 0 });
    expect((result as { activeTools?: string[] }).activeTools).toContain('recommendCommands');
    expect((result as { activeTools?: string[] }).activeTools).not.toContain('searchWeb');
    expect(result.toolChoice).toBe('required');
  });

  it('should default to metric tools for generic queries', async () => {
    const prepare = createPrepareStep('서버 확인');
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toContain('getServerMetrics');
    expect(result.toolChoice).toBe('auto');
  });

  it('should keep off-domain general queries on finalAnswer-only path', async () => {
    const prepare = createPrepareStep('오늘 운세 알려줘');
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toEqual(['finalAnswer']);
    expect(result.toolChoice).toBe('required');
  });

  it('should force searchWeb for realtime off-domain queries when web search is ON', async () => {
    const prepare = createPrepareStep('오늘 서울 날씨 알려줘', {
      enableWebSearch: true,
    });
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toEqual(['searchWeb', 'finalAnswer']);
    expect(result.toolChoice).toEqual({ type: 'tool', toolName: 'searchWeb' });
  });

  it('should inject searchWeb into RCA tools when web search is ON', async () => {
    const prepare = createPrepareStep('장애 원인 분석', { enableWebSearch: true });
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toContain('findRootCause'); // 의도 도구 보존
    expect(result.activeTools).toContain('searchWeb'); // 웹 검색 주입
    expect(result.toolChoice).toBe('required'); // RCA 패턴은 원래 required
  });

  it('should inject searchKnowledgeBase into non-advisor tools when RAG is ON', async () => {
    const prepare = createPrepareStep('CPU 상태', { enableRAG: true });
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toContain('getServerMetrics'); // 의도 도구 보존
    expect(result.activeTools).toContain('searchKnowledgeBase'); // RAG 주입
    expect(result.toolChoice).toBe('auto'); // LLM이 자율적으로 판단
  });

  it('should inject both searchWeb and searchKnowledgeBase when both toggles ON', async () => {
    const prepare = createPrepareStep('이상 탐지해줘', {
      enableWebSearch: true,
      enableRAG: true,
    });
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toContain('detectAnomalies'); // 의도 도구 보존
    expect(result.activeTools).toContain('searchWeb');
    expect(result.activeTools).toContain('searchKnowledgeBase');
    expect(result.toolChoice).toBe('required'); // anomaly 패턴은 원래 required
  });

  it('should force searchWeb toolChoice when web search ON + external info query', async () => {
    const prepare = createPrepareStep('Redis 최신 보안 패치 알려줘', {
      enableWebSearch: true,
    });
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toContain('searchWeb');
    expect(result.toolChoice).toEqual({ type: 'tool', toolName: 'searchWeb' });
  });

  it('should omit searchWeb after the forced web lookup step', async () => {
    const prepare = createPrepareStep('Redis 최신 보안 패치 알려줘', {
      enableWebSearch: true,
    });
    const result = await prepare({ stepNumber: 1 });
    expect(result.activeTools).not.toContain('searchWeb');
    expect(result.activeTools).toContain('recommendCommands');
    expect(result.activeTools).toContain('finalAnswer');
    expect(result.toolChoice).toBe('required');
  });

  it('should not force searchWeb for internal monitoring queries even with toggle ON', async () => {
    const prepare = createPrepareStep('서버 상태 확인', {
      enableWebSearch: true,
    });
    const result = await prepare({ stepNumber: 0 });
    expect(result.activeTools).toContain('searchWeb');
    // 내부 모니터링 쿼리 → 강제 안 함, 기존 toolChoice 유지
    expect(result.toolChoice).not.toEqual({ type: 'tool', toolName: 'searchWeb' });
  });
});

// ============================================================================
// shouldForceWebSearch
// ============================================================================

describe('shouldForceWebSearch', () => {
  it('should return true for queries with external info indicators', () => {
    expect(shouldForceWebSearch('최신 보안 패치')).toBe(true);
    expect(shouldForceWebSearch('Redis latest version')).toBe(true);
    expect(shouldForceWebSearch('CVE-2025-1234 확인')).toBe(true);
    expect(shouldForceWebSearch('공식 문서 확인')).toBe(true);
    expect(shouldForceWebSearch('2026 릴리스 노트')).toBe(true);
    expect(shouldForceWebSearch('documentation for nginx')).toBe(true);
    expect(shouldForceWebSearch('Next.js stable major 알려줘')).toBe(true);
    expect(shouldForceWebSearch('오늘 서울 날씨 알려줘')).toBe(true);
    expect(shouldForceWebSearch('환율 알려줘')).toBe(true);
  });

  it('should return false for internal monitoring queries', () => {
    expect(shouldForceWebSearch('서버 상태 확인')).toBe(false);
    expect(shouldForceWebSearch('CPU 사용률 알려줘')).toBe(false);
    expect(shouldForceWebSearch('메모리 분석해줘')).toBe(false);
    expect(shouldForceWebSearch('디스크 용량')).toBe(false);
  });
});
