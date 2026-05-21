/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useServerQuery } from './useServerQuery';

const mockGetServersAction = vi.hoisted(() => vi.fn());

vi.mock('@/actions/server-actions', () => ({
  getServersAction: mockGetServersAction,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  const Wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, Wrapper };
}

describe('useServerQuery', () => {
  beforeEach(() => {
    mockGetServersAction.mockReset();
  });

  it('SSR 초기 서버 데이터를 세션 내 고정하고 자동 refetch를 예약하지 않는다', async () => {
    const { queryClient, Wrapper } = createWrapper();
    const { result, unmount } = renderHook(
      () => useServerQuery({ initialData: [] }),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
    expect(mockGetServersAction).not.toHaveBeenCalled();

    const query = queryClient.getQueryCache().find({
      queryKey: ['servers'],
    });

    expect(query?.options.refetchInterval).toBe(false);
    expect(query?.options.staleTime).toBe(Infinity);
    expect(query?.options.gcTime).toBe(Infinity);
    expect(query?.options.refetchOnWindowFocus).toBe(false);
    expect(query?.options.refetchOnReconnect).toBe(false);

    unmount();
    queryClient.clear();
  });
});
