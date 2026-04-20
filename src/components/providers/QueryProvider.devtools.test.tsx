/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('QueryProvider devtools loading', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('next/dynamic');
    vi.unstubAllEnvs();
  });

  it('loads React Query Devtools as a client-only dynamic component in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const dynamicMock = vi.fn(
      () =>
        function MockReactQueryDevtools() {
          return <div data-testid="react-query-devtools" />;
        }
    );

    vi.doMock('next/dynamic', () => ({
      default: dynamicMock,
    }));

    const { default: QueryProvider } = await import('./QueryProvider');

    render(
      <QueryProvider>
        <div>query-provider-child</div>
      </QueryProvider>
    );

    expect(screen.getByText('query-provider-child')).toBeInTheDocument();
    expect(screen.getByTestId('react-query-devtools')).toBeInTheDocument();
    expect(dynamicMock).toHaveBeenCalledTimes(1);
    expect(dynamicMock.mock.calls[0]?.[1]).toMatchObject({ ssr: false });
    expect(typeof dynamicMock.mock.calls[0]?.[1]?.loading).toBe('function');
  });
});
