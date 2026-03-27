/**
 * @vitest-environment jsdom
 *
 * useSystemStatus 단위 테스트
 *
 * 모듈 레벨 singleton store를 vi.resetModules()로 격리하여
 * 테스트 간 상태 누출을 방지한다.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logging', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

type UseSystemStatusFn = typeof import('./useSystemStatus').useSystemStatus;
type SystemStatusType = typeof import('./useSystemStatus').SystemStatus;

let useSystemStatus: UseSystemStatusFn;
let fetchSpy: ReturnType<typeof vi.spyOn>;

const makeStatus = (
  overrides?: Partial<SystemStatusType>
): SystemStatusType => ({
  isRunning: true,
  isStarting: false,
  lastUpdate: '2026-01-01T00:00:00Z',
  userCount: 1,
  version: '8.10.0',
  environment: 'production',
  uptime: 3600,
  services: { database: true, cache: true, ai: true },
  ...overrides,
});

const okResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const errorResponse = (status: number) => new Response('error', { status });

beforeEach(async () => {
  vi.resetModules();
  // Note: vi.useFakeTimers()는 waitFor()와 충돌 — 타이머 필요 테스트에만 로컬 적용
  fetchSpy = vi.spyOn(global, 'fetch');
  const mod = await import('./useSystemStatus');
  useSystemStatus = mod.useSystemStatus;
});

afterEach(() => {
  fetchSpy.mockRestore();
  vi.useRealTimers();
});

describe('useSystemStatus', () => {
  describe('초기 상태', () => {
    it('초기에는 isLoading=true, status=null을 반환한다', async () => {
      fetchSpy.mockResolvedValueOnce(okResponse(makeStatus()));

      const { result } = renderHook(() => useSystemStatus());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.status).toBeNull();
      expect(result.current.error).toBeNull();

      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });

    it('fetch 성공 후 status가 채워진다', async () => {
      const status = makeStatus({ userCount: 5 });
      fetchSpy.mockResolvedValueOnce(okResponse(status));

      const { result } = renderHook(() => useSystemStatus());

      await waitFor(() => expect(result.current.status).not.toBeNull());
      expect(result.current.status?.userCount).toBe(5);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('에러 처리', () => {
    it('fetch HTTP 에러 시 error 상태가 설정된다', async () => {
      fetchSpy.mockResolvedValueOnce(errorResponse(500));

      const { result } = renderHook(() => useSystemStatus());

      await waitFor(() => expect(result.current.error).not.toBeNull());
      expect(result.current.error).toContain('500');
      expect(result.current.isLoading).toBe(false);
    });

    it('네트워크 에러 시 error 상태가 설정된다', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('network failure'));

      const { result } = renderHook(() => useSystemStatus());

      await waitFor(() => expect(result.current.error).not.toBeNull());
      expect(result.current.error).toBe('network failure');
    });
  });

  describe('refresh', () => {
    it('refresh() 호출 시 fetch를 다시 보낸다', async () => {
      fetchSpy
        .mockResolvedValueOnce(okResponse(makeStatus({ userCount: 1 })))
        .mockResolvedValueOnce(okResponse(makeStatus({ userCount: 99 })));

      const { result } = renderHook(() => useSystemStatus());
      await waitFor(() => expect(result.current.status?.userCount).toBe(1));

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.status?.userCount).toBe(99);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('refresh() 중에는 isLoading=true가 된다', async () => {
      let resolveSecond!: (v: Response) => void;
      fetchSpy
        .mockResolvedValueOnce(okResponse(makeStatus()))
        .mockImplementationOnce(
          () =>
            new Promise<Response>((res) => {
              resolveSecond = res;
            })
        );

      const { result } = renderHook(() => useSystemStatus());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        void result.current.refresh();
      });
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSecond(okResponse(makeStatus({ userCount: 2 })));
      });
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('startSystem', () => {
    it('startSystem() 호출 시 POST 후 GET으로 상태를 갱신한다', async () => {
      fetchSpy
        .mockResolvedValueOnce(okResponse(makeStatus({ isRunning: false }))) // 초기 GET
        .mockResolvedValueOnce(okResponse({ ok: true })) // POST start
        .mockResolvedValueOnce(okResponse(makeStatus({ isRunning: true }))); // 갱신 GET

      const { result } = renderHook(() => useSystemStatus());
      await waitFor(() => expect(result.current.status?.isRunning).toBe(false));

      await act(async () => {
        await result.current.startSystem();
      });

      expect(result.current.status?.isRunning).toBe(true);
      // POST + GET 호출 확인
      const calls = fetchSpy.mock.calls;
      const postCall = calls.find(
        ([, opts]) => (opts as RequestInit)?.method === 'POST'
      );
      expect(postCall).toBeDefined();
    });

    it('startSystem() POST 실패 시 error가 설정된다', async () => {
      fetchSpy
        .mockResolvedValueOnce(okResponse(makeStatus())) // 초기 GET
        .mockResolvedValueOnce(errorResponse(503)); // POST 실패

      const { result } = renderHook(() => useSystemStatus());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.startSystem();
      });

      expect(result.current.error).not.toBeNull();
    });

    it('isLoading 중에는 startSystem()이 중복 실행되지 않는다', async () => {
      let resolve!: (v: Response) => void;
      fetchSpy.mockImplementation(
        () =>
          new Promise<Response>((res) => {
            resolve = res;
          })
      );

      const { result } = renderHook(() => useSystemStatus());

      // 첫 번째 호출(로딩 중) — isLoading=true이므로 startSystem 내부에서 guard
      act(() => {
        void result.current.startSystem();
      });

      // POST가 호출되지 않아야 한다 (isLoading=true guard)
      const postsBefore = fetchSpy.mock.calls.filter(
        ([, opts]) => (opts as RequestInit)?.method === 'POST'
      ).length;
      expect(postsBefore).toBe(0);

      // cleanup
      await act(async () => {
        resolve(okResponse(makeStatus()));
      });
    });
  });

  describe('중복 fetch 방지', () => {
    it('in-flight fetch가 있으면 중복 요청을 보내지 않는다', async () => {
      let resolveFirst!: (v: Response) => void;
      fetchSpy.mockImplementation(
        () =>
          new Promise<Response>((res) => {
            resolveFirst = res;
          })
      );

      const { result } = renderHook(() => useSystemStatus());
      // 첫 번째 fetch 진행 중
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // refresh도 호출하지만 in-flight 이므로 추가 fetch 없음
      void result.current.refresh();
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveFirst(okResponse(makeStatus()));
      });
    });
  });
});
