/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useChatQueue } from './useChatQueue';

vi.mock('@/lib/logging', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

describe('useChatQueue', () => {
  it('초기 상태는 빈 큐이다', () => {
    const { result } = renderHook(() => useChatQueue());

    expect(result.current.queuedQueries).toEqual([]);
  });

  it('addToQueue로 메시지를 큐에 추가한다', () => {
    const { result } = renderHook(() => useChatQueue());

    act(() => {
      result.current.addToQueue('첫 번째 질문');
    });

    expect(result.current.queuedQueries).toHaveLength(1);
    expect(result.current.queuedQueries[0]?.text).toBe('첫 번째 질문');
    expect(result.current.queuedQueries[0]?.id).toBe(1);
  });

  it('여러 메시지를 순서대로 큐에 추가한다', () => {
    const { result } = renderHook(() => useChatQueue());

    act(() => {
      result.current.addToQueue('질문 1');
      result.current.addToQueue('질문 2');
      result.current.addToQueue('질문 3');
    });

    expect(result.current.queuedQueries).toHaveLength(3);
    expect(result.current.queuedQueries[0]?.id).toBe(1);
    expect(result.current.queuedQueries[1]?.id).toBe(2);
    expect(result.current.queuedQueries[2]?.id).toBe(3);
  });

  it('첨부 파일과 함께 큐에 추가할 수 있다', () => {
    const { result } = renderHook(() => useChatQueue());
    const attachment = {
      id: 'file-1',
      name: 'test.png',
      type: 'image/png',
      size: 1024,
      dataUrl: 'data:image/png;base64,...',
    };

    act(() => {
      result.current.addToQueue('이미지 분석', [attachment]);
    });

    expect(result.current.queuedQueries[0]?.attachments).toHaveLength(1);
    expect(result.current.queuedQueries[0]?.attachments?.[0]?.name).toBe(
      'test.png'
    );
  });

  it('removeQueuedQuery로 특정 인덱스의 항목을 제거한다', () => {
    const { result } = renderHook(() => useChatQueue());

    act(() => {
      result.current.addToQueue('질문 1');
      result.current.addToQueue('질문 2');
      result.current.addToQueue('질문 3');
    });

    act(() => {
      result.current.removeQueuedQuery(1); // 두 번째 항목 제거
    });

    expect(result.current.queuedQueries).toHaveLength(2);
    expect(result.current.queuedQueries[0]?.text).toBe('질문 1');
    expect(result.current.queuedQueries[1]?.text).toBe('질문 3');
  });

  it('clearQueue로 모든 항목을 제거한다', () => {
    const { result } = renderHook(() => useChatQueue());

    act(() => {
      result.current.addToQueue('질문 1');
      result.current.addToQueue('질문 2');
    });

    act(() => {
      result.current.clearQueue();
    });

    expect(result.current.queuedQueries).toEqual([]);
  });

  it('sendQueryRef가 없으면 popAndSendQueue는 아무것도 하지 않는다', () => {
    const { result } = renderHook(() => useChatQueue());

    act(() => {
      result.current.addToQueue('질문');
    });

    act(() => {
      result.current.popAndSendQueue();
    });

    // sendQueryRef가 null이므로 큐가 유지됨
    expect(result.current.queuedQueries).toHaveLength(1);
  });

  it('sendQueryRef가 설정되면 popAndSendQueue가 병합된 쿼리를 전송한다', async () => {
    const sendFn = vi.fn();
    const { result } = renderHook(() => useChatQueue());

    // sendQueryRef 설정
    act(() => {
      (
        result.current.sendQueryRef as { current: typeof sendFn | null }
      ).current = sendFn;
    });

    act(() => {
      result.current.addToQueue('질문 1');
      result.current.addToQueue('질문 2');
    });

    // queuedQueriesRef를 수동 동기화 (React 배치 업데이트 대응)
    act(() => {
      result.current.popAndSendQueue();
    });

    // queueMicrotask로 전송되므로 대기
    await vi.waitFor(() => {
      expect(sendFn).toHaveBeenCalledTimes(1);
    });

    // 큐가 비워져야 함
    expect(result.current.queuedQueries).toEqual([]);
  });
});
