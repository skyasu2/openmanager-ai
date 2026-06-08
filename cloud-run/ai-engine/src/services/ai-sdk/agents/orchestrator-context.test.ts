import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAppendAffectedServers,
  mockAppendAnomalies,
  mockAppendMetrics,
  mockAppendRecommendedCommands,
  mockUpdateSessionContext,
  mockClassifyRoutingIntentWithLLM,
  mockSelectTextModel,
} = vi.hoisted(() => ({
  mockAppendAffectedServers: vi.fn(),
  mockAppendAnomalies: vi.fn(),
  mockAppendMetrics: vi.fn(),
  mockAppendRecommendedCommands: vi.fn(),
  mockUpdateSessionContext: vi.fn(),
  mockClassifyRoutingIntentWithLLM: vi.fn(),
  mockSelectTextModel: vi.fn(),
}));

vi.mock('./context-store', () => ({
  appendAffectedServers: mockAppendAffectedServers,
  appendAnomalies: mockAppendAnomalies,
  appendMetrics: mockAppendMetrics,
  appendRecommendedCommands: mockAppendRecommendedCommands,
  updateSessionContext: mockUpdateSessionContext,
}));

vi.mock('./vision-agent', () => ({
  isVisionQuery: vi.fn((query: string) =>
    /스크린샷|이미지|대시보드|screenshot|image|dashboard/i.test(query)
  ),
}));

vi.mock('../routing/llm-intent-classifier', () => ({
  classifyRoutingIntentWithLLM: (...args: unknown[]) =>
    mockClassifyRoutingIntentWithLLM(...args),
}));

vi.mock('./config/agent-model-selectors', () => ({
  selectTextModel: (...args: unknown[]) => mockSelectTextModel(...args),
}));

import {
  preFilterQuery,
  preFilterQueryWithLLM,
  saveAgentFindingsToContext,
} from './orchestrator-context';
import {
  getRoundRobinCursor,
  resetRoundRobinCursor,
} from './config/round-robin-provider-selector';

beforeEach(() => {
  vi.clearAllMocks();
  mockClassifyRoutingIntentWithLLM.mockReset();
  mockSelectTextModel.mockReset();
  resetRoundRobinCursor();
  mockSelectTextModel.mockReturnValue({
    model: { modelId: 'test-router-model' },
    provider: 'groq',
    modelId: 'test-router-model',
    capabilities: {},
  });
});

describe('preFilterQuery', () => {
  it('returns direct response for greetings', () => {
    const result = preFilterQuery('안녕하세요');
    expect(result.shouldHandoff).toBe(false);
    expect(result.directResponse).toContain('서버 모니터링 AI');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('returns generic Metrics Query suggestion for simple server metric query', () => {
    const result = preFilterQuery('서버 상태 알려줘');
    expect(result.shouldHandoff).toBe(true);
    expect(result.suggestedAgent).toBe('Metrics Query Agent');
    expect(result.confidence).toBe(0.86);
  });

  it('routes attached visual intent to Vision Agent when image/file is attached', () => {
    const result = preFilterQuery('CPU 차트 첨부해서 확인해줘', { hasImageAttachments: true });

    expect(result.shouldHandoff).toBe(true);
    expect(result.suggestedAgent).toBe('Vision Agent');
    expect(result.confidence).toBe(0.92);
  });

  it('routes Playwright screenshot attachments to Vision Agent without server keywords', () => {
    const result = preFilterQuery('첨부된 Playwright 스크린샷을 분석해줘', {
      hasImageAttachments: true,
    });

    expect(result.shouldHandoff).toBe(true);
    expect(result.suggestedAgent).toBe('Vision Agent');
    expect(result.confidence).toBe(0.92);
  });

  it('prefers analyst/reporter/advisor with high confidence for clear intent', () => {
    expect(preFilterQuery('CPU 급증 원인 분석해줘').suggestedAgent).toBe('Analyst Agent');
    expect(preFilterQuery('장애 보고서 작성해줘').suggestedAgent).toBe('Reporter Agent');
    expect(preFilterQuery('메모리 부족 해결 방법 알려줘').suggestedAgent).toBe('Advisor Agent');
  });

  it('routes current metric why questions to Analyst instead of generic metric routing', () => {
    const result = preFilterQuery('lb-haproxy-dc1-01 CPU 69% 원인이 뭐야?');

    expect(result.shouldHandoff).toBe(true);
    expect(result.suggestedAgent).toBe('Analyst Agent');
    expect(result.confidence).toBe(0.88);
  });

  it.each([
    'db-mysql-dc1-backup 디스크 73% 왜 이렇게 높아?',
    'db-mysql-dc1-backup 디스크 73% 왜 높은지 알려줘',
    'api-was-dc1-01 CPU 81% 이유가 뭐야?',
    'cache-redis-dc1-01 메모리 사용률 91% 때문에 느린 거야?',
    'storage-nfs-dc1-01 disk 88% why so high?',
  ])(
    'routes metric RCA wording variants to Analyst instead of current-metric fallback: %s',
    (query) => {
      const result = preFilterQuery(query);

      expect(result.shouldHandoff).toBe(true);
      expect(result.suggestedAgent).toBe('Analyst Agent');
      expect(result.confidence).toBe(0.88);
    }
  );

  it('answers clear service command questions directly without generic metric handoff', () => {
    const result = preFilterQuery(
      'HAProxy에서 현재 연결된 백엔드 서버 목록이랑 상태 확인하는 명령어 알려줘'
    );

    expect(result.shouldHandoff).toBe(false);
    expect(result.directResponse).toContain('echo "show stat"');
    expect(result.directResponse).toContain('systemctl status haproxy');
    expect(result.directResponse).not.toMatch(/mysql|redis-cli|nginx\s+-t|findmnt/i);
  });

  it('answers Nginx and NFS command guidance directly from the command catalog', () => {
    const nginx = preFilterQuery(
      'Nginx 액세스 로그에서 5xx 에러가 많이 나는 경로 분석하는 방법 알려줘'
    );
    const nfs = preFilterQuery(
      'NFS 마운트가 끊겼을 때 확인하고 재마운트하는 순서 알려줘'
    );

    expect(nginx.shouldHandoff).toBe(false);
    expect(nginx.directResponse).toContain('/var/log/nginx/access.log');
    expect(nginx.directResponse).toContain("awk '$9 ~ /^5/");
    expect(nfs.shouldHandoff).toBe(false);
    expect(nfs.directResponse).toContain('findmnt -t nfs');
    expect(nfs.directResponse).toContain('showmount -e <nfs-server>');
    expect(nfs.directResponse).toContain('mount -t nfs');
  });

  it('answers disk capacity command guidance with filesystem checks before service commands', () => {
    const result = preFilterQuery(
      'db-mysql-dc1-primary 디스크 86%, 용량 확보 명령어는?'
    );

    expect(result.shouldHandoff).toBe(false);
    expect(result.directResponse).toContain('df -h');
    expect(result.directResponse).toContain('du -xhd1 / 2>/dev/null | sort -hr | head -20');
    expect(result.directResponse).not.toContain('SHOW FULL PROCESSLIST');
  });

  it('answers first-on-call alert checklist directly for beginner ops guidance', () => {
    const result = preFilterQuery(
      '처음 운영 당직인데 알림이 울리면 어떤 순서로 확인해야 해?'
    );

    expect(result.shouldHandoff).toBe(false);
    expect(result.directResponse).toContain('1. 알림 내용');
    expect(result.directResponse).toContain('2. 서버 상태');
    expect(result.directResponse).toContain('3. 관련 로그');
    expect(result.directResponse).toContain('처음부터 재시작하지 말고');
  });

  it('does not send formatting-only report rewrites to Reporter Agent', () => {
    const result = preFilterQuery(
      '방금 CPU 상위 3개 서버 결과를 운영 보고서용 2문장으로 다시 작성해줘'
    );

    expect(result.shouldHandoff).toBe(true);
    expect(result.suggestedAgent).toBe('Metrics Query Agent');
    expect(result.confidence).toBe(0.86);
  });

  it('routes normal-range server lists to Metrics Query before generic status summary', () => {
    const result = preFilterQuery('현재 정상 범위인 서버 목록 보여줘');

    expect(result.shouldHandoff).toBe(true);
    expect(result.suggestedAgent).toBe('Metrics Query Agent');
    expect(result.confidence).toBe(0.88);
  });

  it.each([
    '재시작해야 할 서버 있어?',
    '재시작이 필요해?',
  ])('routes restart-needed lookup wording to Metrics Query: %s', (query) => {
    const result = preFilterQuery(query);

    expect(result.shouldHandoff).toBe(true);
    expect(result.suggestedAgent).toBe('Metrics Query Agent');
    expect(result.confidence).toBe(0.88);
  });

  it('keeps restart procedure wording on Advisor routing', () => {
    const result = preFilterQuery('서버 재시작 방법 알려줘');

    expect(result.shouldHandoff).toBe(true);
    expect(result.suggestedAgent).toBe('Advisor Agent');
  });

  it('routes topology queries to Advisor Agent with high confidence', () => {
    const result = preFilterQuery('현재 인프라 토폴로지 알려줘. 관련된 운영 가이드도 연결해줘');
    expect(result.shouldHandoff).toBe(true);
    expect(result.suggestedAgent).toBe('Advisor Agent');
    expect(result.confidence).toBe(0.9);
  });

  it('routes runtime-only advisor signals without evaluating role matchPatterns', () => {
    const result = preFilterQuery('server runbook 절차 알려줘');

    expect(result.shouldHandoff).toBe(true);
    expect(result.suggestedAgent).toBe('Advisor Agent');
    expect(result.confidence).toBe(0.9);
  });

  it('provides fallback agent hint for composite infra query', () => {
    const result = preFilterQuery('서버 상태와 원인 분석을 비교하고 해결 방법도 알려줘');
    expect(result.shouldHandoff).toBe(true);
    expect(result.suggestedAgent).toBeDefined();
    expect(result.confidence).toBe(0.85);
  });

  describe('unsupported metric directResponse', () => {
    const gpuCases = [
      'GPU 사용률이 가장 높은 서버 3대 알려줘',
      'gpu 사용량 상위 서버',
      'CUDA 점유율 순위',
      'VRAM 사용률 높은 서버',
    ];

    it.each(gpuCases)('blocks GPU query "%s" with directResponse', (query) => {
      const result = preFilterQuery(query);
      expect(result.shouldHandoff).toBe(false);
      expect(result.directResponse).toContain('GPU');
      expect(result.directResponse).toContain('지원하지 않는 지표');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('blocks Kubernetes pod restart query', () => {
      const result = preFilterQuery('pod restart 횟수가 많은 서버 알려줘');
      expect(result.shouldHandoff).toBe(false);
      expect(result.directResponse).toContain('지원하지 않는 지표');
    });

    it('keeps attached unsupported-metric screenshots on Vision routing', () => {
      const result = preFilterQuery('첨부된 GPU 그래프 분석해줘', {
        hasImageAttachments: true,
      });

      expect(result.shouldHandoff).toBe(true);
      expect(result.suggestedAgent).toBe('Vision Agent');
      expect(result.confidence).toBe(0.92);
    });

    it('passes through supported metric queries unchanged', () => {
      const supported = [
        'CPU 사용률 상위 서버',
        '메모리 높은 서버 3대',
        '네트워크 사용률 상위 서버 3대',
        '디스크 사용량 60% 이상 서버',
      ];
      for (const q of supported) {
        const result = preFilterQuery(q);
        expect(result.shouldHandoff).toBe(true);
      }
    });
  });

  describe('ambiguous status query clarification', () => {
    const ambiguousCases = [
      '상태 어때?',
      '지금 상태 어때?',
      '현황은?',
      '상황 어때',
    ];

    it.each(ambiguousCases)('returns directResponse for "%s"', (query) => {
      const result = preFilterQuery(query);
      expect(result.shouldHandoff).toBe(false);
      expect(result.directResponse).toContain('전체 서버 상태 알려줘');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    const specificCases = [
      '전체 서버 상태 어때?',
      '서버 상태 알려줘',
      'DB 그룹 현황 알려줘',
      'cache-redis-dc1-01 상태 어때?',
      'CPU 상태 어때?',
      '경고 상태 서버 목록',
    ];

    it.each(specificCases)('passes through specific query "%s"', (query) => {
      const result = preFilterQuery(query);
      expect(result.shouldHandoff).toBe(true);
    });
  });

  it('keeps pre-filter handoff confidence out of the LLM routing gray band', () => {
    const queries = [
      '서버 상태 알려줘',
      'CPU 급증 원인 분석해줘',
      '장애 보고서 작성해줘',
      '메모리 부족 해결 방법 알려줘',
      '서버 상태와 원인 분석을 비교하고 해결 방법도 알려줘',
      'unknown off topic',
    ];

    for (const query of queries) {
      const result = preFilterQuery(query);
      const inGrayBand = result.confidence > 0.65 && result.confidence < 0.85;
      expect(inGrayBand).toBe(false);
    }
  });

  it('keeps high-confidence deterministic routing on the sync fast path', async () => {
    const result = await preFilterQueryWithLLM('서버 상태 알려줘');

    expect(result).toEqual(preFilterQuery('서버 상태 알려줘'));
    expect(mockClassifyRoutingIntentWithLLM).not.toHaveBeenCalled();
  });

  it.each([
    '이상 없는 서버 목록',
    '이상 없는 서버들의 트렌드 변화',
    '문제 없는 서버만 보여줘',
  ])(
    'keeps inverse status filter queries on deterministic Metrics Query routing: %s',
    async (query) => {
      mockClassifyRoutingIntentWithLLM.mockResolvedValueOnce({
        suggestedAgent: 'Analyst Agent',
        confidence: 0.91,
      });

      const result = await preFilterQueryWithLLM(query);

      expect(result).toEqual(preFilterQuery(query));
      expect(result.suggestedAgent).toBe('Metrics Query Agent');
      expect(result.confidence).toBe(0.88);
      expect(mockSelectTextModel).not.toHaveBeenCalled();
      expect(mockClassifyRoutingIntentWithLLM).not.toHaveBeenCalled();
    }
  );

  it('uses high-confidence LLM classification for unclear routing expressions', async () => {
    mockClassifyRoutingIntentWithLLM.mockResolvedValueOnce({
      suggestedAgent: 'Metrics Query Agent',
      confidence: 0.91,
    });

    const result = await preFilterQueryWithLLM('DB vs Cache 비교');

    expect(result).toEqual({
      shouldHandoff: true,
      suggestedAgent: 'Metrics Query Agent',
      confidence: 0.91,
    });
  });

  it('keeps deterministic fallback when LLM confidence is below threshold', async () => {
    mockClassifyRoutingIntentWithLLM.mockResolvedValueOnce({
      suggestedAgent: 'Advisor Agent',
      confidence: 0.6,
    });

    const result = await preFilterQueryWithLLM('재시작이 필요해?');

    expect(result).toEqual(preFilterQuery('재시작이 필요해?'));
  });

  it('keeps deterministic fallback when LLM classification fails', async () => {
    mockClassifyRoutingIntentWithLLM.mockResolvedValueOnce(null);

    const result = await preFilterQueryWithLLM('새로운 운영 표현');

    expect(result).toEqual(preFilterQuery('새로운 운영 표현'));
  });

  it('skips LLM classification and restores provider rotation when no router model is available', async () => {
    mockSelectTextModel.mockReturnValueOnce(null);

    const result = await preFilterQueryWithLLM('DB vs Cache 비교');

    expect(result).toEqual(preFilterQuery('DB vs Cache 비교'));
    expect(mockSelectTextModel).toHaveBeenCalledTimes(1);
    expect(mockClassifyRoutingIntentWithLLM).not.toHaveBeenCalled();
    expect(getRoundRobinCursor()).toBe(0);
  });
});

describe('saveAgentFindingsToContext', () => {
  it('prefers structured findings over legacy response regex extraction', async () => {
    const decision = await saveAgentFindingsToContext(
      'session-structured',
      'Reporter Agent',
      '서버: regex-server-01 CPU: 99%',
      {
        agentName: 'Reporter Agent',
        affectedServers: ['web-01'],
        metrics: [
          {
            name: 'cpu',
            value: 77,
            unit: '%',
            server: 'web-01',
            timeWindow: 'recent',
          },
        ],
        anomalies: [
          {
            server: 'web-01',
            metric: 'cpu',
            severity: 'critical',
            summary: 'CPU saturation',
            value: 97,
            threshold: 90,
          },
        ],
        recommendations: [
          {
            action: 'top -H -p <pid>',
            safety: 'read_only',
          },
        ],
      }
    );

    expect(decision).toEqual({
      findingsSource: 'structured',
      reasonCodes: ['findings_structured'],
    });
    expect(mockAppendAffectedServers).toHaveBeenCalledWith('session-structured', ['web-01']);
    expect(mockAppendMetrics).toHaveBeenCalledWith(
      'session-structured',
      expect.arrayContaining([
        expect.objectContaining({
          serverId: 'web-01',
          serverName: 'web-01',
          cpu: 77,
          status: 'warning',
        }),
      ])
    );
    expect(mockAppendAnomalies).toHaveBeenCalledWith(
      'session-structured',
      expect.arrayContaining([
        expect.objectContaining({
          serverId: 'web-01',
          metric: 'cpu',
          severity: 'critical',
          description: 'CPU saturation',
        }),
      ])
    );
    expect(mockAppendRecommendedCommands).toHaveBeenCalledWith(
      'session-structured',
      ['top -H -p <pid>']
    );
    expect(mockAppendAffectedServers).not.toHaveBeenCalledWith(
      'session-structured',
      expect.arrayContaining(['regex-server-01'])
    );
  });

  it('uses legacy text regex fallback when structured findings are absent', async () => {
    const decision = await saveAgentFindingsToContext(
      'session-legacy',
      'Metrics Query Agent',
      '서버: web-server-01 CPU: 91%'
    );

    expect(decision).toEqual({
      findingsSource: 'legacy_text_regex',
      reasonCodes: ['findings_legacy_regex'],
    });
    expect(mockAppendAffectedServers).toHaveBeenCalledWith(
      'session-legacy',
      ['web-server-01']
    );
  });

  it('does not save zero-valued CPU anomalies from metric correlation wording', async () => {
    const decision = await saveAgentFindingsToContext(
      'session-analyst',
      'Analyst Agent',
      [
        'storage-nfs-dc1-01 서버의 디스크 사용률이 높습니다. 현재 디스크 사용률은 82%로 임계값 80%를 초과했습니다.',
        '분석 결과에 따르면 디스크 사용률과 CPU 사용률 간에 강한 양의 상관관계(r=0.96)가 있습니다.',
      ].join('\n')
    );

    expect(decision).toEqual({
      findingsSource: 'legacy_text_regex',
      reasonCodes: ['findings_legacy_regex'],
    });
    expect(mockAppendAnomalies).toHaveBeenCalledTimes(1);

    const anomalies = mockAppendAnomalies.mock.calls[0]?.[1];
    expect(anomalies).toEqual([
      expect.objectContaining({
        serverId: 'storage-nfs-dc1-01',
        serverName: 'storage-nfs-dc1-01',
        metric: 'disk',
        value: 82,
      }),
    ]);
    expect(anomalies).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: 'cpu', value: 0 }),
      ])
    );
  });
});
