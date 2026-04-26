import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockIsCerebrasToolCallingEnabled,
  mockIsCerebrasLongContextEnabled,
  mockGetCerebrasModelId,
  mockIsOpenRouterVisionToolCallingEnabled,
} = vi.hoisted(() => ({
  mockIsCerebrasToolCallingEnabled: vi.fn(() => true),
  mockIsCerebrasLongContextEnabled: vi.fn(() => true),
  mockGetCerebrasModelId: vi.fn(() => 'qwen-3-235b-a22b-instruct-2507'),
  mockIsOpenRouterVisionToolCallingEnabled: vi.fn(() => true),
}));

vi.mock('../../lib/config-parser', () => ({
  getCerebrasModelId: mockGetCerebrasModelId,
  isCerebrasToolCallingEnabled: mockIsCerebrasToolCallingEnabled,
  isCerebrasLongContextEnabled: mockIsCerebrasLongContextEnabled,
  isOpenRouterVisionToolCallingEnabled: mockIsOpenRouterVisionToolCallingEnabled,
}));

import { getProviderCapabilities } from './provider-capabilities';

describe('provider capabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCerebrasToolCallingEnabled.mockReturnValue(true);
    mockIsCerebrasLongContextEnabled.mockReturnValue(true);
    mockGetCerebrasModelId.mockReturnValue('qwen-3-235b-a22b-instruct-2507');
    mockIsOpenRouterVisionToolCallingEnabled.mockReturnValue(true);
  });

  it('reflects Cerebras tool-calling env gate', () => {
    mockIsCerebrasToolCallingEnabled.mockReturnValue(false);

    const capabilities = getProviderCapabilities('cerebras');

    expect(capabilities.supportsToolCalling).toBe(false);
    expect(capabilities.supportsStructuredOutput).toBe(true);
  });

  it('uses Cerebras model policy for long-context capability', () => {
    expect(getProviderCapabilities('cerebras')).toMatchObject({
      supportsLongContext: true,
      contextWindowTokens: 65_536,
    });
    expect(getProviderCapabilities('cerebras', 'llama3.1-8b')).toMatchObject({
      supportsLongContext: false,
      contextWindowTokens: 8_192,
    });
  });

  it('allows Cerebras long-context to be disabled by env gate', () => {
    mockIsCerebrasLongContextEnabled.mockReturnValue(false);

    const capabilities = getProviderCapabilities(
      'cerebras',
      'qwen-3-235b-a22b-instruct-2507'
    );

    expect(capabilities.supportsLongContext).toBe(false);
  });

  it('reflects OpenRouter vision tool-calling env gate', () => {
    mockIsOpenRouterVisionToolCallingEnabled.mockReturnValue(false);

    const capabilities = getProviderCapabilities('openrouter');

    expect(capabilities.supportsToolCalling).toBe(false);
    expect(capabilities.supportsVision).toBe(true);
  });
});
