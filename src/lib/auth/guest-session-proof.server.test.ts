/**
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createGuestSessionProof,
  verifyGuestSessionProof,
} from './guest-session-proof.server';

describe('guest-session-proof.server', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-22T00:00:00.000Z'));
    process.env = {
      ...originalEnv,
      SESSION_SECRET: 'test-session-proof-secret',
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = originalEnv;
  });

  it('생성한 proof를 검증하면 동일한 sessionId를 반환한다', () => {
    const proof = createGuestSessionProof('guest-session-abc');
    expect(proof).toBeTruthy();

    const verified = verifyGuestSessionProof(proof || '');
    expect(verified).toMatchObject({
      sessionId: 'guest-session-abc',
    });
  });

  it('서명이 위변조되면 검증에 실패한다', () => {
    const proof = createGuestSessionProof('guest-session-abc');
    expect(proof).toBeTruthy();
    const tampered = `${proof?.slice(0, -1)}0`;

    const verified = verifyGuestSessionProof(tampered);
    expect(verified).toBeNull();
  });

  it('만료 시간이 지난 proof는 검증에 실패한다', () => {
    const proof = createGuestSessionProof('guest-session-expired', {
      maxAgeSeconds: 1,
    });
    expect(proof).toBeTruthy();

    vi.setSystemTime(new Date('2026-02-22T00:00:05.000Z'));
    const verified = verifyGuestSessionProof(proof || '');
    expect(verified).toBeNull();
  });
});
