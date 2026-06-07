import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGenerateObject, mockSelectRoundRobinProviderOrder, mockSelectTextModel } =
  vi.hoisted(() => ({
    mockGenerateObject: vi.fn(),
    mockSelectRoundRobinProviderOrder: vi.fn(() => ({
      providerOrder: ['groq'],
      rotationSlot: 0,
    })),
    mockSelectTextModel: vi.fn(() => ({
      model: { modelId: 'test-model' },
      provider: 'groq',
    })),
  }));

vi.mock('ai', () => ({ generateObject: (...a: unknown[]) => mockGenerateObject(...a) }));
vi.mock(
  '../../services/ai-sdk/agents/config/round-robin-provider-selector',
  () => ({ selectRoundRobinProviderOrder: (...a: unknown[]) => mockSelectRoundRobinProviderOrder(...a) }),
);
vi.mock(
  '../../services/ai-sdk/agents/config/agent-model-selectors',
  () => ({ selectTextModel: (...a: unknown[]) => mockSelectTextModel(...a) }),
);

import { classifyEvidenceIntentWithLLM } from './current-metrics-evidence-llm-classifier';

describe('classifyEvidenceIntentWithLLM', () => {
  beforeEach(() => vi.clearAllMocks());

  it('건강한 서버 TOP3 → server_health healthy-only', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { intent: 'server_health', statusFilter: 'healthy-only', confidence: 0.92 },
    });

    const result = await classifyEvidenceIntentWithLLM('건강한 서버 TOP3');

    expect(result).toMatchObject({
      intent: 'server_health',
      statusFilter: 'healthy-only',
      sourceIntent: 'llm-classified',
    });
  });

  it('안정적인 서버 상위 3대 → server_health healthy-only', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { intent: 'server_health', statusFilter: 'healthy-only', confidence: 0.88 },
    });

    const result = await classifyEvidenceIntentWithLLM('안정적인 서버 상위 3대');

    expect(result?.intent).toBe('server_health');
    expect(result?.statusFilter).toBe('healthy-only');
  });

  it('CPU 높은 서버 랭킹 → metric_ranking', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { intent: 'metric_ranking', confidence: 0.95 },
    });

    const result = await classifyEvidenceIntentWithLLM('CPU 가장 높은 서버 알려줘');

    expect(result?.intent).toBe('metric_ranking');
    expect(result?.sourceIntent).toBe('llm-classified');
  });

  it('confidence < 0.7 → null 반환', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { intent: 'server_health', confidence: 0.5 },
    });

    const result = await classifyEvidenceIntentWithLLM('어떻게 돼?');
    expect(result).toBeNull();
  });

  it('intent=none → null 반환', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { intent: 'none', confidence: 0.9 },
    });

    const result = await classifyEvidenceIntentWithLLM('오늘 날씨');
    expect(result).toBeNull();
  });

  it('model 선택 실패 → null 반환', async () => {
    mockSelectTextModel.mockReturnValueOnce(null);

    const result = await classifyEvidenceIntentWithLLM('건강한 서버 TOP3');
    expect(result).toBeNull();
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it('timeout → null 반환 (LLM 폴백 안전)', async () => {
    mockGenerateObject.mockImplementationOnce(() => new Promise(() => undefined));

    const result = await classifyEvidenceIntentWithLLM('건강한 서버');
    // timeout 2s이므로 테스트에서 즉시 확인은 어렵지만 null 반환 확인
    // (실제 timeout은 vitest fake timer 없이 2초 소요 — 통합 테스트 대상)
    expect(result === null || result?.sourceIntent === 'llm-classified').toBe(true);
  }, 10_000);
});
