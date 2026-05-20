import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockIsCerebrasToolCallingEnabled,
  mockIsCerebrasLongContextEnabled,
  mockGetCerebrasModelId,
} = vi.hoisted(() => ({
  mockIsCerebrasToolCallingEnabled: vi.fn(() => true),
  mockIsCerebrasLongContextEnabled: vi.fn(() => true),
  mockGetCerebrasModelId: vi.fn(() => 'llama3.1-8b'),
}));

vi.mock('../../lib/config-parser', () => ({
  getCerebrasModelId: mockGetCerebrasModelId,
  isCerebrasToolCallingEnabled: mockIsCerebrasToolCallingEnabled,
  isCerebrasLongContextEnabled: mockIsCerebrasLongContextEnabled,
}));

import { getProviderCapabilities } from './provider-capabilities';
import { CEREBRAS_QWEN_MODEL_ID } from './provider-model-policy';

describe('provider capabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCerebrasToolCallingEnabled.mockReturnValue(true);
    mockIsCerebrasLongContextEnabled.mockReturnValue(true);
    mockGetCerebrasModelId.mockReturnValue('llama3.1-8b');
  });

  it('reflects Cerebras tool-calling env gate', () => {
    mockIsCerebrasToolCallingEnabled.mockReturnValue(false);

    const capabilities = getProviderCapabilities('cerebras');

    expect(capabilities.supportsToolCalling).toBe(false);
    expect(capabilities.supportsStructuredOutput).toBe(true);
  });

  it('uses Cerebras model policy for long-context capability', () => {
    expect(getProviderCapabilities('cerebras')).toMatchObject({
      supportsLongContext: false,
      contextWindowTokens: 8_192,
    });
    expect(getProviderCapabilities('cerebras', CEREBRAS_QWEN_MODEL_ID)).toMatchObject({
      supportsLongContext: true,
      contextWindowTokens: 65_536,
    });
  });

  it('allows Cerebras long-context to be disabled by env gate', () => {
    mockIsCerebrasLongContextEnabled.mockReturnValue(false);

    const capabilities = getProviderCapabilities(
      'cerebras',
      CEREBRAS_QWEN_MODEL_ID
    );

    expect(capabilities.supportsLongContext).toBe(false);
  });

  it('marks Z.AI Flash and V models as long-context text-only runtime providers', () => {
    expect(getProviderCapabilities('zai', 'glm-4.5-flash')).toMatchObject({
      supportsToolCalling: true,
      supportsStructuredOutput: true,
      supportsVision: false,
      supportsLongContext: true,
      contextWindowTokens: 128_000,
    });
    expect(getProviderCapabilities('zai', 'glm-4.6v-flash')).toMatchObject({
      supportsVision: false,
      contextWindowTokens: 128_000,
    });
  });
});
