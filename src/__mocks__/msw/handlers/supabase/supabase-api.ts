/**
 * Supabase API Handlers
 *
 * Supabase PostgreSQL REST API를 모킹합니다.
 *
 * @endpoint https://{project}.supabase.co/rest/v1
 * @see https://supabase.com/docs/guides/api
 */

import { HttpResponse, http } from 'msw';

// .env.local에서 Supabase URL 가져오기
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://vnswjnltnhpsueosfhmw.supabase.co';

/**
 * Supabase API 핸들러
 */
export const supabaseHandlers = [
  /**
   * Base REST endpoint health probe
   *
   * Some connectivity checks call `/rest/v1/` directly.
   */
  http.get(`${SUPABASE_URL}/rest/v1/`, () => {
    return HttpResponse.json(
      {
        message: 'Supabase REST mock endpoint',
      },
      { status: 200 }
    );
  }),

  /**
   * Select Query - 테이블 조회
   *
   * @example GET /rest/v1/servers?select=*
   */
  http.get(`${SUPABASE_URL}/rest/v1/:table`, ({ params, request }) => {
    const { table } = params;
    const url = new URL(request.url);
    const select = url.searchParams.get('select');

    console.log(
      `[MSW] Supabase Select Mocked: table=${String(table)}, select=${String(select)}`
    );

    // 테이블별 Mock 데이터
    const mockData: Record<string, unknown[]> = {
      servers: [
        {
          id: 'mock-server-1',
          name: 'Mock Server 1',
          status: 'running',
          cpu_usage: 45,
          memory_usage: 60,
          created_at: new Date().toISOString(),
        },
        {
          id: 'mock-server-2',
          name: 'Mock Server 2',
          status: 'stopped',
          cpu_usage: 0,
          memory_usage: 0,
          created_at: new Date().toISOString(),
        },
      ],
      incidents: [
        {
          id: 'mock-incident-1',
          title: 'Mock Incident',
          description: 'Test incident for MSW',
          severity: 'medium',
          status: 'open',
          created_at: new Date().toISOString(),
        },
      ],
    };

    return HttpResponse.json(mockData[table as string] || [], {
      status: 200,
    });
  }),

  /**
   * Insert Query - 데이터 삽입
   *
   * @example POST /rest/v1/servers
   */
  http.post(`${SUPABASE_URL}/rest/v1/:table`, async ({ params, request }) => {
    const { table } = params;
    const body = (await request.json()) as
      | Record<string, unknown>
      | Record<string, unknown>[];

    console.log(
      `[MSW] Supabase Insert Mocked: table=${String(table)}, data=${JSON.stringify(body).substring(0, 50)}...`
    );

    // Mock 삽입 응답 (삽입된 데이터 반환)
    return HttpResponse.json(
      Array.isArray(body)
        ? body.map((item) => ({ id: `mock-${Date.now()}`, ...item }))
        : { id: `mock-${Date.now()}`, ...body },
      { status: 201 }
    );
  }),

  /**
   * Update Query - 데이터 수정
   *
   * @example PATCH /rest/v1/servers?id=eq.123
   */
  http.patch(`${SUPABASE_URL}/rest/v1/:table`, async ({ params, request }) => {
    const { table } = params;
    const body = await request.json();
    const url = new URL(request.url);
    const filters = Array.from(url.searchParams.entries());

    console.log(
      `[MSW] Supabase Update Mocked: table=${String(table)}, filters=${JSON.stringify(filters)}`
    );

    // Mock 수정 응답
    return HttpResponse.json(body, { status: 200 });
  }),

  /**
   * Delete Query - 데이터 삭제
   *
   * @example DELETE /rest/v1/servers?id=eq.123
   */
  http.delete(`${SUPABASE_URL}/rest/v1/:table`, ({ params, request }) => {
    const { table } = params;
    const url = new URL(request.url);
    const filters = Array.from(url.searchParams.entries());

    console.log(
      `[MSW] Supabase Delete Mocked: table=${String(table)}, filters=${JSON.stringify(filters)}`
    );

    // Mock 삭제 응답
    return HttpResponse.json(null, { status: 204 });
  }),

  /**
   * RPC Call - Stored Procedure 호출
   *
   * @example POST /rest/v1/rpc/function_name
   */
  http.post(`${SUPABASE_URL}/rest/v1/rpc/:functionName`, async ({ params }) => {
    const { functionName } = params;

    console.log(`[MSW] Supabase RPC Mocked: function=${String(functionName)}`);

    // Mock RPC 응답
    return HttpResponse.json(
      {
        result: 'mock-rpc-result',
        success: true,
      },
      { status: 200 }
    );
  }),
];
