/**
 * Query Control Functions Hook
 *
 * Extracted from useHybridAIQuery for maintainability.
 * Provides stop, cancel, reset, and previewComplexity actions.
 *
 * @created 2026-02-10
 */

import type { UIMessage } from '@ai-sdk/react';
import type { MutableRefObject } from 'react';
import { useCallback } from 'react';
import { generateTraceId } from '@/config/ai-proxy.config';
import {
  analyzeQueryComplexity,
  type QueryComplexity,
} from '@/lib/ai/utils/query-complexity';
import type { HybridQueryState, QueryMode } from '../types/hybrid-query.types';
import type { FileAttachment } from '../useFileAttachments';

// ============================================================================
// Types
// ============================================================================

type StateSetter = React.Dispatch<React.SetStateAction<HybridQueryState>>;

interface AsyncQueryControlLike {
  cancel: () => Promise<void>;
  reset: () => void;
}

type SetMessagesLike = (
  updater: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])
) => void;

export interface QueryControlDeps {
  currentMode: QueryMode;
  asyncQuery: AsyncQueryControlLike;
  stopChat: () => void;
  setMessages: SetMessagesLike;
  setState: StateSetter;
  refs: {
    abortController: MutableRefObject<AbortController | null>;
    retryTimeout: MutableRefObject<ReturnType<typeof setTimeout> | null>;
    retryCount: MutableRefObject<number>;
    traceId: MutableRefObject<string>;
    pendingQuery: MutableRefObject<string | null>;
    pendingAttachments: MutableRefObject<FileAttachment[] | null>;
    currentQuery: MutableRefObject<string | null>;
  };
}

// ============================================================================
// Hook
// ============================================================================

export function useQueryControls(deps: QueryControlDeps) {
  const { currentMode, asyncQuery, stopChat, setMessages, setState, refs } =
    deps;

  const stop = useCallback(() => {
    // AbortController cleanup on stop
    refs.abortController.current?.abort();
    refs.abortController.current = null;
    if (refs.retryTimeout.current) {
      clearTimeout(refs.retryTimeout.current);
      refs.retryTimeout.current = null;
    }

    if (currentMode === 'streaming') {
      stopChat();
    }
    setState((prev) => ({ ...prev, isLoading: false }));
  }, [currentMode, stopChat, setState, refs]);

  const cancel = useCallback(async () => {
    if (currentMode === 'job-queue') {
      await asyncQuery.cancel();
    } else {
      stopChat();
    }
    setState((prev) => ({ ...prev, isLoading: false }));
  }, [currentMode, asyncQuery, stopChat, setState]);

  const reset = useCallback(() => {
    // AbortController cleanup on reset
    refs.abortController.current?.abort();
    refs.abortController.current = null;
    if (refs.retryTimeout.current) {
      clearTimeout(refs.retryTimeout.current);
      refs.retryTimeout.current = null;
    }

    // Reset retry count and generate new trace ID
    refs.retryCount.current = 0;
    refs.traceId.current = generateTraceId();

    asyncQuery.reset();
    setMessages([]);
    refs.pendingQuery.current = null;
    refs.pendingAttachments.current = null;
    refs.currentQuery.current = null;
    setState({
      mode: 'streaming',
      complexity: null,
      progress: null,
      jobId: null,
      isLoading: false,
      error: null,
      clarification: null,
      warning: null,
      processingTime: 0,
    });
  }, [asyncQuery, setMessages, setState, refs]);

  const previewComplexity = useCallback((query: string): QueryComplexity => {
    return analyzeQueryComplexity(query).level;
  }, []);

  return { stop, cancel, reset, previewComplexity };
}
