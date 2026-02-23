/**
 * @vitest-environment jsdom
 *
 * Clarification Functions Unit Tests
 *
 * @description useHybridAIQuery 훅의 명확화 관련 함수 테스트
 * - dismissClarification: 쿼리 미실행, 상태 정리
 * - skipClarification: 원본 쿼리 그대로 실행
 * - selectClarification: 명확화된 쿼리 실행
 *
 * @created 2026-01-27
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@ai-sdk/react', () => ({
  useChat: vi.fn(() => ({
    messages: [],
    sendMessage: vi.fn(),
    status: 'idle',
    setMessages: vi.fn(),
    stop: vi.fn(),
  })),
}));

vi.mock('ai', () => ({
  DefaultChatTransport: class MockDefaultChatTransport {},
}));

vi.mock('@/lib/ai/query-classifier', () => ({
  classifyQuery: vi.fn().mockResolvedValue({
    intent: 'general',
    complexity: 'simple',
    confidence: 90,
  }),
}));

vi.mock('@/lib/ai/clarification-generator', () => ({
  generateClarification: vi.fn(),
  applyClarification: vi.fn((option) => option.query),
  applyCustomClarification: vi.fn(
    (original, custom) => `${original} - ${custom}`
  ),
}));

vi.mock('@/lib/ai/utils/query-complexity', () => ({
  analyzeQueryComplexity: vi.fn(() => ({
    level: 'simple',
    score: 10,
    factors: [],
  })),
  shouldForceJobQueue: vi.fn(() => ({ force: false })),
}));

vi.mock('@/hooks/ai/useAsyncAIQuery', () => ({
  useAsyncAIQuery: vi.fn(() => ({
    sendQuery: vi.fn().mockResolvedValue({ jobId: 'test-job' }),
    cancel: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn(),
    isLoading: false,
    progressPercent: 0,
    progressMessage: '',
    jobId: null,
  })),
}));

import { useHybridAIQuery } from '@/hooks/ai/useHybridAIQuery';
// Import after mocks
import type { ClarificationRequest } from '@/lib/ai/clarification-generator';
import { generateClarification } from '@/lib/ai/clarification-generator';

describe('Clarification Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('dismissClarification', () => {
    it('should clear clarification state without executing query', async () => {
      // Given: Mock clarification generation
      const mockClarification: ClarificationRequest = {
        originalQuery: '서버 상태',
        reason: '어떤 서버를 확인하시겠습니까?',
        options: [
          { label: '모든 서버', query: '모든 서버 상태 확인' },
          { label: 'Web 서버', query: 'Web 서버 상태 확인' },
        ],
      };

      vi.mocked(generateClarification).mockReturnValue(mockClarification);

      const { result } = renderHook(() => useHybridAIQuery());

      // When: Send query that triggers clarification
      await act(async () => {
        await result.current.sendQuery('서버 상태');
      });

      // Verify clarification state is set
      expect(result.current.state.clarification).toEqual(mockClarification);

      // When: dismissClarification 호출
      act(() => {
        result.current.dismissClarification();
      });

      // Then: clarification → null, 쿼리 미실행
      expect(result.current.state.clarification).toBeNull();
      expect(result.current.state.isLoading).toBe(false);
    });

    it('should clear pendingQueryRef (internal state)', async () => {
      // Given: clarification 상태가 활성화됨
      const mockClarification: ClarificationRequest = {
        originalQuery: '테스트 쿼리',
        reason: '명확화 필요',
        options: [{ label: '옵션1', query: '명확화된 쿼리' }],
      };

      vi.mocked(generateClarification).mockReturnValue(mockClarification);

      const { result } = renderHook(() => useHybridAIQuery());

      await act(async () => {
        await result.current.sendQuery('테스트 쿼리');
      });

      // When: dismissClarification 호출
      act(() => {
        result.current.dismissClarification();
      });

      // Then: 이후 skipClarification 호출 시 경고 (pending query 없음)
      // skipClarification이 빈 쿼리 방어 로직을 타면 성공
      act(() => {
        result.current.skipClarification();
      });

      // 쿼리가 실행되지 않고 상태가 유지됨
      expect(result.current.state.isLoading).toBe(false);
    });

    it('should clear pendingAttachmentsRef to prevent memory leak', async () => {
      // Given: 파일 첨부가 있는 쿼리 (but clarification doesn't trigger for attachments)
      // 이 테스트는 dismissClarification이 attachments ref를 정리하는지 확인
      const mockClarification: ClarificationRequest = {
        originalQuery: '분석해줘',
        reason: '무엇을 분석할까요?',
        options: [{ label: '서버 로그', query: '서버 로그 분석' }],
      };

      vi.mocked(generateClarification).mockReturnValue(mockClarification);

      const { result } = renderHook(() => useHybridAIQuery());

      // 명확화 트리거
      await act(async () => {
        await result.current.sendQuery('분석해줘');
      });

      expect(result.current.state.clarification).not.toBeNull();

      // When: dismissClarification 호출
      act(() => {
        result.current.dismissClarification();
      });

      // Then: clarification null, 메모리 정리됨 (직접 확인 불가, 간접 확인)
      expect(result.current.state.clarification).toBeNull();

      // 다시 skipClarification 호출 시 아무것도 실행 안 됨
      act(() => {
        result.current.skipClarification();
      });

      expect(result.current.state.isLoading).toBe(false);
    });
  });

  describe('skipClarification', () => {
    it('should execute original query when called', async () => {
      // Given: clarification 상태 + 대기 쿼리
      const mockClarification: ClarificationRequest = {
        originalQuery: '서버 CPU 상태',
        reason: '어떤 서버를 확인하시겠습니까?',
        options: [{ label: 'Web 서버', query: 'Web 서버 CPU 상태' }],
      };

      vi.mocked(generateClarification)
        .mockReturnValueOnce(mockClarification)
        .mockReturnValueOnce(null); // skipClarification 후 재호출 시 null

      const { result } = renderHook(() => useHybridAIQuery());

      await act(async () => {
        await result.current.sendQuery('서버 CPU 상태');
      });

      expect(result.current.state.clarification).not.toBeNull();

      // When: skipClarification 호출
      act(() => {
        result.current.skipClarification();
      });

      // Then: clarification 클리어되고 로딩 시작
      await waitFor(() => {
        expect(result.current.state.clarification).toBeNull();
      });
    });

    it('should handle empty pending query gracefully', () => {
      // Given: 대기 쿼리 없음 (clarification이 없는 상태에서 호출)
      const { result } = renderHook(() => useHybridAIQuery());

      // When: skipClarification 호출 (pending query 없음)
      act(() => {
        result.current.skipClarification();
      });

      // Then: 아무것도 실행되지 않고 clarification은 null
      expect(result.current.state.clarification).toBeNull();
      expect(result.current.state.isLoading).toBe(false);
    });
  });

  describe('selectClarification', () => {
    it('should execute clarified query', async () => {
      // Given: clarification 옵션 존재
      const mockClarification: ClarificationRequest = {
        originalQuery: '서버 상태',
        reason: '어떤 서버를 확인하시겠습니까?',
        options: [
          { label: '모든 서버', query: '모든 서버 상태 확인' },
          { label: 'Web 서버', query: 'Web 서버 상태 확인' },
        ],
      };

      vi.mocked(generateClarification)
        .mockReturnValueOnce(mockClarification)
        .mockReturnValueOnce(null);

      const { result } = renderHook(() => useHybridAIQuery());

      await act(async () => {
        await result.current.sendQuery('서버 상태');
      });

      expect(result.current.state.clarification).not.toBeNull();

      // When: selectClarification 호출
      act(() => {
        result.current.selectClarification(mockClarification.options[1]);
      });

      // Then: clarification 클리어
      await waitFor(() => {
        expect(result.current.state.clarification).toBeNull();
      });
    });
  });

  describe('submitCustomClarification', () => {
    it('should execute custom clarified query', async () => {
      // Given: clarification 상태
      const mockClarification: ClarificationRequest = {
        originalQuery: '서버 분석',
        reason: '어떤 분석이 필요하신가요?',
        options: [{ label: '성능 분석', query: '서버 성능 분석' }],
      };

      vi.mocked(generateClarification)
        .mockReturnValueOnce(mockClarification)
        .mockReturnValueOnce(null);

      const { result } = renderHook(() => useHybridAIQuery());

      await act(async () => {
        await result.current.sendQuery('서버 분석');
      });

      expect(result.current.state.clarification).not.toBeNull();

      // When: submitCustomClarification 호출
      act(() => {
        result.current.submitCustomClarification('CPU 사용률 분석');
      });

      // Then: clarification 클리어
      await waitFor(() => {
        expect(result.current.state.clarification).toBeNull();
      });
    });

    it('should not execute if no pending query', () => {
      // Given: pending query 없음
      const { result } = renderHook(() => useHybridAIQuery());

      // When: submitCustomClarification 호출
      act(() => {
        result.current.submitCustomClarification('커스텀 입력');
      });

      // Then: 아무것도 실행되지 않음
      expect(result.current.state.isLoading).toBe(false);
    });
  });
});
