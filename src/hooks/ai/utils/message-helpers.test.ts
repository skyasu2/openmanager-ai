import type { UIMessage } from 'ai';
import { describe, expect, it } from 'vitest';
import { normalizeAIResponse } from '@/lib/ai/utils/message-normalizer';
import { transformMessages } from './message-helpers';

type RagSource = {
  title: string;
  similarity: number;
  sourceType: string;
  category?: string;
  url?: string;
};

function createMessage(params: {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  metadata?: {
    traceId?: string;
    ragSources?: RagSource[];
    retrieval?: {
      retrievalEnabled: boolean;
      retrievalUsed: boolean;
      retrievalMode: 'off' | 'lite' | 'text-only' | 'cosine-neighbor';
      suppressedReason?:
        | 'disabled'
        | 'not_needed'
        | 'no_results'
        | 'budget_guard'
        | 'unavailable';
      evidenceCount: number;
      webUsed: boolean;
    };
    enableRAG?: boolean;
    enableWebSearch?: boolean | 'auto';
    analysisMode?: 'auto' | 'thinking';
    toolsCalled?: string[];
    provider?: string;
    modelId?: string;
    providerAttempts?: Array<{
      provider: string;
      modelId?: string;
      attempt?: number;
      durationMs?: number;
      error?: string;
    }>;
    usedFallback?: boolean;
    fallbackReason?: string;
    ttfbMs?: number;
    handoffHistory?: Array<{
      from: string;
      to: string;
      reason?: string;
    }>;
    assistantResponseView?: {
      summary: string;
      details?: string | null;
      shouldCollapse?: boolean;
    };
    routeDecision?: {
      intent: 'chat' | 'artifact' | 'job' | 'clarification';
      executionPath: 'stream' | 'job' | 'client-artifact';
      mode?: 'single' | 'multi';
      artifactKind?:
        | 'server-snapshot'
        | 'incident-report'
        | 'monitoring-analysis';
      reasonCodes: string[];
      ruleVersion: string;
      decidedBy: 'frontend' | 'bff' | 'cloud-run';
    };
    assistantPlan?: {
      kind: 'chat' | 'artifact' | 'clarification';
      planVersion: string;
      routeDecision: {
        intent: 'chat' | 'artifact' | 'job' | 'clarification';
        executionPath: 'stream' | 'job' | 'client-artifact';
        mode?: 'single' | 'multi';
        artifactKind?:
          | 'server-snapshot'
          | 'incident-report'
          | 'monitoring-analysis';
        reasonCodes: string[];
        ruleVersion: string;
        decidedBy: 'frontend' | 'bff' | 'cloud-run';
      };
      executionPath: 'stream' | 'job' | 'client-artifact';
      stream: boolean;
      job: boolean;
      artifactKind?:
        | 'server-snapshot'
        | 'incident-report'
        | 'monitoring-analysis';
      reasonCodes: string[];
      decidedBy: 'frontend' | 'bff' | 'cloud-run';
    };
    assistantResult?: {
      kind: 'chat' | 'artifact' | 'error';
      resultVersion: string;
      routeDecision?: {
        intent: 'chat' | 'artifact' | 'job' | 'clarification';
        executionPath: 'stream' | 'job' | 'client-artifact';
        mode?: 'single' | 'multi';
        artifactKind?:
          | 'server-snapshot'
          | 'incident-report'
          | 'monitoring-analysis';
        reasonCodes: string[];
        ruleVersion: string;
        decidedBy: 'frontend' | 'bff' | 'cloud-run';
      };
      status: 'completed' | 'failed' | 'partial';
      artifactKind?:
        | 'server-snapshot'
        | 'incident-report'
        | 'monitoring-analysis';
    };
    toolResultSummaries?: Array<{
      toolName: string;
      label: string;
      summary: string;
      preview?: string;
      status: 'completed' | 'failed';
    }>;
    type?: 'guidance';
    artifactIntentReason?: string;
    artifactIntentTarget?: 'incident-report' | 'monitoring-analysis';
    guidanceCta?: {
      target: 'incident-report' | 'monitoring-analysis';
      label: string;
    };
  };
  parts?: unknown[];
}): UIMessage {
  return {
    id: params.id,
    role: params.role,
    parts: params.parts ?? [{ type: 'text', text: params.text }],
    ...(params.metadata ? { metadata: params.metadata } : {}),
  } as unknown as UIMessage;
}

describe('transformMessages', () => {
  it('keeps metadata ragSources with Cloud Run engine in job-queue mode', () => {
    const ragSources: RagSource[] = [
      {
        title: 'incident memory pressure',
        similarity: 0.91,
        sourceType: 'vector',
        category: 'incident',
      },
    ];

    const messages = transformMessages(
      [
        createMessage({ id: 'u1', role: 'user', text: 'why memory issue?' }),
        createMessage({
          id: 'a1',
          role: 'assistant',
          text: 'analysis result',
          metadata: { ragSources, traceId: 'trace-1' },
        }),
      ],
      { isLoading: false, currentMode: 'job-queue' }
    );

    const assistant = messages.find((m) => m.id === 'a1');
    expect(assistant).toBeDefined();
    expect(assistant?.metadata?.analysisBasis?.engine).toBe('Cloud Run AI');
    expect(assistant?.metadata?.analysisBasis?.ragSources).toEqual(ragSources);
    expect(assistant?.metadata?.analysisBasis?.dataSource).toContain(
      'RAG 지식베이스 검색'
    );
    expect(assistant?.metadata?.analysisBasis?.ragUsed).toBe(true);
  });

  it('preserves routeDecision metadata for assistant messages', () => {
    const routeDecision = {
      intent: 'chat' as const,
      executionPath: 'stream' as const,
      mode: 'single' as const,
      reasonCodes: ['auto_complexity'],
      ruleVersion: '2026-05-03-v1',
      decidedBy: 'cloud-run' as const,
    };

    const messages = transformMessages(
      [
        createMessage({ id: 'u1', role: 'user', text: 'CPU 알려줘' }),
        createMessage({
          id: 'a1',
          role: 'assistant',
          text: 'CPU는 정상입니다.',
          metadata: { routeDecision },
        }),
      ],
      { isLoading: false, currentMode: 'streaming' }
    );

    expect(
      messages.find((m) => m.id === 'a1')?.metadata?.routeDecision
    ).toEqual(routeDecision);
  });

  it('labels validated semantic peak evidence instead of generic chat source', () => {
    const semanticQueryTrace = {
      originalQuery: '제일 버거웠던 때를 load 기준으로 알려줘',
      selectedDomain: 'openmanager-monitoring',
      selectedCapability: 'monitoring.metric_peak',
      selectedEvidenceProvider: 'monitoring-peak-metric',
      evidenceAvailable: true,
      clarificationRequired: false,
      reasonCodes: ['semantic_frame_evidence_validated'],
    };

    const messages = transformMessages(
      [
        createMessage({
          id: 'u1',
          role: 'user',
          text: '제일 버거웠던 때를 load 기준으로 알려줘',
        }),
        createMessage({
          id: 'a1',
          role: 'assistant',
          text: 'load1 피크는 03:50입니다.',
          metadata: { semanticQueryTrace },
        }),
      ],
      { isLoading: false, currentMode: 'streaming' }
    );

    const assistant = messages.find((m) => m.id === 'a1');

    expect(assistant?.metadata?.semanticQueryTrace).toEqual(semanticQueryTrace);
    expect(assistant?.metadata?.analysisBasis?.dataSource).toBe(
      '모니터링 피크 지표 근거'
    );
  });

  it('preserves AssistantPlan and AssistantResult facade metadata for assistant messages', () => {
    const routeDecision = {
      intent: 'chat' as const,
      executionPath: 'stream' as const,
      mode: 'single' as const,
      reasonCodes: ['auto_complexity'],
      ruleVersion: '2026-05-03-v1',
      decidedBy: 'cloud-run' as const,
    };
    const assistantPlan = {
      kind: 'chat' as const,
      planVersion: '2026-05-03-v1',
      routeDecision,
      executionPath: 'stream' as const,
      stream: true,
      job: false,
      reasonCodes: ['auto_complexity'],
      decidedBy: 'cloud-run' as const,
    };
    const assistantResult = {
      kind: 'chat' as const,
      resultVersion: '2026-05-03-v1',
      routeDecision,
      status: 'completed' as const,
    };

    const messages = transformMessages(
      [
        createMessage({ id: 'u1', role: 'user', text: 'CPU 알려줘' }),
        createMessage({
          id: 'a1',
          role: 'assistant',
          text: 'CPU는 정상입니다.',
          metadata: { routeDecision, assistantPlan, assistantResult },
        }),
      ],
      { isLoading: false, currentMode: 'streaming' }
    );

    const metadata = messages.find((m) => m.id === 'a1')?.metadata;
    expect(metadata?.assistantPlan).toEqual(assistantPlan);
    expect(metadata?.assistantResult).toEqual(assistantResult);
  });

  it('uses streamRagSources fallback for the last assistant message', () => {
    const streamRagSources: RagSource[] = [
      {
        title: 'official runbook',
        similarity: 0.88,
        sourceType: 'web',
        url: 'https://example.com/runbook',
      },
    ];

    const messages = transformMessages(
      [
        createMessage({ id: 'u1', role: 'user', text: 'what is latest fix?' }),
        createMessage({
          id: 'a1',
          role: 'assistant',
          text: 'streamed response',
        }),
      ],
      {
        isLoading: false,
        currentMode: 'streaming',
        streamRagSources,
      }
    );

    const assistant = messages.find((m) => m.id === 'a1');
    expect(assistant).toBeDefined();
    expect(assistant?.metadata?.analysisBasis?.engine).toBe('Streaming AI');
    expect(assistant?.metadata?.analysisBasis?.ragSources).toEqual(
      streamRagSources
    );
    expect(assistant?.metadata?.analysisBasis?.dataSource).toContain('웹 검색');
    expect(assistant?.metadata?.analysisBasis?.ragUsed).toBe(false);
  });

  it('keeps retrieval enabled separate from actual RAG usage', () => {
    const messages = transformMessages(
      [
        createMessage({
          id: 'u1',
          role: 'user',
          text: 'runbook이 필요하면 참고해서 알려줘',
        }),
        createMessage({
          id: 'a1',
          role: 'assistant',
          text: '현재 답변은 실시간 메트릭만으로 충분합니다.',
          metadata: {
            enableRAG: true,
            enableWebSearch: true,
            analysisMode: 'thinking',
            retrieval: {
              retrievalEnabled: true,
              retrievalUsed: false,
              retrievalMode: 'lite',
              suppressedReason: 'not_needed',
              evidenceCount: 0,
              webUsed: false,
            },
          },
        }),
      ],
      {
        isLoading: false,
        currentMode: 'streaming',
        ragEnabled: true,
        webSearchEnabled: true,
      }
    );

    const assistant = messages.find((m) => m.id === 'a1');

    expect(assistant?.metadata?.analysisBasis?.ragUsed).toBe(false);
    expect(assistant?.metadata?.analysisBasis?.retrieval).toEqual({
      retrievalEnabled: true,
      retrievalUsed: false,
      retrievalMode: 'lite',
      suppressedReason: 'not_needed',
      evidenceCount: 0,
      webUsed: false,
    });
    expect(assistant?.metadata?.analysisBasis?.featureStatus).toEqual({
      rag: { status: 'suppressed', reason: 'not_needed' },
      web: { status: 'enabled' },
      thinking: { status: 'enabled', reason: 'routing_mode' },
    });
  });

  it('derives retrieval status from deferred knowledge tool results', () => {
    const messages = transformMessages(
      [
        createMessage({
          id: 'u1',
          role: 'user',
          text: 'runbook 찾아줘',
        }),
        createMessage({
          id: 'a1',
          role: 'assistant',
          text: '지식 베이스가 일시적으로 비어 있어 기본 지식으로 답변합니다.',
        }),
      ],
      {
        isLoading: false,
        currentMode: 'streaming',
        deferredToolResultsByMessageId: {
          a1: [
            {
              toolName: 'searchKnowledgeBase',
              result: {
                success: false,
                results: [],
                retrieval: {
                  retrievalEnabled: true,
                  retrievalUsed: false,
                  retrievalMode: 'lite',
                  suppressedReason: 'unavailable',
                  evidenceCount: 0,
                  webUsed: false,
                },
              },
            },
          ],
        },
      }
    );

    const assistant = messages.find((m) => m.id === 'a1');

    expect(assistant?.metadata?.analysisBasis?.retrieval).toEqual({
      retrievalEnabled: true,
      retrievalUsed: false,
      retrievalMode: 'lite',
      suppressedReason: 'unavailable',
      evidenceCount: 0,
      webUsed: false,
    });
    expect(assistant?.metadata?.analysisBasis?.featureStatus?.rag).toEqual({
      status: 'unavailable',
      reason: 'unavailable',
    });
  });

  it('applies streamRagSources only to last message', () => {
    const streamRagSources: RagSource[] = [
      {
        title: 'fallback source',
        similarity: 0.8,
        sourceType: 'web',
        url: 'https://example.com/fallback',
      },
    ];

    const messages = transformMessages(
      [
        createMessage({ id: 'u1', role: 'user', text: 'test query' }),
        createMessage({ id: 'a1', role: 'assistant', text: 'first answer' }),
        createMessage({ id: 'a2', role: 'assistant', text: 'second answer' }),
      ],
      {
        isLoading: false,
        currentMode: 'streaming',
        streamRagSources,
      }
    );

    const firstAssistant = messages.find((m) => m.id === 'a1');
    const lastAssistant = messages.find((m) => m.id === 'a2');

    expect(firstAssistant?.metadata?.analysisBasis?.ragSources).toBeUndefined();
    expect(lastAssistant?.metadata?.analysisBasis?.ragSources).toEqual(
      streamRagSources
    );
  });

  it('uses traceIdByMessageId fallback when UIMessage metadata is missing', () => {
    const messages = transformMessages(
      [
        createMessage({ id: 'u1', role: 'user', text: 'test query' }),
        createMessage({ id: 'a1', role: 'assistant', text: 'sampled answer' }),
      ],
      {
        isLoading: false,
        currentMode: 'streaming',
        traceIdByMessageId: {
          a1: 'trace-fallback-123',
        },
      }
    );

    const assistant = messages.find((m) => m.id === 'a1');
    expect(assistant?.metadata?.traceId).toBe('trace-fallback-123');
  });

  it('derives thinkingSteps from metadata.toolResultSummaries when tool parts are not present', () => {
    const messages = transformMessages(
      [
        createMessage({ id: 'u1', role: 'user', text: '서버 상태 알려줘' }),
        createMessage({
          id: 'a1',
          role: 'assistant',
          text: '분석 결과',
          metadata: {
            toolResultSummaries: [
              {
                toolName: 'getServerMetrics',
                label: '서버 메트릭 조회',
                summary: 'lb-haproxy-dc1-01 CPU 82% (Warning)',
                status: 'completed',
              },
              {
                toolName: 'detectAnomalies',
                label: '전체 서버 이상 탐지',
                summary: '이상 징후 2건 탐지',
                status: 'completed',
              },
            ],
          },
        }),
      ],
      { isLoading: false, currentMode: 'streaming' }
    );

    const assistant = messages.find((m) => m.id === 'a1');
    expect(assistant?.thinkingSteps).toHaveLength(2);
    expect(assistant?.thinkingSteps?.[0]?.step).toBe('getServerMetrics');
    expect(assistant?.thinkingSteps?.[0]?.title).toBe('서버 메트릭 조회');
    expect(assistant?.thinkingSteps?.[0]?.status).toBe('completed');
    expect(assistant?.thinkingSteps?.[1]?.step).toBe('detectAnomalies');
    expect(assistant?.thinkingSteps?.[1]?.title).toBe('이상 징후 확인');
  });

  it('derives thinkingSteps from metadata.toolsCalled when summaries and tool parts are missing', () => {
    const messages = transformMessages(
      [
        createMessage({ id: 'u1', role: 'user', text: '이상 징후 알려줘' }),
        createMessage({
          id: 'a1',
          role: 'assistant',
          text: '분석 결과',
          metadata: {
            toolsCalled: ['detectAnomaliesAllServers', 'predictTrends'],
          },
        }),
      ],
      { isLoading: false, currentMode: 'streaming' }
    );

    const assistant = messages.find((m) => m.id === 'a1');
    expect(assistant?.thinkingSteps).toHaveLength(2);
    expect(assistant?.thinkingSteps?.[0]?.step).toBe(
      'detectAnomaliesAllServers'
    );
    expect(assistant?.thinkingSteps?.[0]?.title).toBe(
      '전체 서버 이상 징후 확인'
    );
    expect(assistant?.thinkingSteps?.[0]?.status).toBe('completed');
    expect(assistant?.thinkingSteps?.[1]?.step).toBe('predictTrends');
    expect(assistant?.thinkingSteps?.[1]?.title).toBe('단기 위험 추세 계산');
  });

  it('derives job-queue analysis basis from metadata toolsCalled', () => {
    const messages = transformMessages(
      [
        createMessage({
          id: 'u1',
          role: 'user',
          text: 'CPU 높은 서버 분석해줘',
        }),
        createMessage({
          id: 'a1',
          role: 'assistant',
          text: '분석 결과',
          metadata: {
            traceId: 'trace-job-tools-1',
            toolsCalled: ['getServerMetrics', 'detectAnomalies'],
          },
        }),
      ],
      { isLoading: false, currentMode: 'job-queue' }
    );

    const assistant = messages.find((m) => m.id === 'a1');

    expect(assistant?.metadata?.analysisBasis?.engine).toBe('Cloud Run AI');
    expect(assistant?.metadata?.analysisBasis?.toolsCalled).toEqual([
      'getServerMetrics',
      'detectAnomalies',
    ]);
    expect(assistant?.metadata?.analysisBasis?.dataSource).toBe(
      '서버 실시간 데이터 분석'
    );
    expect(assistant?.metadata?.analysisBasis?.timeRange).toBe('최근 1시간');
  });

  it('replaces legacy parity metadata wording with the typed getServerMetrics contract', () => {
    const messages = transformMessages(
      [
        createMessage({
          id: 'u1',
          role: 'user',
          text: 'db 디스크 상태 알려줘',
        }),
        createMessage({
          id: 'a1',
          role: 'assistant',
          text: '응답 본문',
          metadata: {
            assistantResponseView: {
              summary: 'db 디스크 상태 요약',
              details:
                '일반 설명 문단\n\n---\n\n**getServerMetrics의 원본 데이터 필드 (`dataSlot` 및 `dataSource` 포함)**:\n```json\n{ "_dataSlot": "20260322_1530", "_dataSource": "prometheus" }\n```',
              shouldCollapse: true,
            },
          },
          parts: [
            { type: 'text', text: '응답 본문' },
            {
              type: 'tool-getServerMetrics',
              toolCallId: 'tool-1',
              output: {
                success: true,
                dataSlot: {
                  slotIndex: 3,
                  minuteOfDay: 30,
                  timeLabel: '00:30 KST',
                },
                dataSource: {
                  scopeName: 'openmanager-ai-otel-pipeline',
                  scopeVersion: '1.0.0',
                  catalogGeneratedAt: '2026-02-15T03:56:41.821Z',
                  hour: 0,
                },
              },
            },
          ],
        }),
      ],
      { isLoading: false, currentMode: 'streaming' }
    );

    const assistant = messages.find((m) => m.id === 'a1');
    const details = assistant?.metadata?.assistantResponseView?.details ?? '';

    expect(details).toContain('일반 설명 문단');
    expect(details).toContain('Parity Metadata Contract');
    expect(details).toContain('"dataSlot"');
    expect(details).toContain('"dataSource"');
    expect(details).not.toContain('_dataSlot');
    expect(details).not.toContain('_dataSource');
    expect(details).not.toContain('YYYYMMDD_HHMM');
  });

  it('preserves guidance CTA metadata for assistant messages', () => {
    const messages = transformMessages(
      [
        createMessage({
          id: 'u1',
          role: 'user',
          text: '이상감지 기능 사용법',
        }),
        createMessage({
          id: 'a1',
          role: 'assistant',
          text: '이상감지/추세 기능은 사용자가 명시적으로 요청할 때만 실행합니다.',
          metadata: {
            type: 'guidance',
            artifactIntentReason: 'monitoring_guidance_pattern',
            artifactIntentTarget: 'monitoring-analysis',
            guidanceCta: {
              target: 'monitoring-analysis',
              label: '바로 이상감지/추세 분석 실행하기',
            },
          },
        }),
      ],
      { isLoading: false, currentMode: 'streaming' }
    );

    const assistant = messages.find((m) => m.id === 'a1');

    expect(assistant?.metadata).toMatchObject({
      type: 'guidance',
      artifactIntentReason: 'monitoring_guidance_pattern',
      artifactIntentTarget: 'monitoring-analysis',
      guidanceCta: {
        target: 'monitoring-analysis',
        label: '바로 이상감지/추세 분석 실행하기',
      },
    });
  });

  it('hydrates parity metadata from deferred stream state even when UIMessage parts are plain text only', () => {
    const messages = transformMessages(
      [
        createMessage({
          id: 'u1',
          role: 'user',
          text: 'cache 메모리 상태 알려줘',
        }),
        createMessage({
          id: 'a1',
          role: 'assistant',
          text: '응답 본문',
        }),
      ],
      {
        isLoading: false,
        currentMode: 'streaming',
        deferredAssistantMetadataByMessageId: {
          a1: {
            assistantResponseView: {
              summary: '메모리 상태 요약',
              details: '상세 분석',
              shouldCollapse: true,
            },
          },
        },
        deferredToolResultsByMessageId: {
          a1: [
            {
              toolName: 'getServerMetrics',
              result: {
                success: true,
                dataSlot: {
                  slotIndex: 85,
                  minuteOfDay: 850,
                  timeLabel: '14:10 KST',
                },
                dataSource: {
                  scopeName: 'openmanager-ai-otel-pipeline',
                  scopeVersion: '1.0.0',
                  catalogGeneratedAt: '2026-02-15T03:56:41.821Z',
                  hour: 14,
                },
              },
            },
          ],
        },
      }
    );

    const assistant = messages.find((m) => m.id === 'a1');
    expect(assistant?.metadata?.analysisBasis?.dataSource).toBe(
      '서버 실시간 데이터 분석'
    );
    expect(
      assistant?.thinkingSteps?.some((step) => step.step === 'getServerMetrics')
    ).toBe(true);
    expect(assistant?.metadata?.toolResultSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toolName: 'getServerMetrics',
          status: 'completed',
        }),
      ])
    );
    expect(assistant?.metadata?.assistantResponseView?.summary).toBe(
      '메모리 상태 요약'
    );
    expect(assistant?.metadata?.assistantResponseView?.details).toContain(
      'Parity Metadata Contract'
    );
    expect(assistant?.metadata?.assistantResponseView?.details).toContain(
      '"slotIndex": 85'
    );
  });

  it('creates parity details for short assistant answers without structured metadata', () => {
    const messages = transformMessages(
      [
        createMessage({
          id: 'u1',
          role: 'user',
          text: 'cache 메모리 사용률 몇 %야?',
        }),
        createMessage({
          id: 'a1',
          role: 'assistant',
          text: 'cache-redis-dc1-01의 메모리 사용률은 75%입니다.',
          parts: [
            {
              type: 'text',
              text: 'cache-redis-dc1-01의 메모리 사용률은 75%입니다.',
            },
            {
              type: 'tool-getServerMetrics',
              toolCallId: 'tool-1',
              output: {
                success: true,
                dataSlot: {
                  slotIndex: 88,
                  minuteOfDay: 880,
                  timeLabel: '14:40 KST',
                },
                dataSource: {
                  scopeName: 'openmanager-ai-otel-pipeline',
                  scopeVersion: '1.0.0',
                  catalogGeneratedAt: '2026-02-15T03:56:41.821Z',
                  hour: 14,
                },
              },
            },
          ],
        }),
      ],
      { isLoading: false, currentMode: 'streaming' }
    );

    const assistant = messages.find((m) => m.id === 'a1');
    expect(assistant?.metadata?.assistantResponseView?.summary).toBe(
      'cache-redis-dc1-01의 메모리 사용률은 75%입니다.'
    );
    expect(assistant?.metadata?.assistantResponseView?.shouldCollapse).toBe(
      false
    );
    expect(assistant?.metadata?.assistantResponseView?.details).toContain(
      'Parity Metadata Contract'
    );
    expect(assistant?.metadata?.assistantResponseView?.details).toContain(
      '"slotIndex": 88'
    );
  });

  it('preserves handoff history in assistant metadata', () => {
    const messages = transformMessages(
      [
        createMessage({ id: 'u1', role: 'user', text: '현재 상태 요약해줘' }),
        createMessage({
          id: 'a1',
          role: 'assistant',
          text: '운영 요약입니다.',
          metadata: {
            handoffHistory: [
              {
                from: 'supervisor',
                to: 'reporter',
                reason: '최종 요약 작성',
              },
            ],
          },
        }),
      ],
      { isLoading: false, currentMode: 'streaming' }
    );

    const assistant = messages.find((m) => m.id === 'a1');
    expect(assistant?.metadata?.handoffHistory).toEqual([
      {
        from: 'supervisor',
        to: 'reporter',
        reason: '최종 요약 작성',
      },
    ]);
  });

  it('preserves provider fallback telemetry in assistant metadata', () => {
    const messages = transformMessages(
      [
        createMessage({ id: 'u1', role: 'user', text: '장애 구간 요약해줘' }),
        createMessage({
          id: 'a1',
          role: 'assistant',
          text: '대체 모델에서 응답했습니다.',
          metadata: {
            provider: 'mistral',
            modelId: 'mistral-large-latest',
            usedFallback: true,
            fallbackReason: 'empty_response',
            ttfbMs: 1520,
            providerAttempts: [
              {
                provider: 'cerebras',
                modelId: 'llama3.1-8b',
                attempt: 1,
                durationMs: 820,
                error: 'raw tool-call JSON',
              },
              {
                provider: 'mistral',
                modelId: 'mistral-large-latest',
                attempt: 1,
                durationMs: 1540,
              },
            ],
          },
        }),
      ],
      { isLoading: false, currentMode: 'job-queue' }
    );

    const assistant = messages.find((m) => m.id === 'a1');
    expect(assistant?.metadata).toMatchObject({
      provider: 'mistral',
      modelId: 'mistral-large-latest',
      usedFallback: true,
      fallbackReason: 'empty_response',
      ttfbMs: 1520,
      providerAttempts: [
        expect.objectContaining({
          provider: 'cerebras',
          error: 'raw tool-call JSON',
        }),
        expect.objectContaining({
          provider: 'mistral',
          modelId: 'mistral-large-latest',
        }),
      ],
    });
  });

  it('preserves metadata-provided tool result summaries for async job responses', () => {
    const messages = transformMessages(
      [
        createMessage({ id: 'u1', role: 'user', text: '현재 상태를 분석해줘' }),
        createMessage({
          id: 'a1',
          role: 'assistant',
          text: '현재 이상 징후 1건이 확인됩니다.',
          metadata: {
            toolResultSummaries: [
              {
                toolName: 'detectAnomalies',
                label: '이상 탐지',
                summary: '1개 이상 징후를 감지했습니다.',
                preview: '{"count":1}',
                status: 'completed',
              },
            ],
          },
        }),
      ],
      { isLoading: false, currentMode: 'job-queue' }
    );

    const assistant = messages.find((m) => m.id === 'a1');
    expect(assistant?.metadata?.toolResultSummaries).toEqual([
      {
        toolName: 'detectAnomalies',
        label: '이상 탐지',
        summary: '1개 이상 징후를 감지했습니다.',
        preview: '{"count":1}',
        status: 'completed',
      },
    ]);
  });

  it('derives failed tool summaries from tool parts when metadata summaries are absent', () => {
    const messages = transformMessages(
      [
        createMessage({ id: 'u1', role: 'user', text: '근본 원인 찾아줘' }),
        createMessage({
          id: 'a1',
          role: 'assistant',
          text: '분석 중 오류가 발생했습니다.',
          parts: [
            {
              type: 'text',
              text: '분석 중 오류가 발생했습니다.',
            },
            {
              type: 'tool-findRootCause',
              toolCallId: 'tool-root-cause-1',
              state: 'output-error',
              errorText: 'dependency timeout',
            },
          ],
        }),
      ],
      { isLoading: false, currentMode: 'streaming' }
    );

    const assistant = messages.find((m) => m.id === 'a1');

    expect(assistant?.metadata?.toolResultSummaries).toEqual([
      {
        toolName: 'findRootCause',
        label: '원인 추정',
        summary: 'dependency timeout',
        preview: undefined,
        status: 'failed',
      },
    ]);
    expect(assistant?.thinkingSteps?.[0]?.status).toBe('failed');
    expect(assistant?.thinkingSteps?.[0]?.description).toContain(
      'dependency timeout'
    );
  });

  it('prioritizes metric ranking tools over filterServers in analysis metadata', () => {
    const messages = transformMessages(
      [
        createMessage({
          id: 'u1',
          role: 'user',
          text: '현재 메모리 사용률 상위 3대 알려줘',
        }),
        createMessage({
          id: 'a1',
          role: 'assistant',
          text: '상위 3대는 cache-redis-dc1-02, api-was-dc1-01, api-was-dc1-02 입니다.',
          metadata: {
            toolsCalled: ['filterServers', 'getServerMetricsAdvanced'],
            toolResultSummaries: [
              {
                toolName: 'filterServers',
                label: '서버 필터링',
                summary: '조건에 맞는 서버 3대를 반환했습니다.',
                preview: '{"summary":{"matched":3,"returned":3}}',
                status: 'completed',
              },
              {
                toolName: 'getServerMetricsAdvanced',
                label: '서버 메트릭 상세 조회',
                summary:
                  '메모리 사용률 상위 3대는 1. cache-redis-dc1-02 72%, 2. api-was-dc1-01 71%, 3. api-was-dc1-02 70%입니다.',
                preview:
                  '{"responseKind":"current_metric_ranking","query":{"timeRange":"current","aggregation":"none","sortBy":"memory","limit":3}}',
                status: 'completed',
              },
            ],
          },
        }),
      ],
      { isLoading: false, currentMode: 'job-queue' }
    );

    const assistant = messages.find((m) => m.id === 'a1');

    expect(assistant?.metadata?.analysisBasis?.toolsCalled).toEqual([
      'getServerMetricsAdvanced',
      'filterServers',
    ]);
    expect(
      assistant?.metadata?.toolResultSummaries?.map(
        (summary) => summary.toolName
      )
    ).toEqual(['getServerMetricsAdvanced', 'filterServers']);
    expect(assistant?.thinkingSteps?.[0]?.step).toBe(
      'getServerMetricsAdvanced'
    );
  });

  it('does not promote finalAnswer-only tool output to server realtime analysis', () => {
    const messages = transformMessages(
      [
        createMessage({
          id: 'u1',
          role: 'user',
          text: 'cache-redis-dc1-01 메모리 사용률 몇 %야?',
        }),
        createMessage({
          id: 'a1',
          role: 'assistant',
          text: 'cache-redis-dc1-01의 메모리 사용률은 32%입니다.',
          parts: [
            {
              type: 'text',
              text: 'cache-redis-dc1-01의 메모리 사용률은 32%입니다.',
            },
            {
              type: 'tool-finalAnswer',
              toolCallId: 'tool-final-1',
              output: {
                answer: 'cache-redis-dc1-01의 메모리 사용률은 32%입니다.',
              },
            },
          ],
        }),
      ],
      { isLoading: false, currentMode: 'streaming' }
    );

    const assistant = messages.find((m) => m.id === 'a1');
    expect(assistant?.metadata?.analysisBasis?.dataSource).toBe(
      '일반 대화 응답'
    );
    expect(assistant?.metadata?.analysisBasis?.ragUsed).toBe(false);
    expect(assistant?.metadata?.analysisBasis?.timeRange).toBeUndefined();
    expect(assistant?.metadata?.assistantResponseView).toBeUndefined();
  });
});

describe('normalizeAIResponse', () => {
  it('extracts answer field from JSON response', () => {
    const json = JSON.stringify({
      answer: '서버 15대 중 경고 1대',
      confidence: 0.93,
      toolsUsed: ['getServerMetrics'],
    });
    expect(normalizeAIResponse(json)).toBe('서버 15대 중 경고 1대');
  });

  it('extracts response field from Cloud Run JSON', () => {
    const json = JSON.stringify({
      response: '분석 결과입니다',
      success: true,
    });
    expect(normalizeAIResponse(json)).toBe('분석 결과입니다');
  });

  it('returns plain text as-is', () => {
    const text = '일반 텍스트 응답입니다';
    expect(normalizeAIResponse(text)).toBe(text);
  });

  it('returns markdown as-is', () => {
    const md = '## 서버 현황\n- CPU: 45%\n- MEM: 60%';
    expect(normalizeAIResponse(md)).toBe(md);
  });

  it('returns original for unrecognized JSON structure', () => {
    const json = JSON.stringify({ foo: 'bar', baz: 123 });
    expect(normalizeAIResponse(json)).toBe(json);
  });

  it('handles empty/null input gracefully', () => {
    expect(normalizeAIResponse('')).toBe('');
    expect(normalizeAIResponse(null as unknown as string)).toBe(null);
  });
});
