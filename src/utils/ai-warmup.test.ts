/**
 * ai-warmup 단위 테스트
 *
 * sessionStorage (브라우저 환경) 경로를 테스트.
 * DOM suite (jsdom) 에서 실행됨 — dom-test-manifest.json 등록.
 * vi.resetModules()로 모듈 레벨 lastWarmupMemory 상태 격리.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Logger mock
vi.mock('@/lib/logging', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const COOLDOWN = 5 * 60 * 1000;
const STORAGE_KEY = 'ai_warmup_timestamp';

let triggerAIWarmup: (source?: string) => Promise<boolean>;
let consumeWarmupStartedAtForFirstQuery: () => number | null;
let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  // 모듈 상태 격리 — lastWarmupMemory 리셋
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
  sessionStorage.clear();

  fetchSpy = vi
    .spyOn(global, 'fetch')
    .mockResolvedValue(new Response('ok', { status: 200 }));

  const mod = await import('./ai-warmup');
  triggerAIWarmup = mod.triggerAIWarmup;
  consumeWarmupStartedAtForFirstQuery = mod.consumeWarmupStartedAtForFirstQuery;
});

afterEach(() => {
  fetchSpy.mockRestore();
  vi.useRealTimers();
});

describe('triggerAIWarmup', () => {
  it('첫 호출 시 웜업 요청을 보냄', async () => {
    const result = await triggerAIWarmup('first-call');

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/ai/wake-up',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('쿨다운 내 재호출 시 스킵하고 false 반환', async () => {
    await triggerAIWarmup('first');
    fetchSpy.mockClear();

    const result = await triggerAIWarmup('second');

    expect(result).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('쿨다운 만료 후 재호출 시 웜업 실행', async () => {
    await triggerAIWarmup('first');
    fetchSpy.mockClear();

    vi.advanceTimersByTime(COOLDOWN + 1000);

    const result = await triggerAIWarmup('after-cooldown');

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('fetch 실패해도 true 반환 (fire-and-forget)', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network error'));

    const result = await triggerAIWarmup('retry-test');

    expect(result).toBe(true);
  });

  it('source 레이블이 헤더에 포함됨', async () => {
    await triggerAIWarmup('my-source');

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/ai/wake-up',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-AI-Warmup-Source': 'my-source' }),
      })
    );
  });

  it('NaN 타임스탬프 저장 시 웜업 실행', async () => {
    sessionStorage.setItem(STORAGE_KEY, 'not-a-number');

    const result = await triggerAIWarmup('nan-test');

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('consumeWarmupStartedAtForFirstQuery', () => {
  it('웜업 기록 없으면 null 반환', () => {
    const result = consumeWarmupStartedAtForFirstQuery();
    expect(result).toBeNull();
  });

  it('웜업 후 쿨다운 내에서 타임스탬프 반환', async () => {
    const before = Date.now();
    await triggerAIWarmup('warmup');

    const result = consumeWarmupStartedAtForFirstQuery();

    expect(typeof result).toBe('number');
    expect(result as number).toBeGreaterThanOrEqual(before);
  });

  it('한 번 소비 후 재소비 불가', async () => {
    await triggerAIWarmup('warmup');

    consumeWarmupStartedAtForFirstQuery();
    const second = consumeWarmupStartedAtForFirstQuery();

    expect(second).toBeNull();
  });

  it('쿨다운 만료 후 null 반환', async () => {
    await triggerAIWarmup('warmup');
    vi.advanceTimersByTime(COOLDOWN + 1000);

    const result = consumeWarmupStartedAtForFirstQuery();
    expect(result).toBeNull();
  });
});
