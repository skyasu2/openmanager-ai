import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelResult } from './config/agent-model-selectors';
import { runSummarizationFallback } from './orchestrator-agent-stream-summary';

const {
  mockGenerateText,
  mockEstimateContentQuotaTokens,
  mockMarkStreamProviderCooldown,
  mockReconcileStreamQuota,
  mockReserveStreamQuota,
} = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockEstimateContentQuotaTokens: vi.fn(() => 128),
  mockMarkStreamProviderCooldown: vi.fn(async () => undefined),
  mockReconcileStreamQuota: vi.fn(async () => undefined),
  mockReserveStreamQuota: vi.fn(async () => ({
    reserved: true,
    provider: 'groq',
    modelId: 'groq-model',
    estimatedTokens: 64,
    status: {},
  })),
}));

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: mockGenerateText,
  };
});

vi.mock('../../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../stream-quota', () => ({
  estimateContentQuotaTokens: mockEstimateContentQuotaTokens,
  markStreamProviderCooldown: mockMarkStreamProviderCooldown,
  reconcileStreamQuota: mockReconcileStreamQuota,
  reserveStreamQuota: mockReserveStreamQuota,
}));

function createModelResult(provider: 'cerebras' | 'groq'): ModelResult {
  return {
    model: { provider } as unknown as ModelResult['model'],
    provider,
    modelId: `${provider}-model`,
    capabilities: {
      supportsToolCalling: true,
      supportsStructuredOutput: true,
      supportsVision: false,
      supportsLongContext: provider === 'groq',
      contextWindowTokens: provider === 'groq' ? 131_000 : 8_000,
    },
  };
}

describe('runSummarizationFallback', () => {
  const providerAttempts = [
    createModelResult('cerebras'),
    createModelResult('groq'),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockReserveStreamQuota.mockResolvedValue({
      reserved: true,
      provider: 'groq',
      modelId: 'groq-model',
      estimatedTokens: 64,
      status: {},
    });
    mockGenerateText.mockResolvedValue({
      text: 'api-01은 CPU 88%로 높습니다. 최근 배포와 상위 프로세스를 확인하세요.',
      usage: { inputTokens: 20, outputTokens: 12, totalTokens: 32 },
    });
  });

  it('delegates repair summarization to the next available provider', async () => {
    const telemetry: Array<{
      provider: string;
      modelId: string;
      attempt: number;
      error: string;
    }> = [];

    const result = await runSummarizationFallback({
      query: 'api-01 CPU가 높은 이유와 조치를 알려줘',
      agentName: 'Analyst Agent',
      provider: 'cerebras',
      modelId: 'cerebras-model',
      providerStartTime: Date.now() - 20,
      providerAttempts,
      attemptIndex: 0,
      excludedProviders: [],
      collectedToolResults: [
        {
          toolName: 'getServerMetrics',
          result: {
            servers: [{ id: 'api-01', status: 'warning', cpu: 88 }],
          },
        },
      ],
      summarizationReason: 'LOW_INFORMATION_RESPONSE',
      providerAttemptTelemetry: telemetry,
    });

    expect(result).toMatchObject({
      summaryText:
        'api-01은 CPU 88%로 높습니다. 최근 배포와 상위 프로세스를 확인하세요.',
      responseProvider: 'groq',
      responseModelId: 'groq-model',
      responseAttemptNumber: 2,
      responseUsage: { totalTokens: 32 },
    });
    expect(telemetry).toMatchObject([
      {
        provider: 'cerebras',
        modelId: 'cerebras-model',
        attempt: 1,
        error: 'LOW_INFORMATION_RESPONSE',
      },
    ]);
    expect(mockReserveStreamQuota).toHaveBeenCalledWith(
      'groq',
      'groq-model',
      expect.any(Number)
    );
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: providerAttempts[1]?.model,
        temperature: 0.4,
        maxOutputTokens: 1024,
        maxRetries: 0,
        timeout: { totalMs: 10_000 },
      })
    );
    expect(mockReconcileStreamQuota).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'groq', estimatedTokens: 64 }),
      32
    );
  });

  it('returns null and marks cooldown when summarization quota is denied', async () => {
    mockReserveStreamQuota.mockResolvedValueOnce({
      reserved: false,
      provider: 'groq',
      modelId: 'groq-model',
      estimatedTokens: 64,
      reason: 'rpd_exceeded',
      status: {},
    });

    const result = await runSummarizationFallback({
      query: 'api-01 CPU가 높은 이유와 조치를 알려줘',
      agentName: 'Analyst Agent',
      provider: 'cerebras',
      modelId: 'cerebras-model',
      providerStartTime: Date.now(),
      providerAttempts,
      attemptIndex: 0,
      excludedProviders: [],
      collectedToolResults: [
        {
          toolName: 'getServerMetrics',
          result: {
            servers: [{ id: 'api-01', status: 'warning', cpu: 88 }],
          },
        },
      ],
      summarizationReason: 'LOW_INFORMATION_RESPONSE',
      providerAttemptTelemetry: [],
    });

    expect(result).toBeNull();
    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(mockReconcileStreamQuota).toHaveBeenCalledWith(
      expect.objectContaining({ reserved: false, reason: 'rpd_exceeded' }),
      0
    );
    expect(mockMarkStreamProviderCooldown).toHaveBeenCalledWith(
      'groq',
      'groq-model',
      'QUOTA_ADMISSION:rpd_exceeded'
    );
  });
});
