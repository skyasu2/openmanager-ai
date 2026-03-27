/**
 * OpenAI API Handlers
 *
 * OpenAI ChatGPT API를 모킹합니다.
 *
 * @endpoint https://api.openai.com/v1/chat/completions
 * @see https://platform.openai.com/docs/api-reference/chat/create
 */

import { HttpResponse, http } from 'msw';

const OPENAI_BASE_URL = 'https://api.openai.com';

/**
 * OpenAI API 핸들러
 */
export const openAIHandlers = [
  /**
   * Chat Completions - 채팅 완성 API
   *
   * @example POST /v1/chat/completions
   */
  http.post(`${OPENAI_BASE_URL}/v1/chat/completions`, async ({ request }) => {
    const body = (await request.json()) as {
      model: string;
      messages: Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
      }>;
      temperature?: number;
      max_tokens?: number;
    };

    // 마지막 사용자 메시지 추출
    const userMessage =
      body.messages.filter((m) => m.role === 'user').pop()?.content || '';

    // Mock 응답 생성
    const mockResponse = {
      id: `chatcmpl-mock-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: body.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: `[OpenAI Mock Response] 질문: "${userMessage}"\n\n모킹된 응답입니다. 실제 OpenAI API 호출이 아닙니다.`,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: userMessage.length / 4, // 대략적인 토큰 수
        completion_tokens: 50,
        total_tokens: userMessage.length / 4 + 50,
      },
    };

    console.log(
      `[MSW] OpenAI API Mocked: model=${body.model}, message="${userMessage.substring(0, 50)}..."`
    );

    return HttpResponse.json(mockResponse, { status: 200 });
  }),

  /**
   * Models List - 모델 목록 API
   *
   * @example GET /v1/models
   */
  http.get(`${OPENAI_BASE_URL}/v1/models`, () => {
    console.log('[MSW] OpenAI Models List Mocked');

    return HttpResponse.json(
      {
        object: 'list',
        data: [
          {
            id: 'gpt-4',
            object: 'model',
            created: 1687882411,
            owned_by: 'openai',
          },
          {
            id: 'gpt-3.5-turbo',
            object: 'model',
            created: 1677610602,
            owned_by: 'openai',
          },
        ],
      },
      { status: 200 }
    );
  }),
];
