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
    setStreamRagSources: vi.fn(),
    getMessages: vi.fn(() => messages),
    setMessages: vi.fn(),
  };
}

describe('handleStreamDataPart', () => {
  let callbacks: ReturnType<typeof createMockCallbacks>;

  beforeEach(() => {
    callbacks = createMockCallbacks();
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

    it('should inject structuredView into last assistant message metadata', () => {
      const part: StreamDataPart = {
        type: 'data-done',
        data: {
          responseSummary: '서버 상태 요약',
          responseDetails: '상세 분석 내용',
          responseShouldCollapse: true,
        },
      };

      handleStreamDataPart(part, callbacks);

      expect(callbacks.setMessages).toHaveBeenCalled();

      const updatedMessages = callbacks.setMessages.mock.calls[0][0];
      const lastAssistant = updatedMessages.find(
        (m: UIMessage) => m.role === 'assistant'
      );
      expect(lastAssistant?.metadata).toBeDefined();
      expect(
        (lastAssistant?.metadata as Record<string, unknown>)
          .assistantResponseView
      ).toBeDefined();
    });

    it('should not set messages when no structured view available', () => {
      const part: StreamDataPart = {
        type: 'data-done',
        data: { ragSources: [] },
      };

      handleStreamDataPart(part, callbacks);

      expect(callbacks.setMessages).not.toHaveBeenCalled();
    });

    it('should not set messages when no assistant message exists', () => {
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

      expect(callbacks.setMessages).not.toHaveBeenCalled();
    });
  });
});
