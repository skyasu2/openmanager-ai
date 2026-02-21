/**
 * Next.js API Routes Handlers
 *
 * Next.js API 라우트를 모킹합니다.
 *
 * @endpoint http://localhost:3002/api/*
 */

import { HttpResponse, http } from 'msw';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';

/**
 * Next.js API Routes 핸들러
 */
export const nextJsApiHandlers = [
  /**
   * AI Warm-up ping
   *
   * Some hooks fire-and-forget POST/HEAD /api/ai/wake-up requests.
   * Add host-agnostic handlers to avoid unhandled-request warnings in tests.
   */
  http.post(/\/api\/ai\/wake-up$/, () => {
    return HttpResponse.json(
      {
        status: 'ok',
        warmedUp: true,
      },
      {
        status: 200,
        headers: {
          'X-Warmup': 'mocked',
        },
      }
    );
  }),

  http.head(/\/api\/ai\/wake-up$/, () => {
    return new HttpResponse(null, {
      status: 200,
      headers: {
        'X-Warmup': 'mocked',
      },
    });
  }),

  /**
   * AI Supervisor Stream API v2 - UIMessageStream (Resumable)
   *
   * @example POST /api/ai/supervisor/stream/v2
   *
   * Returns AI SDK v6 UIMessageStream with resumable stream support
   */
  http.post(`${BASE_URL}/api/ai/supervisor/stream/v2`, async ({ request }) => {
    let body: {
      messages: Array<{ role: string; content: string }>;
      sessionId?: string;
    };

    try {
      body = (await request.json()) as typeof body;
    } catch {
      console.log('[MSW] Supervisor Stream API - Malformed JSON');
      return new HttpResponse(
        'data: {"type":"error","data":{"code":"INVALID_JSON","error":"Malformed JSON"}}\n\n',
        {
          status: 400,
          headers: { 'Content-Type': 'text/event-stream' },
        }
      );
    }

    const userMessage = body.messages?.find((m) => m.role === 'user');
    const query = userMessage?.content || '';

    console.log(
      `[MSW] Supervisor Stream v2 API: query="${query.slice(0, 50)}..."`
    );

    // SSE 스트림 생성
    const encoder = new TextEncoder();

    // 스트림 이벤트 생성
    const events = [
      // 1. Agent status: thinking
      {
        type: 'agent_status',
        data: { agent: 'Orchestrator', status: 'thinking' },
      },
      // 2. Text delta (시작)
      { type: 'text_delta', data: '서버 상태를 ' },
      // 3. Handoff event
      {
        type: 'handoff',
        data: {
          from: 'OpenManager Orchestrator',
          to: 'NLQ Agent',
          reason: '서버 메트릭 조회',
        },
      },
      // 4. Agent status: processing
      {
        type: 'agent_status',
        data: { agent: 'NLQ Agent', status: 'processing' },
      },
      // 5. Tool call event
      {
        type: 'tool_call',
        data: {
          toolName: 'getServerMetrics',
          toolCallId: 'call_mock_001',
          args: { serverId: 'web-server-01' },
        },
      },
      // 6. Tool result event
      {
        type: 'tool_result',
        data: {
          toolCallId: 'call_mock_001',
          toolName: 'getServerMetrics',
          result: { cpu: 45, memory: 67, disk: 23, status: 'online' },
        },
      },
      // 7. More text deltas
      { type: 'text_delta', data: '확인하고 있습니다.\n\n' },
      { type: 'text_delta', data: '**서버 상태 요약**\n' },
      { type: 'text_delta', data: '- CPU: 45%\n' },
      { type: 'text_delta', data: '- 메모리: 67%\n' },
      { type: 'text_delta', data: '- 디스크: 23%\n' },
      // 8. Step finish event
      {
        type: 'step_finish',
        data: { stepNumber: 1, totalSteps: 1 },
      },
      // 9. Done event
      {
        type: 'done',
        data: {
          success: true,
          finalAgent: 'NLQ Agent',
          toolsCalled: ['getServerMetrics'],
          usage: { promptTokens: 150, completionTokens: 80 },
          metadata: { durationMs: 1200, provider: 'cerebras' },
        },
      },
    ];

    // SSE 형식으로 변환
    const sseData = events
      .map((event) => `data: ${JSON.stringify(event)}\n\n`)
      .join('');

    return new HttpResponse(encoder.encode(sseData), {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Session-Id': body.sessionId || 'mock-session',
        'X-Backend': 'mock-stream-v2',
        'X-Stream-Protocol': 'ui-message-stream',
        'X-Resumable': 'true',
      },
    });
  }),

  /**
   * AI Supervisor API - Cloud Run Multi-Agent Supervisor
   *
   * @example POST /api/ai/supervisor
   */
  http.post(`${BASE_URL}/api/ai/supervisor`, async ({ request }) => {
    let body: {
      query: string;
      engine: string;
      context?: Array<{ role: string; content: string }>;
    };

    // JSON 파싱 에러 처리 (malformed JSON)
    try {
      body = (await request.json()) as {
        query: string;
        engine: string;
        context?: Array<{ role: string; content: string }>;
      };
    } catch {
      console.log(`[MSW] Next.js AI Query API - Malformed JSON detected`);
      return HttpResponse.json(
        {
          error: 'Invalid JSON format',
          status: 400,
        },
        { status: 400 }
      );
    }

    console.log(`[MSW] Next.js AI Query API Mocked: query="${body.query}"`);

    // 빈 쿼리 검증
    if (!body.query || body.query.trim() === '') {
      return HttpResponse.json(
        {
          error: '쿼리를 입력해주세요',
          status: 400,
        },
        { status: 400 }
      );
    }

    // v4.0: engine 필드가 없거나 유효하지 않아도 UNIFIED로 처리 (하위 호환성)
    const engine = body.engine || 'UNIFIED';

    // 지원하지 않는 엔진 검증 (v4.0에서는 무시하고 UNIFIED 사용하지만, 로그는 남김)
    const supportedEngines = ['UNIFIED', 'GOOGLE', 'OPENAI', 'COHERE'];
    if (!supportedEngines.includes(engine)) {
      console.log(
        `[MSW] Unsupported engine requested: ${engine}, falling back to UNIFIED`
      );
    }

    // 성공 응답 (Mock)
    return HttpResponse.json(
      {
        response: `[Mock AI Response] 질문: "${body.query}"\n\n서버 상태가 정상입니다.`,
        metadata: {
          model: 'mock-model',
          tokens: {
            input: Math.floor(body.query.length / 4),
            output: 50,
            total: Math.floor(body.query.length / 4) + 50,
          },
          latency: 100,
          timestamp: new Date().toISOString(),
        },
        context: body.context || [],
      },
      { status: 200 }
    );
  }),

  /**
   * MCP Query API (Deprecated)
   *
   * @example POST /api/mcp/query
   */
  http.post(`${BASE_URL}/api/mcp/query`, async ({ request }) => {
    const body = (await request.json()) as {
      query: string;
      context?: Array<{ role: string; content: string }>;
    };

    console.log(
      `[MSW] Next.js MCP Query API Mocked (503): query="${body.query}"`
    );

    // MCP API는 삭제됨 - 503 반환
    return HttpResponse.json(
      {
        error: 'MCP API는 더 이상 사용되지 않습니다',
        status: 503,
      },
      { status: 503 }
    );
  }),

  /**
   * Metrics API
   * @example GET /api/metrics
   */
  http.get(`${BASE_URL}/api/metrics`, () => {
    return HttpResponse.json({
      totalServers: 10,
      onlineServers: 8,
      warningServers: 1,
      offlineServers: 1,
      averageCpu: 45.5,
      averageMemory: 67.3,
      averageDisk: 23.1,
      totalAlerts: 3,
      timestamp: new Date().toISOString(),
    });
  }),

  /**
   * System API (Unified)
   * @example GET /api/system
   * @example POST /api/system { action: 'start' | 'stop' | 'restart' }
   */
  http.get(`${BASE_URL}/api/system`, () => {
    return HttpResponse.json({
      success: true,
      timestamp: Date.now(),
      source: 'mock',
      state: {
        isRunning: true,
        activeUsers: 5,
        version: '1.0.0',
        environment: 'development',
      },
    });
  }),

  http.post(`${BASE_URL}/api/system`, async ({ request }) => {
    const body = (await request.json()) as { action: string; mode?: string };
    console.log(`[MSW] System API action: ${body.action}`);

    return HttpResponse.json({
      success: true,
      message: `System ${body.action} completed`,
      timestamp: Date.now(),
    });
  }),

  /**
   * Servers List API
   * @example GET /api/servers/all
   */
  http.get(`${BASE_URL}/api/servers/all`, () => {
    return HttpResponse.json({
      success: true,
      data: Array.from({ length: 10 }, (_, i) => ({
        id: `server-${i + 1}`,
        name: `Test Server ${i + 1}`,
        hostname: `test-${i + 1}.local`,
        status: i < 8 ? 'online' : i === 8 ? 'warning' : 'offline',
        cpu: 45,
        memory: 67,
        disk: 23,
      })),
    });
  }),

  /**
   * Dashboard API
   * @example GET /api/dashboard
   */
  http.get(`${BASE_URL}/api/dashboard`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        servers: {},
        stats: {
          totalServers: 10,
          onlineServers: 8,
        },
      },
    });
  }),

  /**
   * Servers Unified API (통합 서버 관리 API)
   * @example GET /api/servers-unified?action=list&limit=10
   */
  http.get(`${BASE_URL}/api/servers-unified`, ({ request }) => {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'list';
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);

    // action별 응답 분기
    if (action === 'detail') {
      const serverId = url.searchParams.get('serverId');
      if (!serverId) {
        return HttpResponse.json(
          { success: false, error: 'serverId is required for detail action' },
          { status: 400 }
        );
      }
      return HttpResponse.json({
        success: true,
        data: {
          id: serverId,
          name: `Server ${serverId}`,
          hostname: `${serverId}.local`,
          status: 'online',
          cpu: 45.2,
          memory: 67.8,
          disk: 23.5,
          network: 12.3,
          uptime: 86400,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // list, cached, realtime 등 목록 응답
    return HttpResponse.json({
      success: true,
      data: Array.from({ length: Math.min(limit, 10) }, (_, i) => ({
        id: `server-${i + 1}`,
        name: `Test Server ${i + 1}`,
        hostname: `test-${i + 1}.local`,
        status: i < 8 ? 'online' : i === 8 ? 'warning' : 'offline',
        cpu: 20 + Math.random() * 60,
        memory: 30 + Math.random() * 50,
        disk: 40 + Math.random() * 40,
        network: 5 + Math.random() * 20,
      })),
      pagination: {
        page: 1,
        limit,
        total: 10,
        totalPages: Math.ceil(10 / limit),
      },
      timestamp: new Date().toISOString(),
    });
  }),

  /**
   * AI Status API (Circuit Breaker 상태)
   * @example GET /api/ai/status
   */
  http.get(`${BASE_URL}/api/ai/status`, ({ request }) => {
    const url = new URL(request.url);
    const service = url.searchParams.get('service');

    if (service) {
      // 특정 서비스 상태
      return HttpResponse.json({
        service,
        status: {
          state: 'CLOSED',
          failures: 0,
          lastFailure: null,
          isOpen: false,
        },
        events: [],
        timestamp: Date.now(),
      });
    }

    // 전체 상태 요약
    return HttpResponse.json({
      summary: {
        totalServices: 3,
        healthyServices: 3,
        degradedServices: 0,
        unhealthyServices: 0,
      },
      services: {
        google: { state: 'CLOSED', failures: 0, isOpen: false },
        openai: { state: 'CLOSED', failures: 0, isOpen: false },
        cohere: { state: 'CLOSED', failures: 0, isOpen: false },
      },
      recentEvents: [],
      timestamp: Date.now(),
    });
  }),

  /**
   * Database API (Unified)
   * @example GET /api/database
   * @example POST /api/database { action: 'health_check' | 'reset_pool' }
   */
  http.get(`${BASE_URL}/api/database`, () => {
    return HttpResponse.json({
      success: true,
      healthy: true,
      primary: {
        status: 'online',
        host: 'db.supabase.co',
        connections: { active: 5, idle: 10, total: 15 },
      },
      pool: {
        size: 20,
        available: 15,
        waiting: 0,
      },
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(`${BASE_URL}/api/database`, async ({ request }) => {
    let body: { action: string };

    // JSON 파싱 에러 처리 (malformed JSON)
    try {
      body = (await request.json()) as { action: string };
    } catch {
      console.log(`[MSW] Database API - Malformed JSON detected`);
      return HttpResponse.json(
        { error: 'Invalid JSON format', status: 400 },
        { status: 400 }
      );
    }

    console.log(`[MSW] Database API action: ${body.action}`);

    return HttpResponse.json({
      success: true,
      message: `Database ${body.action} completed`,
      timestamp: Date.now(),
    });
  }),

  /**
   * Health API with service parameter
   * @example GET /api/health
   * @example GET /api/health?simple=true
   * @example GET /api/health?service=ai
   */
  http.get(`${BASE_URL}/api/health`, ({ request }) => {
    const url = new URL(request.url);
    const service = url.searchParams.get('service');
    const simple = url.searchParams.get('simple');

    // 경량 헬스 체크 (simple=true)
    if (simple === 'true') {
      return HttpResponse.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
      });
    }

    // AI/Cloud Run 서비스 헬스 체크
    if (service === 'ai' || service === 'cloudrun') {
      return HttpResponse.json({
        status: 'ok',
        backend: 'cloud-run',
        latency: 150,
        timestamp: new Date().toISOString(),
      });
    }

    // Full health check
    return HttpResponse.json({
      success: true,
      data: {
        status: 'healthy',
        services: {
          database: { status: 'connected', latency: 10 },
          cache: { status: 'connected', latency: 5 },
          ai: { status: 'connected', latency: 15 },
        },
        uptime: 86400,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      },
    });
  }),
];
