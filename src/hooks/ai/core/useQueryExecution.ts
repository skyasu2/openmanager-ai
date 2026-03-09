/**
 * Query Execution Hook
 *
 * Extracted from useHybridAIQuery for maintainability.
 * Handles query routing (streaming vs job-queue) and preprocessing (classification + clarification).
 *
 * @created 2026-02-10
 */

import type { UIMessage } from '@ai-sdk/react';
import type { MutableRefObject } from 'react';
import { useCallback } from 'react';
import { generateClarification } from '@/lib/ai/clarification-generator';
import { classifyQuery } from '@/lib/ai/query-classifier';
import {
  analyzeQueryComplexity,
  shouldForceJobQueue,
} from '@/lib/ai/utils/query-complexity';
import { logger } from '@/lib/logging';
import type { HybridQueryState } from '../types/hybrid-query.types';
import type { FileAttachment } from '../useFileAttachments';
import {
  generateMessageId,
  sanitizeMessages,
} from '../utils/hybrid-query-utils';

// ============================================================================
// Types
// ============================================================================

type StateSetter = React.Dispatch<React.SetStateAction<HybridQueryState>>;

interface AsyncQueryLike {
  sendQuery: (query: string) => Promise<{ jobId?: string }>;
}

type SendMessageLike = (message: {
  text: string;
  files?: Array<{
    type: 'file';
    mediaType: string;
    url: string;
    filename?: string;
  }>;
}) => unknown;

type SetMessagesLike = (
  updater: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])
) => void;

export interface QueryExecutionDeps {
  complexityThreshold: number;
  asyncQuery: AsyncQueryLike;
  sendMessage: SendMessageLike;
  onBeforeStreamingSend?: () => void;
  getMessages: () => UIMessage[];
  setMessages: SetMessagesLike;
  setState: StateSetter;
  /** AI SDK useChat의 chatStatus — 동시 요청 방지에 사용 */
  chatStatus: string;
  refs: {
    errorHandled: MutableRefObject<boolean>;
    currentQuery: MutableRefObject<string | null>;
    pendingQuery: MutableRefObject<string | null>;
    pendingAttachments: MutableRefObject<FileAttachment[] | null>;
  };
}

// ============================================================================
// Hook
// ============================================================================

export function useQueryExecution(deps: QueryExecutionDeps) {
  const {
    complexityThreshold,
    asyncQuery,
    sendMessage,
    onBeforeStreamingSend,
    getMessages,
    setMessages,
    setState,
    chatStatus,
    refs,
  } = deps;

  /**
   * 실제 쿼리 전송 로직 (명확화 완료 후 호출)
   * @param query - 텍스트 쿼리
   * @param attachments - 선택적 파일 첨부 (이미지, PDF, MD)
   * @param isRetry - 재시도 여부 (true면 명확화 건너뛰기)
   */
  const executeQuery = useCallback(
    (query: string, attachments?: FileAttachment[], isRetry = false) => {
      // 빈 쿼리 방어
      if (!query || !query.trim()) {
        if (process.env.NODE_ENV === 'development') {
          logger.warn('[HybridAI] executeQuery: Empty query, skipping');
        }
        return;
      }

      // 🔒 P0 Guard: AI SDK가 streaming/submitted 상태이면 새 요청 차단
      // UI disabled만으로는 프로그래매틱 호출(retry, clarification 등)을 방어 불가
      if (chatStatus === 'streaming' || chatStatus === 'submitted') {
        logger.warn(
          `[HybridAI] executeQuery blocked: chatStatus="${chatStatus}" (previous request still active)`
        );
        return;
      }

      const trimmedQuery = query.trim();

      // 🔒 새 요청 시작 시 에러 핸들링 플래그 리셋
      refs.errorHandled.current = false;

      // Redirect 이벤트 처리를 위해 현재 쿼리 저장
      refs.currentQuery.current = trimmedQuery;

      // 1. 복잡도 분석 + 의도 기반 Job Queue 강제 라우팅
      const analysis = analyzeQueryComplexity(trimmedQuery);
      const forceJobQueue = shouldForceJobQueue(trimmedQuery);
      // 파일 첨부 시 Vision Agent가 필요하므로 스트리밍 모드 선호
      const hasAttachments = attachments && attachments.length > 0;
      const isComplex =
        !hasAttachments &&
        (analysis.score > complexityThreshold || forceJobQueue.force);

      if (process.env.NODE_ENV === 'development') {
        logger.info(
          `[HybridAI] Query complexity: ${analysis.level} (score: ${analysis.score}), ` +
            `Force Job Queue: ${forceJobQueue.force}${forceJobQueue.matchedKeyword ? ` (keyword: "${forceJobQueue.matchedKeyword}")` : ''}, ` +
            `Attachments: ${hasAttachments ? attachments!.length : 0}, ` +
            `Mode: ${isComplex ? 'job-queue' : 'streaming'}`
        );
      }

      // AI SDK v6 sendMessage: { text, files } 형식 사용
      type FileUIPart = {
        type: 'file';
        mediaType: string;
        url: string;
        filename?: string;
      };

      // 파일 첨부를 FileUIPart[]로 변환
      const fileUIParts: FileUIPart[] = hasAttachments
        ? attachments!.map((att) => ({
            type: 'file' as const,
            mediaType: att.mimeType,
            url: att.data,
            filename: att.name,
          }))
        : [];

      const buildUserMessage = (): UIMessage => ({
        id: generateMessageId('user'),
        role: 'user' as const,
        parts: [
          { type: 'text' as const, text: trimmedQuery },
          ...fileUIParts,
        ],
      });
      const requestUserMessage = buildUserMessage();

      // 사용자 메시지 생성 (UI 표시용) - isRetry=true일 때는 건너뛰기
      const userMessage: UIMessage | null = isRetry ? null : requestUserMessage;

      const getSanitizedMessagesForSend = () => {
        let cleaned = sanitizeMessages(getMessages());
        if (isRetry && cleaned.length >= 1) {
          let lastUserIdx = -1;
          for (let i = cleaned.length - 1; i >= 0; i--) {
            if (cleaned[i]?.role === 'user') {
              lastUserIdx = i;
              break;
            }
          }
          if (lastUserIdx !== -1) {
            cleaned = cleaned.slice(0, lastUserIdx);
          }
        }
        return cleaned;
      };

      // 2. 모드별 처리
      if (isComplex) {
        // Job Queue 모드: 긴 작업, 진행률 표시
        if (userMessage) {
          setMessages((prev) => [...prev, userMessage]);
        }

        setState((prev) => ({
          ...prev,
          mode: 'job-queue',
          complexity: analysis.level,
          progress: null,
          jobId: null,
          isLoading: true,
          error: null,
          warning: null,
          processingTime: 0,
          clarification: null,
          warmingUp: false,
          estimatedWaitSeconds: 0,
        }));

        asyncQuery
          .sendQuery(trimmedQuery)
          .then((result) => {
            setState((prev) => ({ ...prev, jobId: result.jobId ?? null }));
          })
          .catch((error) => {
            logger.error('[HybridAI] Job Queue query failed:', error);
            setState((prev) => ({
              ...prev,
              isLoading: false,
              error:
                error instanceof Error ? error.message : 'Job Queue 쿼리 실패',
            }));
          });
      } else {
        // Streaming 모드: 빠른 응답
        onBeforeStreamingSend?.();
        setState((prev) => ({
          ...prev,
          mode: 'streaming',
          complexity: analysis.level,
          progress: null,
          jobId: null,
          isLoading: true,
          error: null,
          warning: null,
          processingTime: 0,
          clarification: null,
          warmingUp: true,
          estimatedWaitSeconds: 60,
        }));

        const isLocalDevelopmentHost =
          typeof window !== 'undefined' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(
            window.location.hostname
          );

        const shouldUseLocalDevLegacyFallback =
          process.env.NODE_ENV === 'development' &&
          isLocalDevelopmentHost &&
          !hasAttachments;

        if (shouldUseLocalDevLegacyFallback) {
          const sanitizedMessages = getSanitizedMessagesForSend();
          const nextMessages = [...sanitizedMessages, requestUserMessage];

          setMessages(nextMessages);

          void fetch('/api/ai/supervisor', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({ messages: nextMessages }),
          })
            .then(async (response) => {
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
              logger.error(
                '[HybridAI] Local dev supervisor fallback failed:',
                error
              );
              setState((prev) => ({
                ...prev,
                isLoading: false,
                error:
                  error instanceof Error
                    ? error.message
                    : '로컬 AI 응답 실패',
                warmingUp: false,
                estimatedWaitSeconds: 0,
              }));
            });
          return;
        }

        // P1-11 Fix: flushSync 제거 — React 19 concurrent mode 충돌 방지
        // sanitize 후 queueMicrotask로 sendMessage 호출하여 상태 반영 보장
        setMessages(getSanitizedMessagesForSend());

        // AI SDK v6: sendMessage({ text, files? }) 형식
        const messagePayload = hasAttachments
          ? { text: trimmedQuery, files: fileUIParts }
          : { text: trimmedQuery };

        // queueMicrotask: setMessages 반영 후 sendMessage 호출
        queueMicrotask(() => {
          void Promise.resolve(sendMessage(messagePayload)).catch((error) => {
            logger.error('[HybridAI] Streaming send failed:', error);
            setState((prev) => ({
              ...prev,
              isLoading: false,
              error:
                error instanceof Error ? error.message : '스트리밍 전송 실패',
            }));
          });
        });
      }
    },
    [
      complexityThreshold,
      asyncQuery,
      sendMessage,
      onBeforeStreamingSend,
      getMessages,
      setMessages,
      setState,
      chatStatus,
      refs,
    ]
  );

  /**
   * 쿼리 전처리: 분류 → 명확화 → 실행
   */
  const sendQuery = useCallback(
    async (query: string, attachments?: FileAttachment[]) => {
      if (!query.trim()) return;

      // 원본 쿼리 및 첨부 파일 저장 (명확화 플로우에서 사용)
      refs.pendingQuery.current = query;
      refs.pendingAttachments.current = attachments || null;

      // 초기화
      setState((prev) => ({ ...prev, error: null }));

      try {
        // 파일 첨부가 있으면 명확화 스킵 (Vision Agent 직접 호출)
        if (attachments && attachments.length > 0) {
          if (process.env.NODE_ENV === 'development') {
            logger.info(
              `[HybridAI] Skipping clarification: ${attachments.length} attachment(s) detected`
            );
          }
          executeQuery(query, attachments);
          return;
        }

        // 1. 쿼리 분류 (Groq LLM 사용)
        const classification = await classifyQuery(query);

        if (process.env.NODE_ENV === 'development') {
          logger.info(
            `[HybridAI] Classification: intent=${classification.intent}, complexity=${classification.complexity}, confidence=${classification.confidence}%`
          );
        }

        // 2. 명확화 필요 여부 체크
        const clarificationRequest = generateClarification(
          query,
          classification
        );

        if (clarificationRequest) {
          setState((prev) => ({
            ...prev,
            clarification: clarificationRequest,
          }));
          return;
        }

        // 3. 명확화 불필요: 바로 실행
        executeQuery(query, attachments);
      } catch (error) {
        logger.error('[HybridAI] sendQuery error:', error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error
              ? error.message
              : '쿼리 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        }));
      }
    },
    [executeQuery, setState, refs]
  );

  return { executeQuery, sendQuery };
}
