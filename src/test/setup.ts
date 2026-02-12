/**
 * Vitest Test Setup
 * DOM testing 환경 설정
 */

import React from 'react';
import { expect, vi } from 'vitest';
import '@testing-library/jest-dom';

// React를 global에 추가 (jsdom 환경에서 JSX 지원)
globalThis.React = React;

import { toHaveNoViolations } from 'jest-axe';
import {
  createSupabaseMock,
  SupabaseMockBuilder,
} from './helpers/supabase-mock';

// jest-axe matcher 등록
expect.extend(toHaveNoViolations);

// Supabase Client Mock - 향상된 Builder 패턴 사용
vi.mock('@/lib/supabase/client', () => {
  return createSupabaseMock(
    new SupabaseMockBuilder()
      .withData([])
      .withError(null)
      .withCustomResponse('rpc', {
        data: [{ id: '1', content: 'Test content', similarity: 0.85, metadata: { category: 'test' } }],
        error: null,
      })
  );
});

// UnifiedServerDataSource Mock - 테스트용 서버 데이터 포함
const mockServerData = {
  id: 'server-1',
  name: 'Web Server 01',
  hostname: 'web01.example.com',
  type: 'web',
  environment: 'production',
  location: '서울',
  provider: 'AWS',
  status: 'online',
  cpu: 45.2,
  memory: 62.8,
  disk: 73.5,
  network: 28.9,
  uptime: '24h 30m',
  lastUpdate: new Date(),
  services: [],
  incidents: [],
};

vi.mock('@/services/data/UnifiedServerDataSource', () => ({
  UnifiedServerDataSource: {
    getInstance: vi.fn(() => ({
      getServers: vi.fn().mockResolvedValue([mockServerData]),
      getServerById: vi.fn().mockImplementation((id: string) => {
        if (id === 'server-1') return Promise.resolve(mockServerData);
        return Promise.resolve(null);
      }),
      getMetrics: vi
        .fn()
        .mockResolvedValue({ cpu: 50, memory: 60, disk: 70, network: 30 }),
      getHistoricalMetrics: vi.fn().mockResolvedValue([
        {
          cpu: 45,
          memory: 60,
          disk: 70,
          network: 25,
          timestamp: Date.now() - 60000,
        },
        {
          cpu: 48,
          memory: 62,
          disk: 71,
          network: 28,
          timestamp: Date.now() - 30000,
        },
        { cpu: 50, memory: 60, disk: 70, network: 30, timestamp: Date.now() },
      ]),
    })),
  },
}));

// Logger Mock
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Logging Module Mock (unified logger)
vi.mock('@/lib/logging', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  },
  createModuleLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  browserLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  serverLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  loggerConfig: {
    level: 'info',
    enabled: false,
  },
  shouldLog: vi.fn(() => false),
}));

// Fetch Mock - 더 현실적인 응답
globalThis.fetch = vi.fn().mockImplementation((url: string) => {
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () =>
      Promise.resolve({
        data: {
          response: 'Mock AI response',
          confidence: 0.9,
        },
      }),
    text: () => Promise.resolve('Mock text response'),
    headers: new Headers(),
    url,
  });
}) as typeof fetch;

// Global mocks
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    get length() {
      return Object.keys(store).length;
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

Object.defineProperty(globalThis, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// IntersectionObserver Mock - 클래스 기반 (Next.js use-intersection.js 호환)
class IntersectionObserverMock implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);
}

Object.defineProperty(globalThis, 'IntersectionObserver', {
  value: IntersectionObserverMock,
  writable: true,
});

// ResizeObserver Mock - 클래스 기반
class ResizeObserverMock implements ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  value: ResizeObserverMock,
  writable: true,
});
