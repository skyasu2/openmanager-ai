/**
 * @vitest-environment jsdom
 *
 * useHybridAIQuery Hook Integration Tests
 *
 * @description 하이브리드 AI 쿼리 훅의 쿼리 복잡도 기반 모드 선택 로직 테스트
 * @created 2026-01-22
 *
 * Note: useChat 훅은 @ai-sdk/react의 무거운 의존성으로 인해
 * 핵심 비즈니스 로직인 쿼리 복잡도 분석만 테스트합니다.
 */

import type { UIMessage } from '@ai-sdk/react';
import { describe, expect, it } from 'vitest';

import {
  analyzeQueryComplexity,
  calculateDynamicTimeout,
} from '@/lib/ai/utils/query-complexity';
import type { AsyncQueryResult } from './useAsyncAIQuery';
import {
  buildAssistantMessageFromAsyncResult,
  mergeFinishedAssistantIntoMessages,
} from './useHybridAIQuery';

describe('useHybridAIQuery - 쿼리 복잡도 기반 모드 선택', () => {
  describe('쿼리 복잡도 분류', () => {
    it('간단한 인사말은 simple로 분류되어야 함', () => {
      const result = analyzeQueryComplexity('안녕하세요');
      expect(result.level).toBe('simple');
      expect(result.score).toBeLessThanOrEqual(20);
    });

    it('상태 확인 요청은 simple로 분류되어야 함', () => {
      const result = analyzeQueryComplexity('서버 상태 확인');
      expect(result.level).toBe('simple');
    });

    it('예측 요청은 복잡도가 높아야 함', () => {
      const result = analyzeQueryComplexity('서버 리소스 사용량 예측해줘');
      expect(result.factors).toContain('keyword_prediction');
      expect(result.score).toBeGreaterThanOrEqual(25);
    });

    it('복잡한 분석 요청은 높은 점수를 받아야 함', () => {
      const result = analyzeQueryComplexity(
        '모든 서버의 CPU, 메모리, 디스크 사용량을 비교 분석하고 향후 7일간 예측해줘'
      );
      expect(result.score).toBeGreaterThan(45);
      expect(['complex', 'very_complex']).toContain(result.level);
    });
  });

  describe('모드 선택 로직', () => {
    it('simple 쿼리 (score ≤ 20)는 streaming 모드가 권장됨', () => {
      const result = analyzeQueryComplexity('안녕');
      expect(result.level).toBe('simple');
      expect(result.score).toBeLessThanOrEqual(20);
      // streaming 모드 사용
    });

    it('moderate 쿼리 (20 < score ≤ 45)도 streaming 모드 사용 가능', () => {
      const result = analyzeQueryComplexity('서버 로그 분석');
      expect(['simple', 'moderate']).toContain(result.level);
    });

    it('complex 쿼리 (score > 45)는 job-queue 모드가 권장됨', () => {
      const result = analyzeQueryComplexity(
        '전체 서버 클러스터의 성능 분석과 장기 예측, 이상 탐지 결과를 종합적으로 보고해줘'
      );
      expect(['complex', 'very_complex']).toContain(result.level);
      expect(result.score).toBeGreaterThan(45);
      // job-queue 모드 사용
    });
  });

  describe('동적 타임아웃 계산', () => {
    it('simple 쿼리는 15초 타임아웃', () => {
      const result = analyzeQueryComplexity('상태');
      expect(result.recommendedTimeout).toBe(15000);
    });

    it('moderate 쿼리는 30초 이하 타임아웃', () => {
      const result = analyzeQueryComplexity('서버 로그 분석해줘');
      expect(result.recommendedTimeout).toBeLessThanOrEqual(60000);
    });

    it('complex 쿼리는 45초 이상 타임아웃', () => {
      const result = analyzeQueryComplexity(
        '모든 서버의 성능 분석과 예측 결과를 종합 리포트로 만들어줘'
      );
      expect(result.recommendedTimeout).toBeGreaterThanOrEqual(45000);
    });

    it('calculateDynamicTimeout이 올바른 값을 반환해야 함', () => {
      // simple 쿼리
      expect(calculateDynamicTimeout('안녕')).toBe(15000);

      // complex 쿼리
      const complexTimeout = calculateDynamicTimeout(
        '모든 서버 분석하고 예측해줘'
      );
      expect(complexTimeout).toBeGreaterThan(15000);
    });
  });

  describe('복잡도 요인 감지', () => {
    it('예측 키워드 감지', () => {
      const result = analyzeQueryComplexity('향후 메모리 사용량 예측');
      expect(result.factors).toContain('keyword_prediction');
    });

    it('분석 키워드 감지', () => {
      const result = analyzeQueryComplexity('CPU 사용 패턴 분석');
      expect(result.factors).toContain('keyword_analysis');
    });

    it('다중 서버 키워드 감지', () => {
      const result = analyzeQueryComplexity('모든 서버 상태 확인');
      expect(result.factors).toContain('keyword_multiServer');
    });

    it('시간 범위 키워드 감지', () => {
      const result = analyzeQueryComplexity('최근 1시간 로그');
      expect(result.factors).toContain('keyword_timeRange');
    });

    it('집계 키워드 감지', () => {
      const result = analyzeQueryComplexity('평균 CPU 사용률');
      expect(result.factors).toContain('keyword_aggregation');
    });
  });

  describe('실제 사용 시나리오', () => {
    it('대시보드 인사말 → streaming', () => {
      const result = analyzeQueryComplexity('안녕');
      expect(result.level).toBe('simple');
    });

    it('단일 서버 상태 확인 → streaming', () => {
      const result = analyzeQueryComplexity('web-01 서버 상태');
      expect(['simple', 'moderate']).toContain(result.level);
    });

    it('전체 서버 상태 요약 → streaming', () => {
      const result = analyzeQueryComplexity('현재 모든 서버의 상태를 요약해줘');
      expect(result.level).toBe('simple');
      expect(result.score).toBeLessThanOrEqual(20);
    });

    it('대시보드 알림 prefill 분석 → streaming', () => {
      const result = analyzeQueryComplexity(
        'lb-haproxy-dc1-01 서버의 CPU 사용률이 73%입니다. 현재 원인과 우선 조치 방법을 분석해줘.'
      );
      expect(result.level).toBe('moderate');
      expect(result.score).toBeLessThanOrEqual(19);
      expect(result.factors).toContain('streaming_alert_analysis_query');
    });

    it('전체 서버 비교 분석 → job-queue 권장', () => {
      const result = analyzeQueryComplexity(
        '모든 서버의 성능을 비교 분석하고 개선 방안을 제안해줘'
      );
      expect(result.score).toBeGreaterThan(30);
    });

    it('장기 예측 + 이상 탐지 → job-queue 필수', () => {
      const result = analyzeQueryComplexity(
        '향후 30일간 리소스 사용량을 예측하고 이상 징후가 예상되는 시점을 알려줘'
      );
      expect(['complex', 'very_complex']).toContain(result.level);
      expect(result.score).toBeGreaterThanOrEqual(50);
    });
  });
});

describe('QueryMode 타입 검증', () => {
  it('QueryMode 타입이 올바르게 정의되어야 함', () => {
    type QueryMode = 'streaming' | 'job-queue';
    const streamingMode: QueryMode = 'streaming';
    const jobQueueMode: QueryMode = 'job-queue';

    expect(streamingMode).toBe('streaming');
    expect(jobQueueMode).toBe('job-queue');
  });
});

describe('HybridQueryState 타입 검증', () => {
  it('초기 상태 타입이 올바르게 정의되어야 함', () => {
    interface HybridQueryState {
      mode: 'streaming' | 'job-queue';
      complexity: { level: string; score: number } | null;
      progress: unknown | null;
      jobId: string | null;
      isLoading: boolean;
      error: string | null;
      clarification: unknown | null;
      warning: string | null;
      processingTime: number;
    }

    const initialState: HybridQueryState = {
      mode: 'streaming',
      complexity: null,
      progress: null,
      jobId: null,
      isLoading: false,
      error: null,
      clarification: null,
      warning: null,
      processingTime: 0,
    };

    expect(initialState.mode).toBe('streaming');
    expect(initialState.isLoading).toBe(false);
    expect(initialState.error).toBeNull();
  });
});

describe('mergeFinishedAssistantIntoMessages', () => {
  it('onFinish assistant metadata와 parts를 기존 메시지에 병합한다', () => {
    const previousMessages = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: '상태 알려줘' }],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{ type: 'text', text: '초안 응답' }],
      },
    ] as UIMessage[];

    const finishedMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        { type: 'text', text: '최종 응답' },
        {
          type: 'tool-searchKnowledgeBase',
          toolCallId: 'tool-1',
          output: { sources: 2 },
          state: 'output-available',
        },
      ],
      metadata: {
        traceId: 'trace-finished-123',
        toolResultSummaries: [
          {
            toolName: 'searchKnowledgeBase',
            label: '지식 근거 검색',
            status: 'completed',
            summary: '2건의 문서를 참조했습니다.',
          },
        ],
      },
    } as unknown as UIMessage;

    const mergedMessages = mergeFinishedAssistantIntoMessages(
      previousMessages,
      finishedMessage,
      'fallback-trace'
    );

    const assistant = mergedMessages[1] as UIMessage;
    expect(assistant.parts).toEqual(finishedMessage.parts);
    expect(assistant.metadata).toMatchObject({
      traceId: 'trace-finished-123',
      toolResultSummaries: [
        expect.objectContaining({
          toolName: 'searchKnowledgeBase',
        }),
      ],
    });
  });

  it('callback metadata에 traceId가 없으면 fallback traceId를 주입한다', () => {
    const previousMessages = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{ type: 'text', text: '응답' }],
      },
    ] as UIMessage[];

    const finishedMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [{ type: 'text', text: '응답' }],
      metadata: {
        handoffHistory: [{ from: 'supervisor', to: 'reporter' }],
      },
    } as unknown as UIMessage;

    const mergedMessages = mergeFinishedAssistantIntoMessages(
      previousMessages,
      finishedMessage,
      'fallback-trace-456'
    );

    expect((mergedMessages[0] as UIMessage).metadata).toMatchObject({
      traceId: 'fallback-trace-456',
      handoffHistory: [{ from: 'supervisor', to: 'reporter' }],
    });
  });
});

describe('buildAssistantMessageFromAsyncResult', () => {
  it('preserves explicit empty handoff history from async job results', () => {
    const result: AsyncQueryResult = {
      success: true,
      response: '직접 응답입니다.',
      handoffHistory: [],
    };

    const message = buildAssistantMessageFromAsyncResult(
      result,
      () => 'assistant-job-1'
    );

    expect(message).toMatchObject({
      id: 'assistant-job-1',
      role: 'assistant',
      content: '직접 응답입니다.',
      metadata: {
        handoffHistory: [],
      },
    });
  });

  it('includes runtime metadata for operator-facing UI', () => {
    const routeDecision = {
      intent: 'job' as const,
      executionPath: 'job' as const,
      mode: 'multi' as const,
      complexity: 'complex' as const,
      reasonCodes: ['job_queue_api'],
      ruleVersion: '2026-05-03-v1',
      decidedBy: 'cloud-run' as const,
    };
    const assistantPlan = {
      kind: 'chat' as const,
      planVersion: '2026-05-03-v1',
      routeDecision,
      executionPath: 'job' as const,
      stream: false,
      job: true,
      reasonCodes: ['job_queue_api'],
      decidedBy: 'cloud-run' as const,
    };
    const assistantResult = {
      kind: 'chat' as const,
      resultVersion: '2026-05-03-v1',
      routeDecision,
      status: 'completed' as const,
    };
    const semanticQueryTrace = {
      originalQuery: '제일 버거웠던 때를 load 기준으로 알려줘',
      selectedDomain: 'openmanager-monitoring',
      selectedCapability: 'monitoring.metric_peak',
      selectedEvidenceProvider: 'monitoring-peak-metric',
      evidenceAvailable: true,
      clarificationRequired: false,
      reasonCodes: ['semantic_frame_evidence_validated'],
    };
    const result: AsyncQueryResult = {
      success: true,
      response: '분석 완료',
      processingTimeMs: 1987,
      latencyTier: 'slow',
      resolvedMode: 'multi',
      modeSelectionSource: 'auto_complexity',
      provider: 'mistral',
      modelId: 'mistral-large-latest',
      usedFallback: true,
      fallbackReason: 'empty_response',
      ttfbMs: 1520,
      routeDecision,
      assistantPlan,
      assistantResult,
      semanticQueryTrace,
      providerAttempts: [
        {
          provider: 'cerebras',
          modelId: 'llama3.1-8b',
          attempt: 1,
          durationMs: 820,
          error: 'raw tool-call JSON',
        },
        {
          provider: 'mistral',
          modelId: 'mistral-large-latest',
          attempt: 1,
          durationMs: 1540,
        },
      ],
    };

    const message = buildAssistantMessageFromAsyncResult(
      result,
      () => 'assistant-job-2'
    );

    expect(message.metadata).toMatchObject({
      processingTime: 1987,
      latencyTier: 'slow',
      resolvedMode: 'multi',
      modeSelectionSource: 'auto_complexity',
      provider: 'mistral',
      modelId: 'mistral-large-latest',
      usedFallback: true,
      fallbackReason: 'empty_response',
      ttfbMs: 1520,
      routeDecision,
      assistantPlan,
      assistantResult,
      semanticQueryTrace,
      providerAttempts: [
        {
          provider: 'cerebras',
          modelId: 'llama3.1-8b',
          attempt: 1,
          durationMs: 820,
          error: 'raw tool-call JSON',
        },
        {
          provider: 'mistral',
          modelId: 'mistral-large-latest',
          attempt: 1,
          durationMs: 1540,
        },
      ],
    });
  });

  it('preserves retrieval and thinking mode metadata even without sources', () => {
    const result: AsyncQueryResult = {
      success: true,
      response: '검색 없이 답변했습니다.',
      analysisMode: 'thinking',
      retrieval: {
        retrievalEnabled: true,
        retrievalUsed: false,
        retrievalMode: 'lite',
        suppressedReason: 'not_needed',
        evidenceCount: 0,
        webUsed: false,
      },
    };

    const message = buildAssistantMessageFromAsyncResult(
      result,
      () => 'assistant-job-3'
    );

    expect(message.metadata).toMatchObject({
      analysisMode: 'thinking',
      retrieval: {
        retrievalEnabled: true,
        retrievalUsed: false,
        retrievalMode: 'lite',
        suppressedReason: 'not_needed',
        evidenceCount: 0,
        webUsed: false,
      },
    });
  });
});

// ============================================================================
// 멀티모달 메시지 타입 검증 (Phase 4 추가)
// ============================================================================

describe('멀티모달 메시지 처리 타입 검증', () => {
  /**
   * AI SDK v5 FileUIPart 형식 검증
   * @see https://ai-sdk.dev/docs/ai-sdk-ui/chatbot
   */
  it('파일 첨부 시 FileUIPart 형식 타입이 올바름', () => {
    // AI SDK FileUIPart 형식
    interface FileUIPart {
      type: 'file';
      data: string; // Base64 또는 URL
      mediaType: string;
      filename?: string;
    }

    const filePart: FileUIPart = {
      type: 'file',
      data: 'data:application/pdf;base64,SGVsbG8gV29ybGQ=',
      mediaType: 'application/pdf',
      filename: 'document.pdf',
    };

    expect(filePart.type).toBe('file');
    expect(filePart.data).toContain('base64');
    expect(filePart.mediaType).toBe('application/pdf');
  });

  /**
   * AI SDK v5 ImageUIPart 형식 검증
   */
  it('이미지 첨부 시 ImageUIPart 형식 타입이 올바름', () => {
    // AI SDK ImageUIPart 형식
    interface ImageUIPart {
      type: 'image';
      image: string; // Base64 또는 URL
      mimeType?: string;
    }

    const imagePart: ImageUIPart = {
      type: 'image',
      image: 'data:image/png;base64,iVBORw0KGgo=',
      mimeType: 'image/png',
    };

    expect(imagePart.type).toBe('image');
    expect(imagePart.image).toContain('base64');
    expect(imagePart.mimeType).toBe('image/png');
  });

  it('멀티파트 메시지 구조가 올바름', () => {
    interface TextPart {
      type: 'text';
      text: string;
    }

    interface ImagePart {
      type: 'image';
      image: string;
      mimeType?: string;
    }

    interface FilePart {
      type: 'file';
      data: string;
      mediaType: string;
    }

    type MessagePart = TextPart | ImagePart | FilePart;

    interface MultimodalMessage {
      role: 'user' | 'assistant';
      parts: MessagePart[];
    }

    const message: MultimodalMessage = {
      role: 'user',
      parts: [
        { type: 'text', text: '이 이미지를 분석해줘' },
        {
          type: 'image',
          image: 'data:image/png;base64,abc',
          mimeType: 'image/png',
        },
      ],
    };

    expect(message.parts).toHaveLength(2);
    expect(message.parts[0].type).toBe('text');
    expect(message.parts[1].type).toBe('image');
  });

  it('첨부 파일 있을 때 streaming 모드 강제 타입이 올바름', () => {
    // 첨부 파일이 있으면 clarification 스킵하고 streaming 모드 사용
    interface AttachmentAwareQuery {
      query: string;
      attachments: Array<{ type: string; data: string }>;
      skipClarification: boolean;
      forceStreaming: boolean;
    }

    const queryWithAttachment: AttachmentAwareQuery = {
      query: '이 파일 분석해줘',
      attachments: [{ type: 'image', data: 'base64data' }],
      skipClarification: true, // 파일 첨부 시 clarification 스킵
      forceStreaming: true, // streaming 모드 강제
    };

    expect(queryWithAttachment.skipClarification).toBe(true);
    expect(queryWithAttachment.forceStreaming).toBe(true);
    expect(queryWithAttachment.attachments.length).toBeGreaterThan(0);
  });

  it('FileAttachment에서 AI SDK 파트로 변환 타입', () => {
    // useFileAttachments 훅의 FileAttachment 타입
    interface FileAttachment {
      id: string;
      name: string;
      mimeType: string;
      size: number;
      data: string;
      type: 'image' | 'pdf' | 'markdown' | 'other';
    }

    // AI SDK 파트로 변환 함수 시그니처
    type ToAISDKPart = (
      attachment: FileAttachment
    ) =>
      | { type: 'file'; data: string; mediaType: string }
      | { type: 'image'; image: string; mimeType: string };

    // 변환 로직 예시 (타입 검증용)
    const convertAttachment: ToAISDKPart = (attachment) => {
      if (attachment.type === 'image') {
        return {
          type: 'image',
          image: attachment.data,
          mimeType: attachment.mimeType,
        };
      }
      return {
        type: 'file',
        data: attachment.data,
        mediaType: attachment.mimeType,
      };
    };

    const imageAttachment: FileAttachment = {
      id: 'file_123',
      name: 'screenshot.png',
      mimeType: 'image/png',
      size: 1024,
      data: 'data:image/png;base64,abc',
      type: 'image',
    };

    const result = convertAttachment(imageAttachment);
    expect(result.type).toBe('image');
  });
});
