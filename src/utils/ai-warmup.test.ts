// @vitest-environment jsdom
/**
 * ai-warmup 단위 테스트
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  consumeWarmupStartedAtForFirstQuery,
  triggerAIWarmup,
} from './ai-warmup';

// Logger mock — suppress noise
vi.mock('@/lib/logging', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const COOLDOWN = 5 * 60 * 1000;
const STORAGE_KEY = 'ai_warmup_timestamp';
const _FIRST_QUERY_KEY = 'ai_warmup_first_query_tracked';

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  sessionStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
  fetchSpy = vi
    .spyOn(global, 'fetch')
    .mockResolvedValue(new Response('ok', { status: 200 }));
});

afterEach(() => {
  fetchSpy.mockRestore();
  vi.useRealTimers();
});

describe('triggerAIWarmup', () => {
  it('쿨다운 내에 있으면 웜업을 스킵하고 false 반환', async () => {
    const recent = Date.now() - 1000; // 1초 전 웜업
    sessionStorage.setItem(STORAGE_KEY, recent.toString());

    const result = await triggerAIWarmup('test');

    expect(result).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('쿨다운 만료 후에는 웜업 요청을 보냄', async () => {
    const old = Date.now() - COOLDOWN - 1000;
    sessionStorage.setItem(STORAGE_KEY, old.toString());

    const result = await triggerAIWarmup('test');

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/ai/wake-up',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('저장된 타임스탬프가 없으면 (첫 호출) 웜업 실행', async () => {
    const result = await triggerAIWarmup('first-call');

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('fetch 실패해도 true 반환 (fire-and-forget)', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network error'));

    const result = await triggerAIWarmup('retry-test');

    expect(result).toBe(true);
  });

  it('웜업 후 즉시 재호출 시 쿨다운으로 스킵', async () => {
    await triggerAIWarmup('first');
    fetchSpy.mockClear();

    const result = await triggerAIWarmup('second');

    expect(result).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('consumeWarmupStartedAtForFirstQuery', () => {
  it('쿨다운 내 웜업 기록이 없으면 null 반환', () => {
    const result = consumeWarmupStartedAtForFirstQuery();
    expect(result).toBeNull();
  });

  it('쿨다운 만료된 웜업 기록은 null 반환', () => {
    const old = Date.now() - COOLDOWN - 1000;
    sessionStorage.setItem(STORAGE_KEY, old.toString());

    const result = consumeWarmupStartedAtForFirstQuery();
    expect(result).toBeNull();
  });

  it('쿨다운 내 웜업 기록이 있으면 타임스탬프 반환', () => {
    const ts = Date.now() - 30_000; // 30초 전
    sessionStorage.setItem(STORAGE_KEY, ts.toString());

    const result = consumeWarmupStartedAtForFirstQuery();
    expect(result).toBe(ts);
  });

  it('한 번 소비하면 동일 사이클에서 재소비 불가', () => {
    const ts = Date.now() - 30_000;
    sessionStorage.setItem(STORAGE_KEY, ts.toString());

    consumeWarmupStartedAtForFirstQuery(); // 첫 소비
    const second = consumeWarmupStartedAtForFirstQuery(); // 재소비 시도

    expect(second).toBeNull();
  });

  it('NaN 타임스탬프는 null로 처리', () => {
    sessionStorage.setItem(STORAGE_KEY, 'not-a-number');

    const result = consumeWarmupStartedAtForFirstQuery();
    expect(result).toBeNull();
  });
});
