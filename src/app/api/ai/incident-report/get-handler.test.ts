/**
 * @vitest-environment node
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockSupabaseFrom,
  mockSelect,
  mockEq,
  mockSingle,
  mockGte,
  mockOr,
  mockOrder,
  mockRange,
} = vi.hoisted(() => {
  const mockRange = vi.fn();
  const mockOrder = vi.fn(() => ({ range: mockRange }));
  const mockOr = vi.fn(() => ({ order: mockOrder }));
  const mockGte = vi.fn(() => ({ order: mockOrder, or: mockOr }));
  const mockEq = vi.fn();
  const mockSingle = vi.fn();
  const mockSelect = vi.fn();
  const mockSupabaseFrom = vi.fn();
  return {
    mockSupabaseFrom,
    mockSelect,
    mockEq,
    mockSingle,
    mockGte,
    mockOr,
    mockOrder,
    mockRange,
  };
});

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { from: mockSupabaseFrom },
}));

vi.mock('@/types/type-utils', () => ({
  getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

vi.mock('@/utils/debug', () => ({
  default: { info: vi.fn(), error: vi.fn() },
}));

import { getHandler } from './get-handler';

function createGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/ai/incident-report');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

describe('incident-report GET handler', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('id 파라미터로 단일 보고서를 조회한다', async () => {
    const mockReport = {
      id: 'report-1',
      title: 'CPU 과부하',
      severity: 'high',
    };
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockReport, error: null }),
        }),
      }),
    });

    const response = await getHandler(createGetRequest({ id: 'report-1' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.report.id).toBe('report-1');
    expect(data.timestamp).toBeDefined();
  });

  it('단일 보고서 조회 실패 시 500을 반환한다', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Not found'),
          }),
        }),
      }),
    });

    const response = await getHandler(createGetRequest({ id: 'nonexistent' }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Failed to retrieve reports');
  });

  it('페이지네이션 파라미터를 처리한다', async () => {
    const chainBuilder = {
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [{ id: 'r1' }, { id: 'r2' }],
        error: null,
        count: 15,
      }),
    };
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(chainBuilder),
    });

    const response = await getHandler(
      createGetRequest({ page: '2', limit: '5' })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.pagination.page).toBe(2);
    expect(data.pagination.limit).toBe(5);
    expect(data.pagination.total).toBe(15);
    expect(data.pagination.totalPages).toBe(3);
    expect(chainBuilder.range).toHaveBeenCalledWith(5, 9); // offset=5, limit=5
  });

  it('severity 필터를 적용한다', async () => {
    const chainBuilder = {
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      }),
    };
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(chainBuilder),
    });

    await getHandler(createGetRequest({ severity: 'critical' }));

    expect(chainBuilder.eq).toHaveBeenCalledWith('severity', 'critical');
  });

  it('검색어의 SQL 와일드카드를 이스케이프한다', async () => {
    const chainBuilder = {
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      }),
    };
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(chainBuilder),
    });

    await getHandler(createGetRequest({ search: '100%_test' }));

    const orCall = chainBuilder.or.mock.calls[0]?.[0] as string;
    expect(orCall).toContain('100\\%\\_test');
  });

  it('limit 상한은 50이다', async () => {
    const chainBuilder = {
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      }),
    };
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(chainBuilder),
    });

    await getHandler(createGetRequest({ limit: '100' }));

    // range(0, 49) → limit 50
    expect(chainBuilder.range).toHaveBeenCalledWith(0, 49);
  });
});
