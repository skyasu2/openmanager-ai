/**
 * vercel-env-utils 단위 테스트
 */

import { describe, expect, it, vi } from 'vitest';

// isVercel을 제어하기 위해 모킹
vi.mock('@/env-client', () => ({
  isVercel: false,
}));

// 모킹 후 모듈 로드
const { syncDebounce, authRetryDelay, envLabel, debugWithEnv, mountDelay } =
  await import('./vercel-env-utils');

describe('vercel-env-utils (local 환경)', () => {
  it('mountDelay는 0', () => {
    expect(mountDelay).toBe(0);
  });

  it('syncDebounce는 500ms (local)', () => {
    expect(syncDebounce).toBe(500);
  });

  it('authRetryDelay는 3000ms (local)', () => {
    expect(authRetryDelay).toBe(3000);
  });

  it('envLabel은 "Local"', () => {
    expect(envLabel).toBe('Local');
  });

  it('debugWithEnv는 환경 prefix 추가', () => {
    expect(debugWithEnv('test message')).toBe('[Local] test message');
  });

  it('debugWithEnv 빈 문자열 처리', () => {
    expect(debugWithEnv('')).toBe('[Local] ');
  });
});
