import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateServerLogs } from '@/services/server-data/server-data-loader';
import type { Server } from '@/types/server';
import { useGlobalLogs } from './useGlobalLogs';

vi.mock('@/services/server-data/server-data-loader', () => ({
  generateServerLogs: vi.fn(),
}));

const mockedGenerateServerLogs = vi.mocked(generateServerLogs);

function createServer(id: string): Server {
  return {
    id,
    name: id,
    status: 'online',
    cpu: 50,
    memory: 40,
    disk: 30,
    network: 20,
    uptime: 1_000,
    location: 'seoul',
  };
}

describe('useGlobalLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGenerateServerLogs.mockImplementation((_metrics, serverId) => [
      {
        timestamp: '2026-02-13T10:00:00.000Z',
        level: 'info',
        source: 'systemd',
        message: `log-${serverId}`,
      },
    ]);
  });

  it('서버 수가 동일해도 서버 목록 변경 시 로그를 즉시 갱신한다', async () => {
    const { result, rerender } = renderHook(
      ({ servers }) => useGlobalLogs(servers, {}),
      {
        initialProps: {
          servers: [createServer('server-a')],
        },
      }
    );

    await waitFor(() => {
      expect(result.current.logs[0]?.serverId).toBe('server-a');
    });

    rerender({
      servers: [createServer('server-b')],
    });

    await waitFor(() => {
      expect(result.current.logs[0]?.serverId).toBe('server-b');
      expect(result.current.logs[0]?.message).toBe('log-server-b');
    });
  });

  it('로그 생성 에러를 노출하고 retry로 복구할 수 있다', async () => {
    let shouldFail = true;
    mockedGenerateServerLogs.mockImplementation((_metrics, serverId) => {
      if (serverId === 'server-b' && shouldFail) {
        throw new Error('log generator failed');
      }
      return [
        {
          timestamp: '2026-02-13T10:00:00.000Z',
          level: 'info',
          source: 'systemd',
          message: `log-${serverId}`,
        },
      ];
    });

    const { result } = renderHook(({ servers }) => useGlobalLogs(servers, {}), {
      initialProps: {
        servers: [createServer('server-a'), createServer('server-b')],
      },
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.errorMessage).toContain('log generator failed');
      expect(
        result.current.logs.some((log) => log.serverId === 'server-a')
      ).toBe(true);
    });

    shouldFail = false;
    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(false);
      expect(result.current.errorMessage).toBeNull();
      expect(
        result.current.logs.some((log) => log.serverId === 'server-b')
      ).toBe(true);
    });
  });
});
