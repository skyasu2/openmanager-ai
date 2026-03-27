'use client';

/**
 * useDeferredMessageMetadata
 *
 * 스트리밍 완료 후 비동기로 도착하는 메타데이터/툴 결과를 메시지 ID별로 관리.
 *
 * useAIChatCore에서 분리된 단일 책임 훅:
 * - pendingStreamToolResults / pendingStreamMessageMetadata refs 관리
 * - 스트림 완료 시 마지막 assistant 메시지에 flush
 * - streamTraceIds / deferredAssistantMetadata / deferredToolResults 상태 노출
 *
 * @created 2026-03-24
 */

import type { UIMessage } from '@ai-sdk/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PendingStreamToolResult } from './utils/stream-data-handler';

// ============================================================================
// Types
// ============================================================================

export interface DeferredMetadataHandlers {
  setMessageTraceId: (messageId: string, traceId: string) => void;
  getPendingToolResults: () => PendingStreamToolResult[];
  setPendingToolResults: (results: PendingStreamToolResult[]) => void;
  getPendingMessageMetadata: () => Record<string, unknown>;
  setPendingMessageMetadata: (metadata: Record<string, unknown>) => void;
  setDeferredAssistantMetadata: (
    messageId: string,
    metadata: Record<string, unknown>
  ) => void;
  setDeferredAssistantToolResults: (
    messageId: string,
    toolResults: PendingStreamToolResult[]
  ) => void;
}

export interface UseDeferredMessageMetadataReturn {
  streamTraceIds: Record<string, string>;
  deferredAssistantMetadataByMessageId: Record<string, Record<string, unknown>>;
  deferredToolResultsByMessageId: Record<string, PendingStreamToolResult[]>;
  handlers: DeferredMetadataHandlers;
  resetDeferredMetadata: () => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * @param messages - useHybridAIQuery의 messages (flush 시 마지막 assistant 찾기용)
 */
export function useDeferredMessageMetadata(
  messages: UIMessage[]
): UseDeferredMessageMetadataReturn {
  const [streamTraceIds, setStreamTraceIds] = useState<Record<string, string>>(
    {}
  );
  const [
    deferredAssistantMetadataByMessageId,
    setDeferredAssistantMetadataByMessageId,
  ] = useState<Record<string, Record<string, unknown>>>({});
  const [deferredToolResultsByMessageId, setDeferredToolResultsByMessageId] =
    useState<Record<string, PendingStreamToolResult[]>>({});

  const pendingStreamToolResultsRef = useRef<PendingStreamToolResult[]>([]);
  const pendingStreamMessageMetadataRef = useRef<Record<string, unknown>>({});

  // ============================================================================
  // Flush Effect: messages 변경 시 pending refs → deferred state로 이관
  // ============================================================================

  useEffect(() => {
    const pendingToolResults = pendingStreamToolResultsRef.current;
    const pendingMessageMetadata = pendingStreamMessageMetadataRef.current;
    const hasPendingMessageMetadata =
      Object.keys(pendingMessageMetadata).length > 0;

    if (pendingToolResults.length === 0 && !hasPendingMessageMetadata) {
      return;
    }

    const lastAssistantIndex = messages
      .map((message) => message.role)
      .lastIndexOf('assistant');
    if (lastAssistantIndex < 0) return;

    const targetMessage = messages[lastAssistantIndex];
    if (!targetMessage) return;

    if (typeof pendingMessageMetadata.traceId === 'string') {
      const traceId = pendingMessageMetadata.traceId;
      setStreamTraceIds((prev) =>
        prev[targetMessage.id] === traceId
          ? prev
          : { ...prev, [targetMessage.id]: traceId }
      );
    }

    if (hasPendingMessageMetadata) {
      setDeferredAssistantMetadataByMessageId((prev) => ({
        ...prev,
        [targetMessage.id]: {
          ...(prev[targetMessage.id] ?? {}),
          ...pendingMessageMetadata,
        },
      }));
    }

    if (pendingToolResults.length > 0) {
      setDeferredToolResultsByMessageId((prev) => ({
        ...prev,
        [targetMessage.id]: pendingToolResults,
      }));
    }

    pendingStreamToolResultsRef.current = [];
    pendingStreamMessageMetadataRef.current = {};
  }, [messages]);

  // ============================================================================
  // Handlers (onData 콜백에서 사용)
  // ============================================================================

  const setMessageTraceId = useCallback(
    (messageId: string, traceId: string) => {
      setStreamTraceIds((prev) =>
        prev[messageId] === traceId ? prev : { ...prev, [messageId]: traceId }
      );
    },
    []
  );

  const getPendingToolResults = useCallback(
    () => pendingStreamToolResultsRef.current,
    []
  );
  const setPendingToolResults = useCallback(
    (results: PendingStreamToolResult[]) => {
      pendingStreamToolResultsRef.current = results;
    },
    []
  );

  const getPendingMessageMetadata = useCallback(
    () => pendingStreamMessageMetadataRef.current,
    []
  );
  const setPendingMessageMetadata = useCallback(
    (metadata: Record<string, unknown>) => {
      pendingStreamMessageMetadataRef.current = metadata;
    },
    []
  );

  const setDeferredAssistantMetadata = useCallback(
    (messageId: string, metadata: Record<string, unknown>) => {
      setDeferredAssistantMetadataByMessageId((prev) => ({
        ...prev,
        [messageId]: {
          ...(prev[messageId] ?? {}),
          ...metadata,
        },
      }));
    },
    []
  );

  const setDeferredAssistantToolResults = useCallback(
    (messageId: string, toolResults: PendingStreamToolResult[]) => {
      setDeferredToolResultsByMessageId((prev) => ({
        ...prev,
        [messageId]: toolResults,
      }));
    },
    []
  );

  const resetDeferredMetadata = useCallback(() => {
    setStreamTraceIds({});
    setDeferredAssistantMetadataByMessageId({});
    setDeferredToolResultsByMessageId({});
    pendingStreamToolResultsRef.current = [];
    pendingStreamMessageMetadataRef.current = {};
  }, []);

  return {
    streamTraceIds,
    deferredAssistantMetadataByMessageId,
    deferredToolResultsByMessageId,
    handlers: {
      setMessageTraceId,
      getPendingToolResults,
      setPendingToolResults,
      getPendingMessageMetadata,
      setPendingMessageMetadata,
      setDeferredAssistantMetadata,
      setDeferredAssistantToolResults,
    },
    resetDeferredMetadata,
  };
}
