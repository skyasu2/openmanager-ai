'use client';

import { useCallback, useRef, useState } from 'react';
import { logger } from '@/lib/logging';
import type { FileAttachment } from '../useFileAttachments';

export interface QueuedQuery {
  id: number;
  text: string;
  attachments?: FileAttachment[];
}

export interface UseChatQueueReturn {
  queuedQueries: QueuedQuery[];
  queuedQueriesRef: React.RefObject<QueuedQuery[]>;
  addToQueue: (text: string, attachments?: FileAttachment[]) => void;
  removeQueuedQuery: (index: number) => void;
  popAndSendQueue: () => void;
  clearQueue: () => void;
  /** Ref to hold the send function — set externally after useHybridAIQuery */
  sendQueryRef: React.RefObject<
    ((query: string, attachments?: FileAttachment[]) => void) | null
  >;
}

/**
 * 메시지 대기열(Batching) 관리 훅
 *
 * 스트리밍 중 사용자가 추가 질문을 입력하면 큐에 쌓고,
 * 스트리밍 완료 후 일괄 전송합니다.
 */
export function useChatQueue(): UseChatQueueReturn {
  const queueIdCounter = useRef(0);
  const [queuedQueries, setQueuedQueries] = useState<QueuedQuery[]>([]);
  const queuedQueriesRef = useRef(queuedQueries);

  const sendQueryRef = useRef<
    ((query: string, attachments?: FileAttachment[]) => void) | null
  >(null);

  const removeQueuedQuery = useCallback((index: number) => {
    setQueuedQueries((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      queuedQueriesRef.current = updated;
      return updated;
    });
  }, []);

  const addToQueue = useCallback(
    (text: string, attachments?: FileAttachment[]) => {
      const id = ++queueIdCounter.current;
      const item: QueuedQuery = { id, text, attachments };
      setQueuedQueries((prev) => {
        const updated = [...prev, item];
        queuedQueriesRef.current = updated;
        return updated;
      });
    },
    []
  );

  const popAndSendQueue = useCallback(() => {
    const sendFn = sendQueryRef.current;
    if (queuedQueriesRef.current.length === 0 || !sendFn) return;

    const queries = queuedQueriesRef.current;
    queuedQueriesRef.current = [];
    setQueuedQueries([]);

    const combinedText =
      queries.length === 1
        ? (queries[0]?.text ?? '')
        : queries.map((q) => q.text).join('\n\n추가 질문:\n');
    const combinedAttachments = queries.flatMap((q) => q.attachments || []);

    logger.info(
      `[ChatQueue] Flushing ${queries.length} queued message(s) as single query`
    );

    queueMicrotask(() => {
      sendFn(
        combinedText,
        combinedAttachments.length > 0 ? combinedAttachments : undefined
      );
    });
  }, []);

  const clearQueue = useCallback(() => {
    setQueuedQueries([]);
    queuedQueriesRef.current = [];
  }, []);

  return {
    queuedQueries,
    queuedQueriesRef,
    addToQueue,
    removeQueuedQuery,
    popAndSendQueue,
    clearQueue,
    sendQueryRef,
  };
}
