import type { UIMessage } from '@ai-sdk/react';
import type { Dispatch, SetStateAction } from 'react';
import type { SemanticIntentFrame } from '@/lib/ai/entity-extractor';
import {
  buildSemanticIntentRequestMetadata,
  type SemanticPreprocessingMetadata,
} from '@/lib/ai/semantic-intent-frame';
import { logger } from '@/lib/logging';
import type { HybridQueryState } from '../types/hybrid-query.types';
import { generateMessageId } from '../utils/hybrid-query-utils';
import { buildSourceToolRequestOptions } from './source-tool-request-options';

type SetMessagesLike = (
  updater: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])
) => void;

interface LocalDevSupervisorFallbackParams {
  nextMessages: UIMessage[];
  setMessages: SetMessagesLike;
  setState: Dispatch<SetStateAction<HybridQueryState>>;
  ragEnabled?: boolean;
  webSearchEnabled?: boolean;
  originalQuery: string;
  semanticIntentFrame?: SemanticIntentFrame | null;
  semanticPreprocessing?: SemanticPreprocessingMetadata | null;
}

export function sendLocalDevSupervisorFallback({
  nextMessages,
  setMessages,
  setState,
  ragEnabled,
  webSearchEnabled,
  originalQuery,
  semanticIntentFrame,
  semanticPreprocessing,
}: LocalDevSupervisorFallbackParams): void {
  const semanticIntentPayload = buildSemanticIntentRequestMetadata({
    frame: semanticIntentFrame,
    preprocessing: semanticPreprocessing,
    originalQuery,
  });

  setMessages(nextMessages);

  void fetch('/api/ai/supervisor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      messages: nextMessages,
      ...buildSourceToolRequestOptions({
        webSearchEnabled,
        ragEnabled,
      }),
      ...semanticIntentPayload,
    }),
  })
    .then(async (response) => {
      if (response.status === 202) {
        const data = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        const responseText =
          data.message?.trim() ||
          '복잡한 분석 요청입니다. 비동기 처리 경로에서 다시 시도해주세요.';

        setMessages((prev) => [
          ...prev,
          {
            id: generateMessageId('assistant'),
            role: 'assistant',
            parts: [{ type: 'text', text: responseText }],
          },
        ]);

        setState((prev) => ({
          ...prev,
          isLoading: false,
          warning: null,
          processingTime: 0,
          warmingUp: false,
          estimatedWaitSeconds: 0,
        }));
        return;
      }

      if (!response.ok) {
        throw new Error(`로컬 AI 응답 실패 (${response.status})`);
      }

      const data = (await response.json()) as {
        response?: string;
        message?: string;
        error?: string;
      };
      const responseText =
        data.response?.trim() ||
        data.message?.trim() ||
        data.error?.trim() ||
        '';

      if (!responseText) {
        throw new Error('로컬 AI 응답이 비어 있습니다.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: generateMessageId('assistant'),
          role: 'assistant',
          parts: [{ type: 'text', text: responseText }],
        },
      ]);

      setState((prev) => ({
        ...prev,
        isLoading: false,
        warning: null,
        processingTime: 0,
        warmingUp: false,
        estimatedWaitSeconds: 0,
      }));
    })
    .catch((error) => {
      logger.error('[HybridAI] Local dev supervisor fallback failed:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : '로컬 AI 응답 실패',
        warmingUp: false,
        estimatedWaitSeconds: 0,
      }));
    });
}
