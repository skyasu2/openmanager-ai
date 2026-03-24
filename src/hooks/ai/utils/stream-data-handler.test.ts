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
import { handleStreamDataPart } from './stream-data-handler';

function createMockCallbacks() {
  let pendingToolResults: Array<{ toolName: string; result: unknown }> = [];
  let pendingMessageMetadata: Record<string, unknown> = {};
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

    it('should not persist assistant data when no structured view or tool data is available', () => {
      const part: StreamDataPart = {
        type: 'data-done',
        data: { ragSources: [] },
      };

      handleStreamDataPart(part, callbacks);

      expect(callbacks.setDeferredAssistantMetadata).not.toHaveBeenCalled();
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
          responseSummary: '요약',
        },
      };

      handleStreamDataPart(part, callbacks);

      expect(callbacks.setDeferredAssistantMetadata).not.toHaveBeenCalled();
      expect(callbacks.setPendingMessageMetadata).toHaveBeenCalledWith({
        assistantResponseView: {
          summary: '요약',
          details: null,
          shouldCollapse: false,
        },
      });
    });
  });
});
