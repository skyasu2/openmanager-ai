import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGenerateText, mockGetAdvisorModel } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockGetAdvisorModel: vi.fn(),
}));

vi.mock('ai', () => ({
  generateText: mockGenerateText,
}));

vi.mock('./agents/config/agent-model-selectors', () => ({
  getAdvisorModel: mockGetAdvisorModel,
}));

vi.mock('./routing/query-routing-signals', () => ({
  FORCE_KB_QUERY_PATTERN: /./,
}));

vi.mock('./supervisor-stream-citations', () => ({
  buildGroundedKRLSystemPrompt: vi.fn(() => 'mock-grounded-system-prompt'),
  buildKnowledgeBaseGroundedAnswer: vi.fn(
    (_query: string) => '템플릿 답변: 내부 근거 기반'
  ),
}));

vi.mock('./supervisor-multi-fallback', () => ({
  buildDegradedMetadata: vi.fn(() => ({})),
}));

vi.mock('./supervisor-mode', () => ({
  buildSupervisorAssistantResult: vi.fn(() => ({})),
  buildSupervisorModeMetadata: vi.fn(() => ({})),
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../lib/ai-sdk-utils', () => ({
  extractRagSources: vi.fn(() => []),
}));

import { streamDirectKnowledgeSearchIfMatched } from './supervisor-direct-knowledge-stream';
import type { SupervisorRequest } from './supervisor-types';

async function drainGenerator(
  gen: AsyncGenerator<unknown, boolean>
): Promise<{ events: unknown[]; returned: boolean }> {
  const events: unknown[] = [];
  while (true) {
    const { value, done } = await gen.next();
    if (done) return { events, returned: value as boolean };
    events.push(value);
  }
}

function makeRequest(): SupervisorRequest {
  return {
    mode: 'auto',
    messages: [{ role: 'user', content: 'KRL 근거로 요약해줘' }],
    sessionId: 'test-direct-kb',
    enableRAG: 'auto',
    enableWebSearch: false,
  } as unknown as SupervisorRequest;
}

function makeTools(executeResult: unknown) {
  return {
    searchKnowledgeBase: { execute: vi.fn(async () => executeResult) },
  };
}

const KB_RESULT_WITH_DATA = {
  results: [
    {
      id: 'krl-1',
      title: 'OTel SSOT 문서',
      content: 'OpenManager는 pre-generated OTel 데이터를 SSOT로 사용합니다.',
      sourceType: 'knowledge',
      score: 0.91,
    },
  ],
};

describe('streamDirectKnowledgeSearchIfMatched', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('LLM synthesis 성공 시 LLM 응답 text_delta와 groundingMode=llm-synthesized를 반환한다', async () => {
    mockGetAdvisorModel.mockReturnValue({
      model: { modelId: 'mistral-medium' },
      provider: 'mistral',
      modelId: 'mistral-medium',
    });
    mockGenerateText.mockResolvedValue({
      text: 'LLM이 합성한 KRL 답변입니다.',
      steps: [],
      usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
    });

    const tools = makeTools(KB_RESULT_WITH_DATA);
    const { events, returned } = await drainGenerator(
      streamDirectKnowledgeSearchIfMatched({
        request: makeRequest(),
        queryText: 'KRL 근거로 요약해줘',
        filteredTools: tools as never,
      })
    );

    expect(returned).toBe(true);

    const textDeltas = events
      .filter((e) => (e as { type: string }).type === 'text_delta')
      .map((e) => String((e as { data: unknown }).data));
    expect(textDeltas.join('')).toContain('LLM이 합성한 KRL 답변입니다.');

    const doneEvent = events.find((e) => (e as { type: string }).type === 'done');
    expect(doneEvent).toMatchObject({
      type: 'done',
      data: {
        success: true,
        toolsCalled: ['searchKnowledgeBase'],
        metadata: {
          provider: 'mistral',
          modelId: 'mistral-medium',
          groundingMode: 'llm-synthesized',
          kbSourceCount: 1,
        },
      },
    });
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.1,
        maxOutputTokens: 800,
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' }),
        ]),
      })
    );
  });

  it('LLM 실패 시 GROUNDED_LLM_FAILED 경고 후 template-fallback으로 전환한다', async () => {
    mockGetAdvisorModel.mockReturnValue({
      model: { modelId: 'mistral-medium' },
      provider: 'mistral',
      modelId: 'mistral-medium',
    });
    mockGenerateText.mockRejectedValue(new Error('rate limit exceeded'));

    const tools = makeTools(KB_RESULT_WITH_DATA);
    const { events, returned } = await drainGenerator(
      streamDirectKnowledgeSearchIfMatched({
        request: makeRequest(),
        queryText: 'KRL 근거로 요약해줘',
        filteredTools: tools as never,
      })
    );

    expect(returned).toBe(true);

    const warningEvent = events.find(
      (e) => (e as { type: string }).type === 'warning'
    );
    expect(warningEvent).toMatchObject({
      type: 'warning',
      data: { code: 'GROUNDED_LLM_FAILED' },
    });

    const textDeltas = events
      .filter((e) => (e as { type: string }).type === 'text_delta')
      .map((e) => String((e as { data: unknown }).data));
    expect(textDeltas.join('')).toContain('템플릿 답변');

    const doneEvent = events.find((e) => (e as { type: string }).type === 'done');
    expect(doneEvent).toMatchObject({
      type: 'done',
      data: {
        success: true,
        metadata: {
          provider: 'deterministic',
          modelId: 'knowledge-search-direct',
          groundingMode: 'template-fallback',
        },
      },
    });
  });

  it('KB 결과가 없으면 LLM을 호출하지 않고 template-fallback을 반환한다', async () => {
    const tools = makeTools({ results: [] });
    const { events, returned } = await drainGenerator(
      streamDirectKnowledgeSearchIfMatched({
        request: makeRequest(),
        queryText: 'KRL 근거로 요약해줘',
        filteredTools: tools as never,
      })
    );

    expect(returned).toBe(true);
    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(mockGetAdvisorModel).not.toHaveBeenCalled();

    const doneEvent = events.find((e) => (e as { type: string }).type === 'done');
    expect(doneEvent).toMatchObject({
      type: 'done',
      data: {
        success: true,
        metadata: {
          provider: 'deterministic',
          modelId: 'knowledge-search-direct',
          groundingMode: 'template-fallback',
          kbSourceCount: 0,
        },
      },
    });
  });

  it('searchKnowledgeBase tool이 없으면 이벤트 없이 false를 반환한다', async () => {
    const { events, returned } = await drainGenerator(
      streamDirectKnowledgeSearchIfMatched({
        request: makeRequest(),
        queryText: 'KRL 근거로 요약해줘',
        filteredTools: {} as never,
      })
    );

    expect(returned).toBe(false);
    expect(events).toHaveLength(0);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('LLM 모델을 가져올 수 없으면 template-fallback으로 전환한다', async () => {
    mockGetAdvisorModel.mockReturnValue(null);

    const tools = makeTools(KB_RESULT_WITH_DATA);
    const { events, returned } = await drainGenerator(
      streamDirectKnowledgeSearchIfMatched({
        request: makeRequest(),
        queryText: 'KRL 근거로 요약해줘',
        filteredTools: tools as never,
      })
    );

    expect(returned).toBe(true);
    expect(mockGenerateText).not.toHaveBeenCalled();

    const warningEvent = events.find(
      (e) => (e as { type: string }).type === 'warning'
    );
    expect(warningEvent).toMatchObject({
      type: 'warning',
      data: { code: 'GROUNDED_LLM_FAILED' },
    });

    const doneEvent = events.find((e) => (e as { type: string }).type === 'done');
    expect(doneEvent).toMatchObject({
      type: 'done',
      data: {
        success: true,
        metadata: { groundingMode: 'template-fallback' },
      },
    });
  });
});
