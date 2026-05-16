/**
 * Message Normalizer Tests
 *
 * @description AI SDK v6 UIMessage와 레거시 메시지 형식 처리 테스트
 */

import type { UIMessage } from '@ai-sdk/react';
import { describe, expect, it } from 'vitest';
import {
  extractLastUserQuery,
  extractTextFromHybridMessage,
  extractTextFromUIMessage,
  type HybridMessage,
  INTERNAL_ERROR_SUPPRESSED_MESSAGE,
  normalizeAIResponse,
  normalizeMessagesForCloudRun,
  RAW_TOOL_CALL_SUPPRESSED_MESSAGE,
} from './message-normalizer';

type ContractUIMessage = UIMessage<
  { traceId?: string },
  { routingDecisionTrace: { selectedMode: 'single' | 'multi' } },
  {
    getServerMetrics: {
      input: { serverId: string };
      output: { cpu: number };
    };
  }
>;

describe('message-normalizer', () => {
  describe('extractTextFromUIMessage', () => {
    it('parts 배열에서 텍스트를 추출한다', () => {
      const message = {
        id: '1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello World' }],
        createdAt: new Date(),
      } as UIMessage;

      expect(extractTextFromUIMessage(message)).toBe('Hello World');
    });

    it('여러 텍스트 파트를 합친다', () => {
      const message = {
        id: '1',
        role: 'user',
        parts: [
          { type: 'text', text: 'Hello' },
          { type: 'text', text: ' World' },
        ],
        createdAt: new Date(),
      } as UIMessage;

      expect(extractTextFromUIMessage(message)).toBe('Hello World');
    });

    it('빈 parts 배열에서 빈 문자열을 반환한다', () => {
      const message = {
        id: '1',
        role: 'user',
        parts: [],
        createdAt: new Date(),
      } as UIMessage;

      expect(extractTextFromUIMessage(message)).toBe('');
    });

    it('텍스트가 아닌 파트는 무시한다', () => {
      const message = {
        id: '1',
        role: 'user',
        parts: [
          { type: 'image', image: 'data:image/png;base64,...' },
          { type: 'text', text: 'Caption' },
        ],
        createdAt: new Date(),
      } as unknown as UIMessage;

      expect(extractTextFromUIMessage(message)).toBe('Caption');
    });

    it('AI SDK v6 UIMessage에서 텍스트 파트만 추출한다', () => {
      const message: ContractUIMessage = {
        id: 'ai-sdk-v6',
        role: 'assistant',
        metadata: { traceId: 'trace-1' },
        parts: [
          { type: 'reasoning', text: 'internal reasoning', state: 'done' },
          { type: 'text', text: 'CPU', state: 'streaming' },
          {
            type: 'data-routingDecisionTrace',
            id: 'route-1',
            data: { selectedMode: 'single' },
          },
          {
            type: 'tool-getServerMetrics',
            toolCallId: 'tool-1',
            state: 'output-available',
            input: { serverId: 'web-nginx-dc1-01' },
            output: { cpu: 91 },
          },
          {
            type: 'source-url',
            sourceId: 'kb-1',
            url: 'https://example.com/runbook',
            title: 'Runbook',
          },
          { type: 'text', text: ' high', state: 'done' },
        ],
      };

      expect(extractTextFromUIMessage(message)).toBe('CPU high');
    });
  });

  describe('extractTextFromHybridMessage', () => {
    it('AI SDK parts 형식에서 텍스트를 추출한다', () => {
      const message: HybridMessage = {
        role: 'user',
        parts: [{ type: 'text', text: 'Hello from parts' }],
      };

      expect(extractTextFromHybridMessage(message)).toBe('Hello from parts');
    });

    it('레거시 content 형식에서 텍스트를 추출한다', () => {
      const message: HybridMessage = {
        role: 'user',
        content: 'Hello from content',
      };

      expect(extractTextFromHybridMessage(message)).toBe('Hello from content');
    });

    it('parts가 있으면 content보다 우선한다', () => {
      const message: HybridMessage = {
        role: 'user',
        parts: [{ type: 'text', text: 'From parts' }],
        content: 'From content',
      };

      expect(extractTextFromHybridMessage(message)).toBe('From parts');
    });

    it('빈 parts와 content가 없으면 빈 문자열을 반환한다', () => {
      const message: HybridMessage = {
        role: 'user',
      };

      expect(extractTextFromHybridMessage(message)).toBe('');
    });

    it('여러 텍스트 파트를 줄바꿈으로 합친다', () => {
      const message: HybridMessage = {
        role: 'user',
        parts: [
          { type: 'text', text: 'Line 1' },
          { type: 'text', text: 'Line 2' },
        ],
      };

      expect(extractTextFromHybridMessage(message)).toBe('Line 1\nLine 2');
    });

    it('혼합 parts에서 text만 추출한다 (image 무시)', () => {
      const message: HybridMessage = {
        role: 'user',
        parts: [
          { type: 'text', text: '이미지 설명:' },
          { type: 'image', text: undefined },
          { type: 'text', text: '추가 질문' },
        ],
      };

      expect(extractTextFromHybridMessage(message)).toBe(
        '이미지 설명:\n추가 질문'
      );
    });

    it('혼합 parts에서 text만 추출한다 (tool-call 무시)', () => {
      const message: HybridMessage = {
        role: 'assistant',
        parts: [
          { type: 'text', text: '도구를 실행합니다' },
          { type: 'tool-call', text: undefined },
        ],
      };

      expect(extractTextFromHybridMessage(message)).toBe('도구를 실행합니다');
    });

    it('parts에 text가 없으면 content로 폴백한다', () => {
      const message: HybridMessage = {
        role: 'user',
        parts: [{ type: 'image', text: undefined }],
        content: 'content에서 추출',
      };

      expect(extractTextFromHybridMessage(message)).toBe('content에서 추출');
    });

    it('유니코드와 이모지를 올바르게 처리한다', () => {
      const message: HybridMessage = {
        role: 'user',
        parts: [{ type: 'text', text: '한글 테스트 🎉 emoji' }],
      };

      expect(extractTextFromHybridMessage(message)).toBe(
        '한글 테스트 🎉 emoji'
      );
    });

    it('줄바꿈 문자가 포함된 텍스트를 처리한다', () => {
      const message: HybridMessage = {
        role: 'user',
        parts: [{ type: 'text', text: '첫 줄\n둘째 줄\n셋째 줄' }],
      };

      expect(extractTextFromHybridMessage(message)).toBe(
        '첫 줄\n둘째 줄\n셋째 줄'
      );
    });
  });

  describe('normalizeMessagesForCloudRun', () => {
    it('메시지 배열을 Cloud Run 형식으로 변환한다', () => {
      const messages: HybridMessage[] = [
        { role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
        { role: 'assistant', content: 'Hi there' },
      ];

      const result = normalizeMessagesForCloudRun(messages);

      expect(result).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ]);
    });

    it('빈 content를 플레이스홀더로 대체한다', () => {
      const messages: HybridMessage[] = [
        { role: 'user', parts: [] },
        { role: 'assistant', parts: [{ type: 'image', text: undefined }] },
      ];

      const result = normalizeMessagesForCloudRun(messages);

      expect(result).toEqual([
        { role: 'user', content: '[Non-text content]' },
        { role: 'assistant', content: '[Non-text content]' },
      ]);
    });

    it('빈 배열은 빈 배열을 반환한다', () => {
      expect(normalizeMessagesForCloudRun([])).toEqual([]);
    });

    it('다중 메시지 순서를 유지한다', () => {
      const messages: HybridMessage[] = [
        { role: 'user', parts: [{ type: 'text', text: '질문입니다' }] },
        { role: 'assistant', parts: [{ type: 'text', text: '답변입니다' }] },
        { role: 'user', parts: [{ type: 'text', text: '후속 질문' }] },
      ];

      const result = normalizeMessagesForCloudRun(messages);

      expect(result).toHaveLength(3);
      expect(result[0].content).toBe('질문입니다');
      expect(result[1].content).toBe('답변입니다');
      expect(result[2].content).toBe('후속 질문');
    });

    it('메시지 role을 보존한다', () => {
      const messages: HybridMessage[] = [
        { role: 'system', content: '시스템 프롬프트' },
        { role: 'user', parts: [{ type: 'text', text: '사용자 질문' }] },
        { role: 'assistant', parts: [{ type: 'text', text: 'AI 응답' }] },
      ];

      const result = normalizeMessagesForCloudRun(messages);

      expect(result.map((m) => m.role)).toEqual([
        'system',
        'user',
        'assistant',
      ]);
    });

    it('연속된 비텍스트 메시지도 모두 보존한다', () => {
      const messages: HybridMessage[] = [
        { role: 'user', parts: [{ type: 'text', text: '여러 이미지야' }] },
        { role: 'user', parts: [{ type: 'image', text: undefined }] },
        { role: 'user', parts: [{ type: 'image', text: undefined }] },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: '이미지 확인' }],
        },
      ];

      const result = normalizeMessagesForCloudRun(messages);

      expect(result).toHaveLength(4);
      expect(result[1].content).toBe('[Non-text content]');
      expect(result[2].content).toBe('[Non-text content]');
    });

    it('긴 텍스트를 처리한다', () => {
      const longText = 'A'.repeat(10000);
      const messages: HybridMessage[] = [
        { role: 'user', parts: [{ type: 'text', text: longText }] },
      ];

      const result = normalizeMessagesForCloudRun(messages);

      expect(result[0].content).toBe(longText);
      expect(result[0].content.length).toBe(10000);
    });

    it('AI SDK v6 FileUIPart와 UI 전용 파트를 Cloud Run 형식으로 정규화한다', () => {
      const parts = [
        { type: 'text', text: '로그 파일 확인' },
        {
          type: 'file',
          url: 'data:text/plain;base64,bG9n',
          mediaType: 'text/plain',
          filename: 'error.log',
        },
        {
          type: 'file',
          url: 'data:image/png;base64,Y2hhcnQ=',
          mediaType: 'image/png',
          filename: 'chart.png',
        },
        {
          type: 'data-routingDecisionTrace',
          id: 'route-1',
          data: { selectedMode: 'single' },
        },
        {
          type: 'source-url',
          sourceId: 'kb-1',
          url: 'https://example.com/runbook',
          title: 'Runbook',
        },
      ] as unknown as HybridMessage['parts'];

      const messages: HybridMessage[] = [{ role: 'user', parts }];

      const result = normalizeMessagesForCloudRun(messages);

      expect(result).toEqual([
        {
          role: 'user',
          content: '로그 파일 확인',
          images: [
            {
              data: 'data:image/png;base64,Y2hhcnQ=',
              mimeType: 'image/png',
              name: 'chart.png',
            },
          ],
          files: [
            {
              data: 'data:text/plain;base64,bG9n',
              mimeType: 'text/plain',
              name: 'error.log',
            },
          ],
        },
      ]);
    });
  });

  describe('회귀 테스트', () => {
    it('빈 content 필터링으로 인한 맥락 소실을 방지한다', () => {
      const messages: HybridMessage[] = [
        { role: 'user', parts: [{ type: 'text', text: '이 사진 뭐야?' }] },
        { role: 'user', parts: [{ type: 'image', text: undefined }] },
        { role: 'assistant', parts: [{ type: 'text', text: '고양이입니다' }] },
      ];

      const result = normalizeMessagesForCloudRun(messages);

      expect(result).toHaveLength(3);
      expect(result[1].content).toBe('[Non-text content]');
      expect(result[1].role).toBe('user');
    });

    it('Tool Call 메시지를 보존한다', () => {
      const messages: HybridMessage[] = [
        { role: 'user', parts: [{ type: 'text', text: '서버 상태 확인해줘' }] },
        {
          role: 'assistant',
          parts: [{ type: 'tool-call', text: undefined }],
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: '서버 정상입니다' }],
        },
      ];

      const result = normalizeMessagesForCloudRun(messages);

      expect(result).toHaveLength(3);
      expect(result[1].content).toBe('[Non-text content]');
    });
  });

  describe('normalizeMessagesForCloudRun image deduplication', () => {
    it('type:image와 type:file 파트에서 동일 이미지 중복을 제거한다', () => {
      const messages: HybridMessage[] = [
        {
          role: 'user',
          parts: [
            { type: 'text', text: '이 이미지 분석해줘' },
            // type:'image' 파트
            { type: 'image', image: 'data:image/png;base64,abc123' },
            // type:'file' 파트 (동일 이미지 데이터)
            {
              type: 'file',
              url: 'data:image/png;base64,abc123',
              mediaType: 'image/png',
            },
          ],
        },
      ];

      const result = normalizeMessagesForCloudRun(messages);

      // 이미지가 1개만 있어야 함 (중복 제거됨)
      expect(result[0].images).toHaveLength(1);
      expect(result[0].images![0].data).toBe('data:image/png;base64,abc123');
    });

    it('서로 다른 이미지는 모두 보존한다', () => {
      const messages: HybridMessage[] = [
        {
          role: 'user',
          parts: [
            { type: 'text', text: '두 이미지 비교해줘' },
            { type: 'image', image: 'data:image/png;base64,image1' },
            {
              type: 'file',
              url: 'data:image/png;base64,image2',
              mediaType: 'image/png',
            },
          ],
        },
      ];

      const result = normalizeMessagesForCloudRun(messages);

      // 서로 다른 이미지이므로 2개 모두 보존
      expect(result[0].images).toHaveLength(2);
      expect(result[0].images![0].data).toBe('data:image/png;base64,image1');
      expect(result[0].images![1].data).toBe('data:image/png;base64,image2');
    });
  });

  describe('extractLastUserQuery', () => {
    it('마지막 사용자 메시지를 추출한다', () => {
      const messages: HybridMessage[] = [
        { role: 'user', content: 'First question' },
        { role: 'assistant', content: 'First answer' },
        { role: 'user', content: 'Second question' },
      ];

      expect(extractLastUserQuery(messages)).toBe('Second question');
    });

    it('사용자 메시지가 없으면 빈 문자열을 반환한다', () => {
      const messages: HybridMessage[] = [
        { role: 'assistant', content: 'Hello' },
        { role: 'system', content: 'System prompt' },
      ];

      expect(extractLastUserQuery(messages)).toBe('');
    });

    it('빈 배열에서 빈 문자열을 반환한다', () => {
      expect(extractLastUserQuery([])).toBe('');
    });

    it('parts 형식의 마지막 사용자 메시지를 추출한다', () => {
      const messages: HybridMessage[] = [
        { role: 'user', content: 'Old format' },
        { role: 'user', parts: [{ type: 'text', text: 'New format' }] },
      ];

      expect(extractLastUserQuery(messages)).toBe('New format');
    });
  });

  describe('normalizeAIResponse', () => {
    it('raw function-call JSON은 안전 안내문으로 정규화한다', () => {
      const rawToolCall = JSON.stringify({
        type: 'function',
        name: 'analyzePattern',
        arguments: {
          query: '지난 1시간 동안 장애 징후가 있었던 구간만 요약해줘',
        },
      });

      expect(normalizeAIResponse(rawToolCall)).toBe(
        RAW_TOOL_CALL_SUPPRESSED_MESSAGE
      );
    });

    it('fenced raw function-call JSON도 안전 안내문으로 정규화한다', () => {
      const rawToolCall = [
        '```json',
        JSON.stringify({
          type: 'function',
          name: 'analyzePattern',
          arguments: { query: '장애 징후 요약' },
        }),
        '```',
      ].join('\n');

      expect(normalizeAIResponse(rawToolCall)).toBe(
        RAW_TOOL_CALL_SUPPRESSED_MESSAGE
      );
    });

    it('AI SDK tool-call JSON 배열도 안전 안내문으로 정규화한다', () => {
      const rawToolCall = JSON.stringify({
        toolCalls: [
          {
            type: 'tool-call',
            toolName: 'getServerMetrics',
            args: { serverId: 'web-01' },
          },
        ],
      });

      expect(normalizeAIResponse(rawToolCall)).toBe(
        RAW_TOOL_CALL_SUPPRESSED_MESSAGE
      );
    });

    it('provider 내부 오류 JSON은 사용자 본문에서 차단한다', () => {
      const internalError = JSON.stringify({
        error: 'empty response Authorization: Bearer sk-test-1234567890abcdef',
        provider: 'cerebras',
        modelId: 'llama3.1-8b',
        fallbackReason: 'empty_response',
      });

      expect(normalizeAIResponse(internalError)).toBe(
        INTERNAL_ERROR_SUPPRESSED_MESSAGE
      );
      expect(normalizeAIResponse(internalError)).not.toContain(
        'sk-test-1234567890abcdef'
      );
    });

    it('answer JSON은 표시 가능한 텍스트로 정규화한다', () => {
      const response = JSON.stringify({
        answer: '지난 1시간 동안 장애 징후는 1건입니다.',
        confidence: 0.8,
      });

      expect(normalizeAIResponse(response)).toBe(
        '지난 1시간 동안 장애 징후는 1건입니다.'
      );
    });
  });
});
