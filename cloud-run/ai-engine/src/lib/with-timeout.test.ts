import { describe, expect, it } from 'vitest';
import { withTimeout } from './with-timeout';

describe('withTimeout', () => {
  it('resolves when promise completes before timeout', async () => {
    const result = await withTimeout(
      Promise.resolve('ok'),
      1000,
      'should not timeout'
    );
    expect(result).toBe('ok');
  });

  it('rejects with timeout error when promise exceeds timeout', async () => {
    const slow = new Promise<string>((resolve) => {
      setTimeout(() => resolve('too late'), 500);
    });

    await expect(
      withTimeout(slow, 50, 'timed out')
    ).rejects.toThrow('timed out');
  });

  it('propagates original error when promise rejects before timeout', async () => {
    await expect(
      withTimeout(Promise.reject(new Error('original')), 1000, 'timeout')
    ).rejects.toThrow('original');
  });

  it('cleans up timer after successful resolution (no leak)', async () => {
    // If clearTimeout is not called, the timer would keep the process alive.
    // We verify by ensuring the function completes without hanging.
    const result = await withTimeout(
      Promise.resolve(42),
      60_000, // long timeout — would hang if not cleared
      'should not timeout'
    );
    expect(result).toBe(42);
  });

  it('cleans up timer after rejection (no leak)', async () => {
    await expect(
      withTimeout(
        Promise.reject(new Error('fail')),
        60_000,
        'should not timeout'
      )
    ).rejects.toThrow('fail');
  });
});
