import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockIsCerebrasToolCallingEnabled,
  mockIsOpenRouterVisionToolCallingEnabled,
} = vi.hoisted(() => ({
  mockIsCerebrasToolCallingEnabled: vi.fn(() => true),
  mockIsOpenRouterVisionToolCallingEnabled: vi.fn(() => true),
}));

vi.mock('../../lib/config-parser', () => ({
  isCerebrasToolCallingEnabled: mockIsCerebrasToolCallingEnabled,
  isOpenRouterVisionToolCallingEnabled: mockIsOpenRouterVisionToolCallingEnabled,
}));

import { getProviderCapabilities } from './provider-capabilities';

describe('provider capabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCerebrasToolCallingEnabled.mockReturnValue(true);
    mockIsOpenRouterVisionToolCallingEnabled.mockReturnValue(true);
  });

  it('reflects Cerebras tool-calling env gate', () => {
    mockIsCerebrasToolCallingEnabled.mockReturnValue(false);

    const capabilities = getProviderCapabilities('cerebras');

    expect(capabilities.supportsToolCalling).toBe(false);
    expect(capabilities.supportsStructuredOutput).toBe(true);
  });

  it('reflects OpenRouter vision tool-calling env gate', () => {
    mockIsOpenRouterVisionToolCallingEnabled.mockReturnValue(false);

    const capabilities = getProviderCapabilities('openrouter');

    expect(capabilities.supportsToolCalling).toBe(false);
    expect(capabilities.supportsVision).toBe(true);
  });
});
