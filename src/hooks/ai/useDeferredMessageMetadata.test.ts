/**
 * @vitest-environment jsdom
 */

import type { UIMessage } from '@ai-sdk/react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDeferredMessageMetadata } from './useDeferredMessageMetadata';
import type { PendingStreamToolResult } from './utils/stream-data-handler';

function createTextMessage(
  id: string,
  role: UIMessage['role'],
  text: string
): UIMessage {
  return {
    id,
    role,
    parts: [{ type: 'text', text }],
  };
}

const pendingToolResults: PendingStreamToolResult[] = [
  {
    toolName: 'getServerMetrics',
    result: {
      dataSlot: {
        slotIndex: 123,
        minuteOfDay: 1230,
        timeLabel: '20:30 KST',
      },
    },
  },
];

describe('useDeferredMessageMetadata', () => {
  it('messages 변경 시 pending metadata와 tool results를 마지막 assistant에 flush한다', async () => {
    const { result, rerender } = renderHook(
      ({ messages }: { messages: UIMessage[] }) =>
        useDeferredMessageMetadata(messages),
      {
        initialProps: {
          messages: [createTextMessage('user-1', 'user', '서버 상태 알려줘')],
        },
      }
    );

    act(() => {
      result.current.handlers.setPendingMessageMetadata({
        traceId: 'trace-flush-1',
        responseSummary: '요약',
      });
      result.current.handlers.setPendingToolResults(pendingToolResults);
    });

    rerender({
      messages: [
        createTextMessage('user-1', 'user', '서버 상태 알려줘'),
        createTextMessage('assistant-1', 'assistant', '확인 중입니다.'),
      ],
    });

    await waitFor(() => {
      expect(result.current.streamTraceIds['assistant-1']).toBe(
        'trace-flush-1'
      );
    });

    expect(
      result.current.deferredAssistantMetadataByMessageId['assistant-1']
    ).toMatchObject({
      traceId: 'trace-flush-1',
      responseSummary: '요약',
    });
    expect(
      result.current.deferredToolResultsByMessageId['assistant-1']
    ).toEqual(pendingToolResults);
    expect(result.current.handlers.getPendingMessageMetadata()).toEqual({});
    expect(result.current.handlers.getPendingToolResults()).toEqual([]);
  });

  it('기존 assistant가 있어도 새 assistant가 추가되면 pending metadata를 마지막 assistant에 flush한다', async () => {
    const existingAssistant = createTextMessage(
      'assistant-1',
      'assistant',
      '이전 응답'
    );

    const { result, rerender } = renderHook(
      ({ messages }: { messages: UIMessage[] }) =>
        useDeferredMessageMetadata(messages),
      {
        initialProps: {
          messages: [
            createTextMessage('user-1', 'user', '첫 질문'),
            existingAssistant,
            createTextMessage('user-2', 'user', '추가 질문'),
          ],
        },
      }
    );

    act(() => {
      result.current.handlers.setPendingMessageMetadata({
        traceId: 'trace-flush-latest',
        responseSummary: '최신 응답 요약',
      });
      result.current.handlers.setPendingToolResults(pendingToolResults);
    });

    rerender({
      messages: [
        createTextMessage('user-1', 'user', '첫 질문'),
        existingAssistant,
        createTextMessage('user-2', 'user', '추가 질문'),
        createTextMessage('assistant-2', 'assistant', '최신 응답'),
      ],
    });

    await waitFor(() => {
      expect(result.current.streamTraceIds['assistant-2']).toBe(
        'trace-flush-latest'
      );
    });

    expect(result.current.streamTraceIds['assistant-1']).toBeUndefined();
    expect(
      result.current.deferredAssistantMetadataByMessageId['assistant-2']
    ).toMatchObject({
      traceId: 'trace-flush-latest',
      responseSummary: '최신 응답 요약',
    });
    expect(
      result.current.deferredAssistantMetadataByMessageId['assistant-1']
    ).toBeUndefined();
    expect(
      result.current.deferredToolResultsByMessageId['assistant-2']
    ).toEqual(pendingToolResults);
  });

  it('기존 deferred metadata를 유지한 채 traceId와 신규 metadata를 merge한다', async () => {
    const assistantMessage = createTextMessage(
      'assistant-1',
      'assistant',
      '분석 결과입니다.'
    );

    const { result, rerender } = renderHook(
      ({ messages }: { messages: UIMessage[] }) =>
        useDeferredMessageMetadata(messages),
      {
        initialProps: {
          messages: [
            createTextMessage('user-1', 'user', '분석해줘'),
            assistantMessage,
          ],
        },
      }
    );

    act(() => {
      result.current.handlers.setDeferredAssistantMetadata('assistant-1', {
        assistantResponseView: {
          summary: '기존 요약',
        },
      });
      result.current.handlers.setPendingMessageMetadata({
        traceId: 'trace-merge-1',
        dataSourceLabel: '서버 실시간 데이터 분석',
      });
    });

    rerender({
      messages: [
        createTextMessage('user-1', 'user', '분석해줘'),
        assistantMessage,
        createTextMessage('user-2', 'user', '추가 질문'),
      ],
    });

    await waitFor(() => {
      expect(result.current.streamTraceIds['assistant-1']).toBe(
        'trace-merge-1'
      );
    });

    expect(
      result.current.deferredAssistantMetadataByMessageId['assistant-1']
    ).toMatchObject({
      traceId: 'trace-merge-1',
      dataSourceLabel: '서버 실시간 데이터 분석',
      assistantResponseView: {
        summary: '기존 요약',
      },
    });
  });

  it('resetDeferredMetadata가 state와 pending refs를 모두 초기화한다', async () => {
    const { result } = renderHook(() =>
      useDeferredMessageMetadata([createTextMessage('user-1', 'user', '질문')])
    );

    act(() => {
      result.current.handlers.setMessageTraceId('assistant-1', 'trace-reset-1');
      result.current.handlers.setDeferredAssistantMetadata('assistant-1', {
        responseSummary: '요약',
      });
      result.current.handlers.setDeferredAssistantToolResults(
        'assistant-1',
        pendingToolResults
      );
      result.current.handlers.setPendingMessageMetadata({ traceId: 'pending' });
      result.current.handlers.setPendingToolResults(pendingToolResults);
    });

    await waitFor(() => {
      expect(result.current.streamTraceIds['assistant-1']).toBe(
        'trace-reset-1'
      );
    });
    expect(result.current.handlers.getPendingMessageMetadata()).toEqual({
      traceId: 'pending',
    });
    expect(result.current.handlers.getPendingToolResults()).toEqual(
      pendingToolResults
    );

    act(() => {
      result.current.resetDeferredMetadata();
    });

    expect(result.current.streamTraceIds).toEqual({});
    expect(result.current.deferredAssistantMetadataByMessageId).toEqual({});
    expect(result.current.deferredToolResultsByMessageId).toEqual({});
    expect(result.current.handlers.getPendingMessageMetadata()).toEqual({});
    expect(result.current.handlers.getPendingToolResults()).toEqual([]);
  });
});
