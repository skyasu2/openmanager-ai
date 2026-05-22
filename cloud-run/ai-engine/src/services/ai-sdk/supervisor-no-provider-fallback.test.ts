import { describe, expect, it } from 'vitest';
import type { AssistantRuntimeMetadata } from './monitoring-runtime-host';
import { buildNoProviderFallbackResponse } from './supervisor-no-provider-fallback';
import type { ResolvedSupervisorModeDecision } from './supervisor-mode';

describe('buildNoProviderFallbackResponse', () => {
  it('returns a deterministic no-provider fallback with zero token usage', () => {
    const result = buildNoProviderFallbackResponse({ durationMs: 1234 });

    expect(result).toMatchObject({
      success: true,
      response:
        '현재 AI 엔진 모델이 일시적으로 사용 불가능합니다. 잠시 후 다시 시도해주세요.',
      toolsCalled: [],
      toolResults: [],
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      metadata: {
        provider: 'none',
        modelId: 'none',
        stepsExecuted: 0,
        durationMs: 1234,
        fallback: true,
        fallbackReason: 'no_provider',
      },
    });
    expect(result.metadata.responseChars).toBeGreaterThan(0);
    expect(Array.isArray(result.metadata.qualityFlags)).toBe(true);
  });

  it('preserves mode, runtime, and degraded fallback metadata', () => {
    const modeDecision: ResolvedSupervisorModeDecision = {
      requestedMode: 'auto',
      resolvedMode: 'single',
      modeSelectionSource: 'auto_default',
    };
    const runtimeMetadata: AssistantRuntimeMetadata = {
      domainId: 'openmanager-monitoring',
      domainVersion: 'test',
      routeKind: 'chat',
      executionPath: 'stream',
      executionMode: 'single-agent',
      reasonCodes: ['no_provider_test'],
      adapterKinds: {
        stateStore: 'in-memory',
        sessionStore: 'in-memory',
        jobQueue: 'in-memory',
        artifactStore: 'in-memory',
        vectorStore: 'empty',
      },
    };

    const result = buildNoProviderFallbackResponse({
      durationMs: 77,
      modeDecision,
      runtimeMetadata,
      degradedFallbackContext: {
        degradedFromMode: 'multi',
        degradedReason: 'multi_agent_model_unavailable',
      },
    });

    expect(result.metadata).toMatchObject({
      provider: 'none',
      modelId: 'none',
      requestedMode: 'auto',
      resolvedMode: 'single',
      modeSelectionSource: 'auto_default',
      assistantRuntime: runtimeMetadata,
      fallback: true,
      degradedFromMode: 'multi',
      degradedReason: 'multi_agent_model_unavailable',
      fallbackReason: 'no_provider',
    });
  });
});
