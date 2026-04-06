/**
 * @vitest-environment node
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

const {
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

  it('fails closed when encrypted Tavily key is set without ENCRYPTION_KEY', () => {
    process.env.TAVILY_API_KEY_ENCRYPTED = 'dummy-payload';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(loadTavilyApiKey()).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      '❌ Tavily API 키 로드 실패:',
      expect.stringContaining('ENCRYPTION_KEY가 필요합니다.')
    );
  });

  it('fails with explicit guidance when encrypted Tavily key needs missing crypto-js', () => {
    process.env.ENCRYPTION_KEY = 'test-key';
    process.env.TAVILY_API_KEY_ENCRYPTED = 'dummy-payload';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(loadTavilyApiKey()).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      '❌ Tavily API 키 로드 실패:',
      expect.stringContaining('crypto-js 의존성이 없어')
    );
  });
});
