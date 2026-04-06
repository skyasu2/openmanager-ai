/**
 * @vitest-environment node
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

const {
  ENCRYPTED_TAVILY_GUIDANCE,
  loadTavilyApiKey,
} = require('../../../scripts/test/tavily-key-loader.cjs');

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('tavily-key-loader', () => {
  it('loads plaintext Tavily API key without crypto-js', () => {
    process.env.TAVILY_API_KEY = 'tvly-demo-secret';

    expect(loadTavilyApiKey()).toBe('tvly-demo-secret');
  });

  it('fails with explicit retirement guidance when encrypted Tavily env var is set', () => {
    process.env.TAVILY_API_KEY_ENCRYPTED = 'dummy-payload';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(loadTavilyApiKey()).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      '❌ Tavily API 키 로드 실패:',
      ENCRYPTED_TAVILY_GUIDANCE
    );
  });

  it('fails with explicit retirement guidance when deprecated config file exists', () => {
    const fs = require('fs');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(fs, 'existsSync').mockImplementation((target) =>
      String(target)
        .replace(/\\/g, '/')
        .endsWith('/scripts/config/tavily-encrypted.json')
    );

    expect(loadTavilyApiKey()).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      '❌ Tavily API 키 로드 실패:',
      expect.stringContaining(ENCRYPTED_TAVILY_GUIDANCE)
    );
  });
});
