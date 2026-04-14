/**
 * @vitest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSafeServer } from './useSafeServer';

describe('useSafeServer', () => {
  it('raw linux 값은 UI에서 Linux로 정규화한다', () => {
    const { result } = renderHook(() =>
      useSafeServer({
        id: 'server-1',
        name: 'API Server',
        status: 'online',
        role: 'app',
        location: 'DC1-AZ1',
        os: 'linux',
      } as never)
    );

    expect(result.current.osShortName).toBe('Linux');
    expect(result.current.osDisplayName).toBe('Linux');
  });

  it('Ubuntu 계열은 기존 표시를 유지한다', () => {
    const { result } = renderHook(() =>
      useSafeServer({
        id: 'server-2',
        name: 'Web Server',
        status: 'online',
        role: 'web',
        location: 'DC1-AZ1',
        os: 'Ubuntu 22.04 LTS',
      } as never)
    );

    expect(result.current.osShortName).toBe('Ubuntu');
    expect(result.current.osDisplayName).toBe('Ubuntu 22.04 LTS');
  });

  it('비정상 메트릭 값은 0으로 정규화해야 한다', () => {
    const { result } = renderHook(() =>
      useSafeServer({
        id: 'server-3',
        name: 'Broken Metrics Server',
        status: 'warning',
        role: 'app',
        location: 'DC1-AZ1',
        cpu: Number.NaN,
        memory: Number.POSITIVE_INFINITY,
        disk: Number.NEGATIVE_INFINITY,
        network: Number.NaN,
      } as never)
    );

    expect(result.current.safeServer.cpu).toBe(0);
    expect(result.current.safeServer.memory).toBe(0);
    expect(result.current.safeServer.disk).toBe(0);
    expect(result.current.safeServer.network).toBe(0);
  });
});
