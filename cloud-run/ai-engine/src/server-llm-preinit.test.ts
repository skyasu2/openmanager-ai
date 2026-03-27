import { describe, expect, it, vi } from 'vitest';
import { preinitializeLlmProviders } from './server-llm-preinit';

describe('preinitializeLlmProviders', () => {
  it('모든 provider singleton을 미리 초기화하고 debug 로그를 남긴다', async () => {
    const log = { debug: vi.fn(), warn: vi.fn() };
    const getCerebrasModel = vi.fn();
    const getGroqModel = vi.fn();
    const getMistralModel = vi.fn();

    await preinitializeLlmProviders(log, async () => ({
      getCerebrasModel,
      getGroqModel,
      getMistralModel,
    }));

    expect(getCerebrasModel).toHaveBeenCalledTimes(1);
    expect(getGroqModel).toHaveBeenCalledTimes(1);
    expect(getMistralModel).toHaveBeenCalledTimes(1);
    expect(log.debug).toHaveBeenCalledWith(
      'LLM provider singletons pre-initialized'
    );
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('provider 생성 중 예외가 나면 non-blocking debug 로그로만 남긴다', async () => {
    const log = { debug: vi.fn(), warn: vi.fn() };
    const error = new Error('missing keys');
    const getCerebrasModel = vi.fn(() => {
      throw error;
    });

    await preinitializeLlmProviders(log, async () => ({
      getCerebrasModel,
      getGroqModel: vi.fn(),
      getMistralModel: vi.fn(),
    }));

    expect(log.debug).toHaveBeenCalledWith(
      { err: error },
      'LLM pre-init skipped (keys not yet available)'
    );
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('dynamic import 실패 시 warn 로그를 남긴다', async () => {
    const log = { debug: vi.fn(), warn: vi.fn() };
    const error = new Error('import failed');

    await preinitializeLlmProviders(log, async () => {
      throw error;
    });

    expect(log.warn).toHaveBeenCalledWith(
      { err: error },
      'LLM pre-init module import failed'
    );
  });
});
