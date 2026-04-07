/**
 * Vitest setup for the Node-only suite.
 *
 * Keep this lighter than src/test/setup.ts:
 * - no jest-dom / jest-axe / React globals
 * - only mocks that backend/node tests commonly rely on
 */

import {
  ReadableStream as NodeReadableStream,
  TransformStream as NodeTransformStream,
  WritableStream as NodeWritableStream,
} from 'node:stream/web';
import { vi } from 'vitest';
import {
  createSupabaseMock,
  SupabaseMockBuilder,
} from './helpers/supabase-mock';

if (typeof globalThis.ReadableStream === 'undefined') {
  Object.defineProperty(globalThis, 'ReadableStream', {
    value: NodeReadableStream,
    writable: true,
  });
}

if (typeof globalThis.WritableStream === 'undefined') {
  Object.defineProperty(globalThis, 'WritableStream', {
    value: NodeWritableStream,
    writable: true,
  });
}

if (typeof globalThis.TransformStream === 'undefined') {
  Object.defineProperty(globalThis, 'TransformStream', {
    value: NodeTransformStream,
    writable: true,
  });
}

vi.mock('@/lib/supabase/client', () => {
  return createSupabaseMock(
    new SupabaseMockBuilder()
      .withData([])
      .withError(null)
      .withCustomResponse('rpc', {
        data: [
          {
            id: '1',
            content: 'Test content',
            similarity: 0.85,
            metadata: { category: 'test' },
          },
        ],
        error: null,
      })
  );
});

const mockServerData = {
  id: 'server-1',
  name: 'Web Server 01',
  hostname: 'web01.example.com',
  type: 'web',
  environment: 'production',
  location: 'OnPrem-DC1-AZ1',
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

globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
  const resolvedUrl =
    typeof input === 'string'
      ? input
      : input instanceof Request
        ? input.url
        : input.toString();
  const jsonPayload = {
    data: {
      response: 'Mock AI response',
      confidence: 0.9,
    },
  };

  const createMockResponse = () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(jsonPayload),
    text: () => Promise.resolve('Mock text response'),
    headers: new Headers(),
    url: resolvedUrl,
    clone: () => createMockResponse(),
  });

  return Promise.resolve(createMockResponse());
}) as typeof fetch;
