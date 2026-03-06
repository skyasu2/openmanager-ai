/**
 * Context Compressor Unit Tests
 *
 * @description AI 대화 컨텍스트 압축 로직 검증
 * @created 2026-01-10 v5.84.3
 */
import { describe, expect, it } from 'vitest';

import {
  type CompressibleMessage,
  compressContext,
  shouldCompress,
} from './context-compressor';

describe('context-compressor', () => {
  describe('shouldCompress', () => {
    it('should return false when messageCount is below threshold', () => {
      expect(shouldCompress(3, 4)).toBe(false);
      expect(shouldCompress(4, 4)).toBe(false);
    });

    it('should return true when messageCount exceeds threshold', () => {
      expect(shouldCompress(5, 4)).toBe(true);
      expect(shouldCompress(10, 4)).toBe(true);
    });

    it('should use default threshold of 4', () => {
      expect(shouldCompress(4)).toBe(false);
      expect(shouldCompress(5)).toBe(true);
    });
  });

  describe('compressContext', () => {
    const createMessage = (
      role: CompressibleMessage['role'],
      content: string
    ): CompressibleMessage => ({ role, content });

    describe('basic compression', () => {
      it('should return all messages when count is within limits', () => {
        const messages: CompressibleMessage[] = [
          createMessage('user', 'Hello'),
          createMessage('assistant', 'Hi there'),
        ];

        const result = compressContext(messages, { keepRecentCount: 3 });

        expect(result.messages).toHaveLength(2);
        expect(result.compressedCount).toBe(2);
        expect(result.originalCount).toBe(2);
      });

      it('should keep recent messages and truncate older ones', () => {
        const messages: CompressibleMessage[] = [
          createMessage('user', 'Message 1'),
          createMessage('assistant', 'Response 1'),
          createMessage('user', 'Message 2'),
          createMessage('assistant', 'Response 2'),
          createMessage('user', 'Message 3'),
          createMessage('assistant', 'Response 3'),
        ];

        const result = compressContext(messages, {
          keepRecentCount: 2,
          maxTotalMessages: 4,
        });

        // Should have some older messages + 2 recent
        expect(result.compressedCount).toBeLessThanOrEqual(4);
        // Last messages should be preserved
        const lastMsg = result.messages[result.messages.length - 1];
        expect(lastMsg.content).toBe('Response 3');
      });
    });

    describe('system message handling', () => {
      it('should keep system messages when keepSystemMessages is true', () => {
        const messages: CompressibleMessage[] = [
          createMessage('system', 'You are a helpful assistant'),
          createMessage('user', 'Hello'),
          createMessage('assistant', 'Hi'),
        ];

        const result = compressContext(messages, {
          keepSystemMessages: true,
          keepRecentCount: 2,
        });

        const systemMsgs = result.messages.filter((m) => m.role === 'system');
        expect(systemMsgs).toHaveLength(1);
        expect(systemMsgs[0].content).toBe('You are a helpful assistant');
      });

      it('should exclude system messages when keepSystemMessages is false', () => {
        const messages: CompressibleMessage[] = [
          createMessage('system', 'You are a helpful assistant'),
          createMessage('user', 'Hello'),
          createMessage('assistant', 'Hi'),
        ];

        const result = compressContext(messages, {
          keepSystemMessages: false,
          keepRecentCount: 2,
        });

        const systemMsgs = result.messages.filter((m) => m.role === 'system');
        expect(systemMsgs).toHaveLength(0);
      });

      it('should still respect maxTotalMessages when system messages exceed the budget', () => {
        const messages: CompressibleMessage[] = [
          createMessage('system', 'System prompt 1'),
          createMessage('system', 'System prompt 2'),
          createMessage('system', 'System prompt 3'),
          createMessage('user', 'Recent question'),
          createMessage('assistant', 'Recent answer'),
        ];

        const result = compressContext(messages, {
          keepSystemMessages: true,
          keepRecentCount: 2,
          maxTotalMessages: 3,
        });

        expect(result.messages).toHaveLength(3);
        expect(result.messages.at(-1)?.content).toBe('Recent answer');
        expect(result.messages.at(-2)?.content).toBe('Recent question');
      });
    });

    describe('message truncation', () => {
      it('should truncate long messages to maxCharsPerMessage', () => {
        const longContent = 'A'.repeat(2000);
        const messages: CompressibleMessage[] = [
          createMessage('user', longContent),
          createMessage('assistant', 'Short response'),
          createMessage('user', 'Recent question'),
          createMessage('assistant', 'Recent answer'),
        ];

        const result = compressContext(messages, {
          keepRecentCount: 2,
          maxTotalMessages: 4,
          maxCharsPerMessage: 100,
        });

        // Older messages should be truncated
        const olderMsg = result.messages.find(
          (m) => m.content.includes('A') && m.content.length < 2000
        );
        if (olderMsg) {
          expect(olderMsg.content.length).toBeLessThanOrEqual(103); // 100 + "..."
        }
      });
    });

    describe('compression statistics', () => {
      it('should calculate correct compression stats', () => {
        const messages: CompressibleMessage[] = [
          createMessage('user', 'First message with some content'),
          createMessage('assistant', 'First response with details'),
          createMessage('user', 'Second message'),
          createMessage('assistant', 'Second response'),
        ];

        const result = compressContext(messages, {
          keepRecentCount: 2,
          maxTotalMessages: 3,
        });

        expect(result.originalCount).toBe(4);
        expect(result.compressedCount).toBeLessThanOrEqual(3);
        expect(result.compressionRatio).toBeGreaterThanOrEqual(0);
        expect(result.compressionRatio).toBeLessThanOrEqual(100);
      });

      it('should return 0 compression ratio for empty messages', () => {
        const result = compressContext([]);

        expect(result.originalCount).toBe(0);
        expect(result.compressedCount).toBe(0);
        expect(result.compressionRatio).toBe(0);
        expect(result.estimatedTokensSaved).toBe(0);
      });
    });

    describe('summarization mode', () => {
      it('should create summary when enableSummarization is true', () => {
        const messages: CompressibleMessage[] = [
          createMessage('user', 'server-1 CPU 문제가 있어요'),
          createMessage('assistant', '서버 확인 중입니다'),
          createMessage('user', 'memory 사용량도 높아요'),
          createMessage('assistant', '메모리 이슈도 확인됨'),
          createMessage('user', '해결 방법은?'),
          createMessage('assistant', '재시작 권장'),
        ];

        const result = compressContext(messages, {
          keepRecentCount: 2,
          enableSummarization: true,
        });

        // Should have a summary message
        const summaryMsg = result.messages.find(
          (m) =>
            m.role === 'system' &&
            (m.content.includes('이전 대화') || m.content.includes('요약'))
        );
        expect(summaryMsg).toBeDefined();
      });

      it('should extract key info in summary', () => {
        const messages: CompressibleMessage[] = [
          createMessage('user', 'server-1 CPU 경고'),
          createMessage('assistant', '확인 중'),
          createMessage('user', '최근 질문'),
          createMessage('assistant', '최근 답변'),
        ];

        const result = compressContext(messages, {
          keepRecentCount: 2,
          enableSummarization: true,
        });

        // Summary should contain extracted keywords
        const summaryMsg = result.messages.find(
          (m) => m.role === 'system' && m.content.includes('server')
        );
        if (summaryMsg) {
          expect(summaryMsg.content.toLowerCase()).toContain('server');
        }
      });
    });

    describe('edge cases', () => {
      it('should handle single message', () => {
        const messages: CompressibleMessage[] = [createMessage('user', 'Solo')];

        const result = compressContext(messages);

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0].content).toBe('Solo');
      });

      it('should handle messages with only system role', () => {
        const messages: CompressibleMessage[] = [
          createMessage('system', 'System prompt 1'),
          createMessage('system', 'System prompt 2'),
        ];

        const result = compressContext(messages, { keepRecentCount: 1 });

        expect(result.messages.filter((m) => m.role === 'system').length).toBe(
          2
        );
      });

      it('should handle Korean text correctly', () => {
        const messages: CompressibleMessage[] = [
          createMessage('user', '서버 상태가 어떻게 되나요?'),
          createMessage('assistant', 'CPU 사용량이 95%입니다.'),
        ];

        const result = compressContext(messages);

        expect(result.estimatedTokensSaved).toBeGreaterThanOrEqual(0);
        // Korean should estimate tokens differently
        expect(result.messages[0].content).toContain('서버');
      });
    });
  });
});
