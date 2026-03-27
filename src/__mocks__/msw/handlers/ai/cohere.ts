/**
 * Cohere API Handlers
 *
 * Cohere AI API를 모킹합니다.
 *
 * @endpoint https://api.cohere.ai/v1/generate
 * @see https://docs.cohere.com/reference/generate
 */

import { HttpResponse, http } from 'msw';

const COHERE_BASE_URL = 'https://api.cohere.ai';

/**
 * Cohere API 핸들러
 */
export const cohereHandlers = [
  /**
   * Generate - 텍스트 생성 API
   *
   * @example POST /v1/generate
   */
  http.post(`${COHERE_BASE_URL}/v1/generate`, async ({ request }) => {
    const body = (await request.json()) as {
      model: string;
      prompt: string;
      max_tokens?: number;
      temperature?: number;
      k?: number;
      p?: number;
    };

    // Mock 응답 생성
    const mockResponse = {
      id: `mock-${Date.now()}`,
      generations: [
        {
          id: `mock-gen-${Date.now()}`,
          text: `[Cohere Mock Response] 프롬프트: "${body.prompt}"\n\n모킹된 응답입니다. 실제 Cohere API 호출이 아닙니다.`,
          finish_reason: 'COMPLETE',
        },
      ],
      prompt: body.prompt,
      meta: {
        api_version: {
          version: '1',
        },
        billed_units: {
          input_tokens: body.prompt.length / 4, // 대략적인 토큰 수
          output_tokens: 50,
        },
      },
    };

    console.log(
      `[MSW] Cohere API Mocked: model=${body.model}, prompt="${body.prompt.substring(0, 50)}..."`
    );

    return HttpResponse.json(mockResponse, { status: 200 });
  }),

  /**
   * Chat - 채팅 API
   *
   * @example POST /v1/chat
   */
  http.post(`${COHERE_BASE_URL}/v1/chat`, async ({ request }) => {
    const body = (await request.json()) as {
      model: string;
      message: string;
      chat_history?: Array<{
        role: string;
        message: string;
      }>;
    };

    // Mock 응답 생성
    const mockResponse = {
      response_id: `mock-chat-${Date.now()}`,
      text: `[Cohere Chat Mock Response] 메시지: "${body.message}"\n\n모킹된 응답입니다. 실제 Cohere API 호출이 아닙니다.`,
      generation_id: `mock-gen-${Date.now()}`,
      chat_history: [
        ...(body.chat_history || []),
        {
          role: 'USER',
          message: body.message,
        },
        {
          role: 'CHATBOT',
          message: `[Cohere Chat Mock Response] 메시지: "${body.message}"\n\n모킹된 응답입니다.`,
        },
      ],
      finish_reason: 'COMPLETE',
      meta: {
        api_version: {
          version: '1',
        },
        billed_units: {
          input_tokens: body.message.length / 4,
          output_tokens: 50,
        },
      },
    };

    console.log(
      `[MSW] Cohere Chat API Mocked: model=${body.model}, message="${body.message.substring(0, 50)}..."`
    );

    return HttpResponse.json(mockResponse, { status: 200 });
  }),
];
