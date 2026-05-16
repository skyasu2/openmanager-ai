/**
 * @vitest-environment jsdom
 */
import type { UIMessage } from '@ai-sdk/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentStatusEventData,
  HandoffEventData,
  StreamDataPart,
} from '@/hooks/ai/useHybridAIQuery';
import type { DeveloperPanelData } from '@/lib/ai/developer-panel';
import { handleStreamDataPart } from './stream-data-handler';

function createMockCallbacks() {
  let pendingToolResults: Array<{ toolName: string; result: unknown }> = [];
  let pendingMessageMetadata: Record<string, unknown> = {};
  let developerPanelData: DeveloperPanelData | null = null;
  const messages: UIMessage[] = [
    {
      id: 'msg-1',
      role: 'user',
      parts: [{ type: 'text', text: '서버 상태 알려줘' }],
    },
    {
      id: 'msg-2',
      role: 'assistant',
      parts: [{ type: 'text', text: 'CPU 사용률이 높습니다.' }],
    },
  ];

  return {
    setCurrentAgentStatus: vi.fn(),
    setCurrentHandoff: vi.fn(),
    setMessageTraceId: vi.fn(),
    setStreamRagSources: vi.fn(),
    getPendingToolResults: vi.fn(() => pendingToolResults),
    setPendingToolResults: vi.fn((results) => {
      pendingToolResults = results;
    }),
    getPendingMessageMetadata: vi.fn(() => pendingMessageMetadata),
    setPendingMessageMetadata: vi.fn((metadata) => {
      pendingMessageMetadata = metadata;
    }),
    setDeferredAssistantMetadata: vi.fn(),
    setDeferredAssistantToolResults: vi.fn(),
    getDeveloperPanelData: vi.fn(() => developerPanelData),
    setDeveloperPanelData: vi.fn((next: DeveloperPanelData | null) => {
      developerPanelData = next;
    }),
    getMessages: vi.fn(() => messages),
  };
}

describe('handleStreamDataPart', () => {
  let callbacks: ReturnType<typeof createMockCallbacks>;

  beforeEach(() => {
    callbacks = createMockCallbacks();
  });

  describe('stream lifecycle events', () => {
    it('should clear pending tool results on data-start', () => {
      callbacks.setPendingToolResults([
        { toolName: 'getServerMetrics', result: { ok: true } },
      ]);

      handleStreamDataPart({ type: 'data-start', data: {} }, callbacks);

      expect(callbacks.setPendingToolResults).toHaveBeenLastCalledWith([]);
      expect(callbacks.setPendingMessageMetadata).toHaveBeenLastCalledWith({});
    });

    it('should accumulate pending tool results on data-tool-result', () => {
      handleStreamDataPart(
        {
          type: 'data-tool-result',
          data: {
            toolName: 'getServerMetrics',
            result: {
              dataSlot: {
                slotIndex: 57,
                minuteOfDay: 570,
                timeLabel: '09:30 KST',
              },
            },
          },
        },
        callbacks
      );

      expect(callbacks.setPendingToolResults).toHaveBeenLastCalledWith([
        {
          toolName: 'getServerMetrics',
          result: {
            dataSlot: {
              slotIndex: 57,
              minuteOfDay: 570,
              timeLabel: '09:30 KST',
            },
          },
        },
      ]);
    });
  });

  describe('agent-status event', () => {
    it('should set agent status on data-agent-status event', () => {
      const agentStatus: AgentStatusEventData = {
        agent: 'NLQ',
        status: 'thinking',
      };
      const part: StreamDataPart = {
        type: 'data-agent-status',
        data: agentStatus,
      };

      handleStreamDataPart(part, callbacks);

      expect(callbacks.setCurrentAgentStatus).toHaveBeenCalledWith(agentStatus);
    });

    it('should not set status when data is missing', () => {
      const part: StreamDataPart = {
        type: 'data-agent-status',
      };

      handleStreamDataPart(part, callbacks);

      expect(callbacks.setCurrentAgentStatus).not.toHaveBeenCalled();
    });

    it('should normalize legacy orchestration payloads from the server', () => {
      const part: StreamDataPart = {
        type: 'data-agent-status',
        data: {
          status: 'routing_fallback',
          message: '라우팅 타임아웃, Analyst Agent로 전환...',
        },
      };

      handleStreamDataPart(part, callbacks);

      expect(callbacks.setCurrentAgentStatus).toHaveBeenCalledWith({
        agent: 'Orchestrator',
        status: 'processing',
        message: '라우팅 타임아웃, Analyst Agent로 전환...',
      });
    });

    it('should ignore invalid agent status payloads', () => {
      const part: StreamDataPart = {
        type: 'data-agent-status',
        data: {
          agent: 'Supervisor',
          status: 'routing',
        },
      };

      handleStreamDataPart(part, callbacks);

      expect(callbacks.setCurrentAgentStatus).not.toHaveBeenCalled();
    });

    it('should map agent-step start and done events to inline agent status', () => {
      handleStreamDataPart(
        {
          type: 'data-agent-step',
          data: {
            tool: 'getServerMetrics',
            status: 'start',
          },
        },
        callbacks
      );

      expect(callbacks.setCurrentAgentStatus).toHaveBeenLastCalledWith({
        agent: 'getServerMetrics',
        status: 'processing',
        message: 'getServerMetrics 실행 중...',
      });

      handleStreamDataPart(
        {
          type: 'data-agent-step',
          data: {
            tool: 'getServerMetrics',
            status: 'done',
          },
        },
        callbacks
      );

      expect(callbacks.setCurrentAgentStatus).toHaveBeenLastCalledWith({
        agent: 'getServerMetrics',
        status: 'completed',
        message: 'getServerMetrics 완료',
      });
    });
  });

  describe('handoff event', () => {
    it('should set handoff on data-handoff event', () => {
      const handoff: HandoffEventData = {
        from: 'Supervisor',
        to: 'Analyst',
        reason: '분석 필요',
      };
      const part: StreamDataPart = {
        type: 'data-handoff',
        data: handoff,
      };

      handleStreamDataPart(part, callbacks);

      expect(callbacks.setCurrentHandoff).toHaveBeenCalledWith(handoff);
      expect(callbacks.setPendingMessageMetadata).toHaveBeenCalledWith({
        handoffHistory: [handoff],
      });
    });
  });

  describe('done event', () => {
    it('should clear agent status and handoff on data-done', () => {
      const part: StreamDataPart = {
        type: 'data-done',
        data: {},
      };

      handleStreamDataPart(part, callbacks);

      expect(callbacks.setCurrentAgentStatus).toHaveBeenCalledWith(null);
      expect(callbacks.setCurrentHandoff).toHaveBeenCalledWith(null);
    });

    it('should extract ragSources from done data', () => {
      const ragSources = [
        { title: 'KB문서', similarity: 0.95, sourceType: 'knowledge_base' },
      ];
      const part: StreamDataPart = {
        type: 'data-done',
        data: { ragSources },
      };

      handleStreamDataPart(part, callbacks);

      expect(callbacks.setStreamRagSources).toHaveBeenCalledWith(ragSources);
    });

    it('should set empty ragSources when none provided', () => {
      const part: StreamDataPart = {
        type: 'data-done',
        data: {},
      };

      handleStreamDataPart(part, callbacks);

      expect(callbacks.setStreamRagSources).toHaveBeenCalledWith([]);
    });

    it('should store structuredView into deferred assistant metadata', () => {
      const part: StreamDataPart = {
        type: 'data-done',
        data: {
          responseSummary: '서버 상태 요약',
          responseDetails: '상세 분석 내용',
          responseShouldCollapse: true,
        },
      };

      handleStreamDataPart(part, callbacks);

      expect(callbacks.setDeferredAssistantMetadata).toHaveBeenCalledWith(
        'msg-2',
        expect.objectContaining({
          assistantResponseView: {
            summary: '서버 상태 요약',
            details: '상세 분석 내용',
            shouldCollapse: true,
          },
        })
      );
    });

    it('should store provider attribution metadata from done events', () => {
      const part: StreamDataPart = {
        type: 'data-done',
        data: {
          metadata: {
            provider: 'groq',
            modelId: 'meta-llama/llama-4-scout-17b-16e-instruct',
            ttfbMs: 642,
            usedFallback: false,
            rotationSlot: 2,
          },
        },
      };

      handleStreamDataPart(part, callbacks);

      expect(callbacks.setDeferredAssistantMetadata).toHaveBeenCalledWith(
        'msg-2',
        expect.objectContaining({
          provider: 'groq',
          modelId: 'meta-llama/llama-4-scout-17b-16e-instruct',
          ttfbMs: 642,
          usedFallback: false,
          rotationSlot: 2,
          handoffHistory: [],
        })
      );
    });

    it('should store pending tool results for deferred assistant hydration', () => {
      handleStreamDataPart(
        {
          type: 'data-tool-result',
          data: {
            toolName: 'getServerMetrics',
            result: {
              success: true,
              dataSlot: {
                slotIndex: 57,
                minuteOfDay: 570,
                timeLabel: '09:30 KST',
              },
              dataSource: {
                scopeName: 'openmanager-ai-otel-pipeline',
                scopeVersion: '1.0.0',
                catalogGeneratedAt: '2026-03-24T00:00:00.000Z',
                hour: 9,
              },
            },
          },
        },
        callbacks
      );

      handleStreamDataPart(
        {
          type: 'data-done',
          data: {
            responseSummary: '요약',
          },
        },
        callbacks
      );

      expect(callbacks.setDeferredAssistantToolResults).toHaveBeenCalledWith(
        'msg-2',
        [
          {
            toolName: 'getServerMetrics',
            result: {
              success: true,
              dataSlot: {
                slotIndex: 57,
                minuteOfDay: 570,
                timeLabel: '09:30 KST',
              },
              dataSource: {
                scopeName: 'openmanager-ai-otel-pipeline',
                scopeVersion: '1.0.0',
                catalogGeneratedAt: '2026-03-24T00:00:00.000Z',
                hour: 9,
              },
            },
          },
        ]
      );
      expect(callbacks.setPendingToolResults).toHaveBeenLastCalledWith([]);
      expect(callbacks.setPendingMessageMetadata).toHaveBeenLastCalledWith({});
    });

    it('should store traceId into deferred assistant metadata', () => {
      const part: StreamDataPart = {
        type: 'data-done',
        data: {
          metadata: {
            traceId: 'trace-stream-123',
          },
        },
      };

      handleStreamDataPart(part, callbacks);

      expect(callbacks.setMessageTraceId).toHaveBeenCalledWith(
        'msg-2',
        'trace-stream-123'
      );
      expect(callbacks.setDeferredAssistantMetadata).toHaveBeenCalledWith(
        'msg-2',
        expect.objectContaining({
          traceId: 'trace-stream-123',
        })
      );
    });

    it('should store retrieval metadata into deferred assistant metadata', () => {
      const retrieval = {
        retrievalEnabled: true,
        retrievalUsed: false,
        retrievalMode: 'lite',
        suppressedReason: 'budget_guard',
        evidenceCount: 0,
        webUsed: false,
      };
      const part: StreamDataPart = {
        type: 'data-done',
        data: {
          metadata: {
            retrieval,
          },
        },
      };

      handleStreamDataPart(part, callbacks);

      expect(callbacks.setDeferredAssistantMetadata).toHaveBeenCalledWith(
        'msg-2',
        expect.objectContaining({
          retrieval,
        })
      );
    });

    it('should persist stream fallback metadata for UI evidence display', () => {
      const part: StreamDataPart = {
        type: 'data-done',
        data: {
          fallback: true,
          fallbackReason: 'cloud_run_504',
        },
      };

      handleStreamDataPart(part, callbacks);

      expect(callbacks.setDeferredAssistantMetadata).toHaveBeenCalledWith(
        'msg-2',
        expect.objectContaining({
          usedFallback: true,
          fallbackReason: 'cloud_run_504',
        })
      );
    });

    it('should persist routeDecision metadata from stream done events', () => {
      const routeDecision = {
        intent: 'chat',
        executionPath: 'stream',
        mode: 'single',
        reasonCodes: ['auto_complexity'],
        ruleVersion: '2026-05-03-v1',
        decidedBy: 'cloud-run',
      };
      const part: StreamDataPart = {
        type: 'data-done',
        data: {
          metadata: {
            routeDecision,
          },
        },
      };

      handleStreamDataPart(part, callbacks);

      expect(callbacks.setDeferredAssistantMetadata).toHaveBeenCalledWith(
        'msg-2',
        expect.objectContaining({
          routeDecision,
        })
      );
    });

    it('should persist semanticQueryTrace metadata from stream done events', () => {
      const semanticQueryTrace = {
        originalQuery: '제일 버거웠던 때를 load 기준으로 알려줘',
        selectedDomain: 'openmanager-monitoring',
        selectedCapability: 'monitoring.metric_peak',
        selectedEvidenceProvider: 'monitoring-peak-metric',
        evidenceAvailable: true,
        clarificationRequired: false,
        reasonCodes: ['semantic_frame_evidence_validated'],
      };
      const part: StreamDataPart = {
        type: 'data-done',
        data: {
          metadata: {
            semanticQueryTrace,
          },
        },
      };

      handleStreamDataPart(part, callbacks);

      expect(callbacks.setDeferredAssistantMetadata).toHaveBeenCalledWith(
        'msg-2',
        expect.objectContaining({
          semanticQueryTrace,
        })
      );
    });

    it('should persist AssistantPlan and AssistantResult facade metadata from stream done events', () => {
      const routeDecision = {
        intent: 'chat',
        executionPath: 'stream',
        mode: 'single',
        reasonCodes: ['auto_complexity'],
        ruleVersion: '2026-05-03-v1',
        decidedBy: 'cloud-run',
      };
      const assistantPlan = {
        kind: 'chat',
        planVersion: '2026-05-03-v1',
        routeDecision,
        executionPath: 'stream',
        stream: true,
        job: false,
        reasonCodes: ['auto_complexity'],
        decidedBy: 'cloud-run',
      };
      const assistantResult = {
        kind: 'chat',
        resultVersion: '2026-05-03-v1',
        routeDecision,
        status: 'completed',
      };
      const part: StreamDataPart = {
        type: 'data-done',
        data: {
          metadata: {
            routeDecision,
            assistantPlan,
            assistantResult,
          },
        },
      };

      handleStreamDataPart(part, callbacks);

      expect(callbacks.setDeferredAssistantMetadata).toHaveBeenCalledWith(
        'msg-2',
        expect.objectContaining({
          routeDecision,
          assistantPlan,
          assistantResult,
        })
      );
    });

    it('should preserve both traceId and structuredView when both are present', () => {
      const part: StreamDataPart = {
        type: 'data-done',
        data: {
          responseSummary: '서버 상태 요약',
          responseDetails: '상세 분석 내용',
          responseShouldCollapse: true,
          metadata: {
            traceId: 'trace-stream-456',
          },
        },
      };

      handleStreamDataPart(part, callbacks);

      expect(callbacks.setMessageTraceId).toHaveBeenCalledWith(
        'msg-2',
        'trace-stream-456'
      );
      expect(callbacks.setDeferredAssistantMetadata).toHaveBeenCalledWith(
        'msg-2',
        expect.objectContaining({
          traceId: 'trace-stream-456',
          assistantResponseView: expect.objectContaining({
            summary: '서버 상태 요약',
          }),
        })
      );
    });

    it('should persist toolsCalled into deferred assistant metadata', () => {
      const part: StreamDataPart = {
        type: 'data-done',
        data: {
          toolsCalled: ['getServerMetrics', 'detectAnomalies', '', 42],
        },
      };

      handleStreamDataPart(part, callbacks);

      expect(callbacks.setDeferredAssistantMetadata).toHaveBeenCalledWith(
        'msg-2',
        expect.objectContaining({
          toolsCalled: ['getServerMetrics', 'detectAnomalies'],
        })
      );
    });

    it('should persist accumulated handoff history into deferred assistant metadata', () => {
      handleStreamDataPart(
        {
          type: 'data-handoff',
          data: {
            from: 'supervisor',
            to: 'analyst',
            reason: '실시간 메트릭 분석',
          },
        },
        callbacks
      );

      handleStreamDataPart(
        {
          type: 'data-done',
          data: {
            responseSummary: '요약',
          },
        },
        callbacks
      );

      expect(callbacks.setDeferredAssistantMetadata).toHaveBeenCalledWith(
        'msg-2',
        expect.objectContaining({
          handoffHistory: [
            {
              from: 'supervisor',
              to: 'analyst',
              reason: '실시간 메트릭 분석',
            },
          ],
        })
      );
    });

    it('should persist handoff history even without structured view, traceId, or tool results', () => {
      handleStreamDataPart(
        {
          type: 'data-handoff',
          data: {
            from: 'supervisor',
            to: 'reporter',
            reason: '최종 응답 작성',
          },
        },
        callbacks
      );

      handleStreamDataPart(
        {
          type: 'data-done',
          data: { ragSources: [] },
        },
        callbacks
      );

      expect(callbacks.setDeferredAssistantMetadata).toHaveBeenCalledWith(
        'msg-2',
        expect.objectContaining({
          handoffHistory: [
            {
              from: 'supervisor',
              to: 'reporter',
              reason: '최종 응답 작성',
            },
          ],
        })
      );
    });

    it('should persist explicit empty handoff history when no handoff events occurred', () => {
      const part: StreamDataPart = {
        type: 'data-done',
        data: { ragSources: [] },
      };

      handleStreamDataPart(part, callbacks);

      expect(callbacks.setDeferredAssistantMetadata).toHaveBeenCalledWith(
        'msg-2',
        {
          handoffHistory: [],
        }
      );
      expect(callbacks.setDeferredAssistantToolResults).not.toHaveBeenCalled();
    });

    it('should keep pending metadata when no assistant message exists yet', () => {
      callbacks.getMessages.mockReturnValue([
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: '질문' }],
        },
      ]);

      const part: StreamDataPart = {
        type: 'data-done',
        data: {
          toolsCalled: ['getServerMetrics'],
          responseSummary: '요약',
        },
      };

      handleStreamDataPart(part, callbacks);

      expect(callbacks.setDeferredAssistantMetadata).not.toHaveBeenCalled();
      expect(callbacks.setPendingMessageMetadata).toHaveBeenCalledWith({
        toolsCalled: ['getServerMetrics'],
        handoffHistory: [],
        assistantResponseView: {
          summary: '요약',
          details: null,
          shouldCollapse: false,
        },
      });
    });

    it('should keep pending metadata when the latest message is user even if an older assistant exists', () => {
      callbacks.getMessages.mockReturnValue([
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: '첫 질문' }],
        },
        {
          id: 'msg-2',
          role: 'assistant',
          parts: [{ type: 'text', text: '이전 응답' }],
        },
        {
          id: 'msg-3',
          role: 'user',
          parts: [{ type: 'text', text: '추가 질문' }],
        },
      ]);

      handleStreamDataPart(
        {
          type: 'data-tool-result',
          data: {
            toolName: 'getServerMetrics',
            result: {
              dataSlot: {
                slotIndex: 108,
                minuteOfDay: 1080,
                timeLabel: '18:00 KST',
              },
            },
          },
        },
        callbacks
      );

      handleStreamDataPart(
        {
          type: 'data-done',
          data: {
            toolsCalled: ['getServerMetrics'],
            responseSummary: '최신 응답 요약',
            metadata: {
              traceId: 'trace-latest-assistant',
            },
          },
        },
        callbacks
      );

      expect(callbacks.setMessageTraceId).not.toHaveBeenCalledWith(
        'msg-2',
        'trace-latest-assistant'
      );
      expect(callbacks.setDeferredAssistantMetadata).not.toHaveBeenCalled();
      expect(callbacks.setDeferredAssistantToolResults).not.toHaveBeenCalled();
      expect(callbacks.setPendingMessageMetadata).toHaveBeenCalledWith({
        traceId: 'trace-latest-assistant',
        toolsCalled: ['getServerMetrics'],
        handoffHistory: [],
        assistantResponseView: {
          summary: '최신 응답 요약',
          details: null,
          shouldCollapse: false,
        },
      });
    });
  });

  describe('developer-context event', () => {
    it('should expose developer-context stream data as developer panel JSON', () => {
      handleStreamDataPart(
        {
          type: 'data-developer-context',
          data: {
            mode: 'developer',
            meta: {
              ts: '2026-05-08T02:40:00.000Z',
              session: null,
              stream: null,
              system: {
                cloudRunHealthy: true,
                cloudRunUrl: 'https://example-ai.run.app',
                disclosureMode: 'developer',
              },
              rag: null,
            },
          },
        },
        callbacks
      );

      expect(callbacks.setDeveloperPanelData).toHaveBeenCalledWith({
        ts: '2026-05-08T02:40:00.000Z',
        session: null,
        stream: null,
        system: {
          cloudRunHealthy: true,
          cloudRunUrl: 'https://example-ai.run.app',
          disclosureMode: 'developer',
        },
        rag: null,
      });
    });

    it('should merge data-done metadata into an existing developer panel snapshot', () => {
      callbacks.setDeveloperPanelData({
        ts: '2026-05-08T02:40:00.000Z',
        session: null,
        stream: null,
        system: {
          cloudRunHealthy: true,
          cloudRunUrl: 'https://example-ai.run.app',
          disclosureMode: 'developer',
        },
        rag: null,
      });

      handleStreamDataPart(
        {
          type: 'data-done',
          data: {
            resolvedMode: 'multi',
            toolsCalled: ['getServerMetrics', 'searchKnowledgeBase'],
            processingTime: 1234,
            metadata: {
              provider: 'groq',
              modelId: 'llama-3.3-70b-versatile',
              handoffCount: 2,
              retrieval: {
                retrievalEnabled: true,
                retrievalUsed: true,
                retrievalMode: 'lite',
                evidenceCount: 3,
                webUsed: false,
              },
            },
          },
        },
        callbacks
      );

      expect(callbacks.setDeveloperPanelData).toHaveBeenLastCalledWith(
        expect.objectContaining({
          session: {
            provider: 'groq',
            modelId: 'llama-3.3-70b-versatile',
            handoffCount: 2,
            durationMs: 1234,
            toolsCalled: ['getServerMetrics', 'searchKnowledgeBase'],
          },
          stream: {
            analysisBasis: 'multi-agent',
            stepsExecuted: 2,
          },
          rag: {
            ragType: 'lite',
            hitCount: 3,
            graphHits: 0,
            vectorHits: 3,
          },
        })
      );
    });
  });
});
