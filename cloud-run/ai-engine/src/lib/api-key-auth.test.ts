import { beforeEach, describe, expect, it, vi } from 'vitest';

const { timingSafeEqualSpy } = vi.hoisted(() => ({
  timingSafeEqualSpy: vi.fn((left: Buffer, right: Buffer) => left.equals(right)),
}));

vi.mock('node:crypto', async () => {
  const actual = await vi.importActual<typeof import('node:crypto')>('node:crypto');
  return {
    ...actual,
    timingSafeEqual: timingSafeEqualSpy,
  };
});

import { verifyApiKeyValue } from './api-key-auth';

describe('verifyApiKeyValue', () => {
  beforeEach(() => {
    timingSafeEqualSpy.mockClear();
  });

  it('returns true for identical keys', () => {
    expect(verifyApiKeyValue('same-secret', 'same-secret')).toBe(true);
    expect(timingSafeEqualSpy).toHaveBeenCalledOnce();
  });

  it('returns false for different keys with the same length', () => {
    expect(verifyApiKeyValue('same-size-a', 'same-size-b')).toBe(false);
    expect(timingSafeEqualSpy).toHaveBeenCalledOnce();
  });

  it('still reaches timingSafeEqual when key lengths differ', () => {
    expect(verifyApiKeyValue('short', 'much-longer-secret')).toBe(false);
    expect(timingSafeEqualSpy).toHaveBeenCalledOnce();
    expect(timingSafeEqualSpy.mock.calls[0]?.[0]).toHaveLength(32);
    expect(timingSafeEqualSpy.mock.calls[0]?.[1]).toHaveLength(32);
  });

  it('returns false when either key is missing', () => {
    expect(verifyApiKeyValue(undefined, 'configured-secret')).toBe(false);
    expect(verifyApiKeyValue('provided-secret', undefined)).toBe(false);
    expect(timingSafeEqualSpy).not.toHaveBeenCalled();
  });
});
