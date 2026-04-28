'use client';

import { usePathname } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';
import { useCallback, useEffect, useRef } from 'react';
import { APP_VERSION } from '@/config/app-meta';

const TRACKED_PATH_PREFIXES = ['/validation'] as const;
const SUPPORTED_METRICS = ['CLS', 'INP', 'LCP', 'FCP', 'TTFB'] as const;
const FLUSH_DELAY_MS = 1200;

type SupportedMetricName = (typeof SUPPORTED_METRICS)[number];
type SupportedMetricRating = 'good' | 'needs-improvement' | 'poor';
type DeviceType = 'mobile' | 'desktop';
type NextWebVitalMetric = Parameters<
  Parameters<typeof useReportWebVitals>[0]
>[0];

type WebVitalsMetricPayload = {
  name: SupportedMetricName;
  value: number;
  rating: SupportedMetricRating;
  delta: number;
  id: string;
  navigationType?: string;
};

type WebVitalsPayload = {
  url: string;
  hostname: string;
  appVersion: string;
  timestamp: number;
  sessionId: string;
  deviceType: DeviceType;
  metrics: WebVitalsMetricPayload[];
};

function isSupportedMetric(name: string): name is SupportedMetricName {
  return (SUPPORTED_METRICS as readonly string[]).includes(name);
}

function isTrackedPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return TRACKED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function roundMetricValue(name: SupportedMetricName, value: number): number {
  if (name === 'CLS') {
    return Number(value.toFixed(4));
  }

  return Number(value.toFixed(0));
}

function createSessionId(): string {
  if (
    typeof window !== 'undefined' &&
    typeof window.crypto !== 'undefined' &&
    typeof window.crypto.randomUUID === 'function'
  ) {
    return window.crypto.randomUUID();
  }

  return `wv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'desktop';
  if (window.matchMedia('(max-width: 767px)').matches) return 'mobile';
  return 'desktop';
}

function sendWebVitalsPayload(payload: WebVitalsPayload): void {
  const body = JSON.stringify(payload);

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.sendBeacon === 'function'
  ) {
    const sent = navigator.sendBeacon(
      '/api/web-vitals',
      new Blob([body], { type: 'application/json' })
    );
    if (sent) return;
  }

  void fetch('/api/web-vitals', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
    keepalive: true,
    credentials: 'same-origin',
  }).catch(() => {
    // Ignore client-side transport errors. Missing a single beacon is acceptable.
  });
}

export function WebVitalsReporter() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname ?? '/');
  const sessionIdRef = useRef('pending');
  const flushTimerRef = useRef<number | undefined>(undefined);
  const metricsRef = useRef<Record<string, WebVitalsMetricPayload>>({});

  useEffect(() => {
    if (sessionIdRef.current === 'pending') {
      sessionIdRef.current = createSessionId();
    }
  }, []);

  const flushMetrics = useCallback(() => {
    if (process.env.NODE_ENV !== 'production') return;

    const metrics = Object.values(metricsRef.current);
    if (metrics.length === 0) return;

    sendWebVitalsPayload({
      url: pathnameRef.current || '/',
      hostname: window.location.hostname,
      appVersion: APP_VERSION,
      timestamp: Date.now(),
      sessionId: sessionIdRef.current,
      deviceType: getDeviceType(),
      metrics,
    });

    metricsRef.current = {};

    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = undefined;
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current);
    }

    flushTimerRef.current = window.setTimeout(() => {
      flushMetrics();
    }, FLUSH_DELAY_MS);
  }, [flushMetrics]);

  useEffect(() => {
    const nextPath = pathname ?? window.location.pathname;
    if (pathnameRef.current !== nextPath) {
      flushMetrics();
    }
    pathnameRef.current = nextPath;
  }, [flushMetrics, pathname]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushMetrics();
      }
    };

    window.addEventListener('pagehide', flushMetrics);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', flushMetrics);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (flushTimerRef.current) {
        window.clearTimeout(flushTimerRef.current);
      }
    };
  }, [flushMetrics]);

  const reportMetric = useCallback(
    (metric: NextWebVitalMetric) => {
      if (process.env.NODE_ENV !== 'production') return;

      const currentPath = pathnameRef.current || window.location.pathname;
      if (!isTrackedPath(currentPath)) return;
      if (!isSupportedMetric(metric.name)) return;

      metricsRef.current[metric.name] = {
        name: metric.name,
        value: roundMetricValue(metric.name, metric.value),
        rating: metric.rating as SupportedMetricRating,
        delta: roundMetricValue(metric.name, metric.delta),
        id: metric.id,
        navigationType:
          'navigationType' in metric && metric.navigationType
            ? String(metric.navigationType)
            : undefined,
      };

      scheduleFlush();
    },
    [scheduleFlush]
  );

  useReportWebVitals(reportMetric);

  return null;
}
