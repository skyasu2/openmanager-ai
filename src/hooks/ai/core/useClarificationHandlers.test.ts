/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { HybridQueryState } from '../types/hybrid-query.types';
import { useClarificationHandlers } from './useClarificationHandlers';

function createInitialState(): HybridQueryState {
  return {
    mode: 'streaming',
    complexity: null,
    progress: null,
    jobId: null,
    isLoading: false,
    error: null,
    errorDetails: null,
    clarification: {
      question: '대상을 선택해주세요',
      reason: '테스트',
      options: [],
      originalQuery: '원본 질의',
    },
    warning: null,
    processingTime: 0,
    warmingUp: false,
    estimatedWaitSeconds: 0,
  };
}

describe('useClarificationHandlers', () => {
  it('skipClarification은 원본 쿼리를 즉시 실행한다', () => {
    const pendingQueryRef = { current: '현재 서버 상태를 한 줄로 요약해줘' };
    const pendingAttachmentsRef = {
      current: [
        {
          id: 'file-1',
          name: 'sample.png',
          mimeType: 'image/png',
          size: 1024,
          data: 'data:image/png;base64,AAA=',
          type: 'image',
        },
      ],
    };
    const executeQuery = vi.fn();
    const setState = vi.fn();

    const { result } = renderHook(() =>
      useClarificationHandlers({
        pendingQueryRef,
        pendingAttachmentsRef,
        executeQuery,
        setState,
      })
    );

    act(() => {
      result.current.skipClarification();
    });

    expect(executeQuery).toHaveBeenCalledWith(
      '현재 서버 상태를 한 줄로 요약해줘',
      pendingAttachmentsRef.current
    );
    expect(setState).toHaveBeenCalled();
    const updater = setState.mock.calls[0]?.[0] as
      | ((prev: HybridQueryState) => HybridQueryState)
      | undefined;
    expect(updater?.(createInitialState()).clarification).toBeNull();
  });

  it('skipClarification은 pending query가 없으면 실행을 건너뛰고 상태만 정리한다', () => {
    const pendingQueryRef = { current: null as string | null };
    const pendingAttachmentsRef = { current: null };
    const executeQuery = vi.fn();
    const setState = vi.fn();

    const { result } = renderHook(() =>
      useClarificationHandlers({
        pendingQueryRef,
        pendingAttachmentsRef,
        executeQuery,
        setState,
      })
    );

    act(() => {
      result.current.skipClarification();
    });

    expect(executeQuery).not.toHaveBeenCalled();
    expect(setState).toHaveBeenCalled();
  });

  it('dismissClarification은 pending query/attachments를 비운다', () => {
    const pendingQueryRef = { current: '원본 질의' };
    const pendingAttachmentsRef = {
      current: [
        {
          id: 'file-1',
          name: 'sample.png',
          mimeType: 'image/png',
          size: 1024,
          data: 'data:image/png;base64,AAA=',
          type: 'image',
        },
      ],
    };
    const executeQuery = vi.fn();
    const setState = vi.fn();

    const { result } = renderHook(() =>
      useClarificationHandlers({
        pendingQueryRef,
        pendingAttachmentsRef,
        executeQuery,
        setState,
      })
    );

    act(() => {
      result.current.dismissClarification();
    });

    expect(pendingQueryRef.current).toBeNull();
    expect(pendingAttachmentsRef.current).toBeNull();
    expect(executeQuery).not.toHaveBeenCalled();
    expect(setState).toHaveBeenCalled();
  });
});
