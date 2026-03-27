/**
 * Clarification Handlers Hook
 *
 * Extracted from useHybridAIQuery for maintainability.
 * Provides select, submit, skip, and dismiss clarification actions.
 *
 * @created 2026-01-30
 */

import { type MutableRefObject, useCallback } from 'react';
import {
  applyClarification,
  applyCustomClarification,
} from '@/lib/ai/clarification-generator';
import { logger } from '@/lib/logging';
import type {
  ClarificationOption,
  HybridQueryState,
} from '../types/hybrid-query.types';
import type { FileAttachment } from '../useFileAttachments';

type StateSetter = React.Dispatch<React.SetStateAction<HybridQueryState>>;

interface ClarificationDeps {
  pendingQueryRef: MutableRefObject<string | null>;
  pendingAttachmentsRef: MutableRefObject<FileAttachment[] | null>;
  executeQuery: (
    query: string,
    attachments?: FileAttachment[],
    isRetry?: boolean
  ) => void;
  setState: StateSetter;
}

export function useClarificationHandlers(deps: ClarificationDeps) {
  const { pendingQueryRef, pendingAttachmentsRef, executeQuery, setState } =
    deps;

  /**
   * 명확화 옵션 선택
   */
  const selectClarification = useCallback(
    (option: ClarificationOption) => {
      const clarifiedQuery = applyClarification(option);
      setState((prev) => ({ ...prev, clarification: null }));
      executeQuery(clarifiedQuery, pendingAttachmentsRef.current || undefined);
    },
    [executeQuery, setState, pendingAttachmentsRef]
  );

  /**
   * 커스텀 명확화 입력
   */
  const submitCustomClarification = useCallback(
    (customInput: string) => {
      if (!pendingQueryRef.current) return;

      const clarifiedQuery = applyCustomClarification(
        pendingQueryRef.current,
        customInput
      );

      setState((prev) => ({ ...prev, clarification: null }));
      executeQuery(clarifiedQuery, pendingAttachmentsRef.current || undefined);
    },
    [executeQuery, setState, pendingQueryRef, pendingAttachmentsRef]
  );

  /**
   * 명확화 건너뛰기 - 원본 쿼리 그대로 실행
   */
  const skipClarification = useCallback(() => {
    const query = pendingQueryRef.current;
    const attachments = pendingAttachmentsRef.current;

    if (!query || !query.trim()) {
      if (process.env.NODE_ENV === 'development') {
        logger.warn('[HybridAI] skipClarification: No pending query to send');
      }
      setState((prev) => ({ ...prev, clarification: null }));
      return;
    }

    setState((prev) => ({ ...prev, clarification: null }));
    executeQuery(query, attachments || undefined);
  }, [executeQuery, setState, pendingQueryRef, pendingAttachmentsRef]);

  /**
   * 명확화 취소 - 쿼리 미실행, 상태 정리만
   */
  const dismissClarification = useCallback(() => {
    setState((prev) => ({ ...prev, clarification: null }));
    pendingQueryRef.current = null;
    pendingAttachmentsRef.current = null;
  }, [setState, pendingQueryRef, pendingAttachmentsRef]);

  return {
    selectClarification,
    submitCustomClarification,
    skipClarification,
    dismissClarification,
  };
}
