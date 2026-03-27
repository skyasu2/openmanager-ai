import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const { mockGetSessionOwnerKey } = vi.hoisted(() => ({
  mockGetSessionOwnerKey: vi.fn(() => 'owner-key-1'),
}));

vi.mock('../supervisor/session-owner', () => ({
  getSessionOwnerKey: mockGetSessionOwnerKey,
}));

import {
  buildScopedJobListKey,
  getStoredJobOwnerKey,
  isJobOwnedByRequester,
  resolveJobOwnerKey,
} from './job-ownership';

describe('job-ownership', () => {
  it('buildScopedJobListKey는 owner scope를 list key에 포함한다', () => {
    expect(buildScopedJobListKey('owner-key-1', 'session-1')).toBe(
      'job:list:owner-key-1:session-1'
    );
  });

  it('getStoredJobOwnerKey는 저장된 ownerKey를 읽는다', () => {
    expect(
      getStoredJobOwnerKey({ metadata: { ownerKey: 'owner-key-1' } })
    ).toBe('owner-key-1');
    expect(getStoredJobOwnerKey({ metadata: {} })).toBeNull();
  });

  it('resolveJobOwnerKey는 session owner helper 결과를 재사용한다', () => {
    const request = new NextRequest('http://localhost/api/ai/jobs');
    expect(resolveJobOwnerKey(request)).toBe('owner-key-1');
  });

  it('isJobOwnedByRequester는 owner mismatch를 차단한다', () => {
    const request = new NextRequest('http://localhost/api/ai/jobs');

    expect(
      isJobOwnedByRequester({ metadata: { ownerKey: 'owner-key-1' } }, request)
    ).toBe(true);
    expect(
      isJobOwnedByRequester({ metadata: { ownerKey: 'owner-key-2' } }, request)
    ).toBe(false);
    expect(isJobOwnedByRequester({ metadata: {} }, request)).toBe(false);
  });
});
