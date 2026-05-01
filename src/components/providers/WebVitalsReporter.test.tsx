/**
 * @vitest-environment jsdom
 */

import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebVitalsReporter } from './WebVitalsReporter';

let currentPathname = '/';
let reportWebVitalsCallback:
  | ((metric: {
      name: string;
      value: number;
      rating: string;
      delta: number;
      id: string;
      navigationType?: string;
    }) => void)
  | null = null;

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => currentPathname),
}));

vi.mock('next/web-vitals', () => ({
  useReportWebVitals: vi.fn((callback) => {
    reportWebVitalsCallback = callback;
  }),
}));

describe('WebVitalsReporter', () => {
  beforeEach(() => {
    currentPathname = '/';
    reportWebVitalsCallback = null;
    vi.useFakeTimers();
    vi.stubEnv('NODE_ENV', 'production');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('경로가 바뀌기 전에 수집한 메트릭은 이전 경로로 flush해야 한다', async () => {
    const sendBeacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: sendBeacon,
    });

    const { rerender } = render(<WebVitalsReporter />);

    expect(reportWebVitalsCallback).toBeTypeOf('function');

    act(() => {
      reportWebVitalsCallback?.({
        name: 'LCP',
        value: 1234,
        rating: 'good',
        delta: 1234,
        id: 'metric-1',
      });
    });

    currentPathname = '/login';
    rerender(<WebVitalsReporter />);

    expect(sendBeacon).toHaveBeenCalledTimes(1);

    const [, payloadBlob] = sendBeacon.mock.calls[0] as [string, Blob];
    const payload = JSON.parse(await payloadBlob.text()) as {
      url: string;
      metrics: Array<{ name: string; value: number }>;
    };

    expect(payload.url).toBe('/');
    expect(payload.metrics).toEqual([
      expect.objectContaining({
        name: 'LCP',
        value: 1234,
      }),
    ]);

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });
});
