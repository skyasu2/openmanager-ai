import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockStreamGet,
  mockStreamPost,
  mockJobsPost,
  mockIncidentReportPost,
  mockMonitoringPost,
} = vi.hoisted(() => ({
  mockStreamGet: vi.fn(),
  mockStreamPost: vi.fn(),
  mockJobsPost: vi.fn(),
  mockIncidentReportPost: vi.fn(),
  mockMonitoringPost: vi.fn(),
}));

vi.mock('../supervisor/stream/v2/route', () => ({
  GET: mockStreamGet,
  POST: mockStreamPost,
}));

vi.mock('../jobs/route', () => ({
  POST: mockJobsPost,
}));

vi.mock('../incident-report/route', () => ({
  POST: mockIncidentReportPost,
}));

vi.mock('../intelligent-monitoring/route', () => ({
  POST: mockMonitoringPost,
}));

import { GET, POST } from './route';

function createAskRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/ai/ask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Trace-Id': 'trace-ask-test',
    },
    body: JSON.stringify(body),
  });
}

async function readDelegatedJson(
  mockFn: typeof mockStreamPost
): Promise<Record<string, unknown>> {
  const request = mockFn.mock.calls[0]?.[0] as NextRequest | undefined;
  expect(request).toBeDefined();
  return (await request!.json()) as Record<string, unknown>;
}

describe('POST /api/ai/ask facade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates simple chat requests to the streaming route without changing metadata', async () => {
    mockStreamPost.mockResolvedValue(
      new Response('data: {"type":"done","data":{"success":true}}\n\n', {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'X-Stream-Protocol': 'ui-message-stream',
        },
      })
    );

    const body = {
      messages: [{ role: 'user', content: '서버 상태 알려줘' }],
      sessionId: 'session-ask-stream',
      analysisMode: 'thinking',
      queryAsOfDataSlot: { timeLabel: '2026-05-03 20:00 KST' },
      localRouteDecision: {
        intent: 'chat',
        executionPath: 'stream',
        complexity: 'simple',
        reasonCodes: ['complexity_below_threshold'],
        ruleVersion: '2026-05-03-v1',
        decidedBy: 'frontend',
      },
    };

    const response = await POST(createAskRequest(body));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    expect(response.headers.get('X-AI-Ask-Facade')).toBe('wrapper');
    expect(response.headers.get('X-AI-Ask-Delegated-Route')).toBe(
      '/api/ai/supervisor/stream/v2'
    );
    expect(mockStreamPost).toHaveBeenCalledTimes(1);
    expect(mockJobsPost).not.toHaveBeenCalled();

    await expect(readDelegatedJson(mockStreamPost)).resolves.toMatchObject(
      body
    );
  });

  it('delegates long-running requests to the existing job route and preserves plan metadata', async () => {
    let capturedJobBody: Record<string, unknown> | undefined;
    mockJobsPost.mockImplementation(async (request: NextRequest) => {
      const delegatedBody = (await request.json()) as {
        query: string;
        options?: {
          metadata?: Record<string, unknown>;
        };
      };
      capturedJobBody = delegatedBody as Record<string, unknown>;

      return Response.json(
        {
          jobId: 'job-ask-1',
          status: 'queued',
          routeDecision: delegatedBody.options?.metadata?.routeDecision,
          assistantPlan: delegatedBody.options?.metadata?.assistantPlan,
        },
        { status: 201 }
      );
    });

    const routeDecision = {
      intent: 'job',
      executionPath: 'job',
      reasonCodes: ['complexity_threshold_exceeded'],
      ruleVersion: '2026-05-03-v1',
      decidedBy: 'frontend',
    };
    const assistantPlan = {
      kind: 'chat',
      planVersion: '2026-05-03-v1',
      routeDecision,
      executionPath: 'job',
      job: true,
      stream: false,
      reasonCodes: ['complexity_threshold_exceeded'],
      decidedBy: 'frontend',
    };

    const response = await POST(
      createAskRequest({
        transport: 'job',
        query: '지난 24시간 전체 서버 장애 원인 분석 보고서 만들어줘',
        type: 'analysis',
        options: {
          sessionId: 'session-ask-job',
          metadata: {
            queryAsOfDataSlot: { timeLabel: '2026-05-03 20:00 KST' },
            routeDecision,
            assistantPlan,
          },
        },
      })
    );

    expect(response.status).toBe(201);
    expect(response.headers.get('X-AI-Ask-Delegated-Route')).toBe(
      '/api/ai/jobs'
    );
    const payload = await response.json();
    expect(payload).toMatchObject({
      jobId: 'job-ask-1',
      routeDecision,
      assistantPlan,
    });
    expect(capturedJobBody).not.toHaveProperty('transport');
  });

  it('delegates artifact-shaped requests to existing artifact routes and keeps result metadata', async () => {
    mockIncidentReportPost.mockImplementation(async (request: NextRequest) => {
      const delegatedBody = (await request.json()) as Record<string, unknown>;

      return Response.json({
        success: true,
        report: { id: 'incident-ask-1' },
        assistantPlan: delegatedBody.assistantPlan,
        assistantResult: delegatedBody.assistantResult,
      });
    });

    const assistantPlan = {
      kind: 'artifact',
      planVersion: '2026-05-03-v1',
      executionPath: 'client-artifact',
      executionMode: 'deterministic',
      stream: false,
      job: false,
      artifactKind: 'incident-report',
      reasonCodes: ['artifact_intent'],
      decidedBy: 'frontend',
    };
    const assistantResult = {
      kind: 'artifact',
      resultVersion: '2026-05-03-v1',
      status: 'completed',
      artifactKind: 'incident-report',
    };

    const response = await POST(
      createAskRequest({
        transport: 'incident-report',
        action: 'generate',
        severity: 'critical',
        assistantPlan,
        assistantResult,
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('X-AI-Ask-Delegated-Route')).toBe(
      '/api/ai/incident-report'
    );
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      assistantPlan,
      assistantResult,
    });
  });

  it('rejects unknown facade transport without calling downstream routes', async () => {
    const response = await POST(
      createAskRequest({
        transport: 'new-planner',
        query: '서버 상태 알려줘',
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: 'Unsupported ask transport',
    });
    expect(mockStreamPost).not.toHaveBeenCalled();
    expect(mockJobsPost).not.toHaveBeenCalled();
    expect(mockIncidentReportPost).not.toHaveBeenCalled();
    expect(mockMonitoringPost).not.toHaveBeenCalled();
  });
});

describe('GET /api/ai/ask facade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates stream resume requests to the existing streaming resume route', async () => {
    mockStreamGet.mockImplementation(async (request: NextRequest) => {
      return Response.json({
        delegatedUrl: request.url,
      });
    });

    const response = await GET(
      new NextRequest(
        'http://localhost/api/ai/ask?sessionId=session-ask-resume&skip=2',
        {
          method: 'GET',
          headers: {
            'X-Trace-Id': 'trace-ask-resume',
          },
        }
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('X-AI-Ask-Facade')).toBe('wrapper');
    expect(response.headers.get('X-AI-Ask-Delegated-Route')).toBe(
      '/api/ai/supervisor/stream/v2'
    );
    await expect(response.json()).resolves.toEqual({
      delegatedUrl:
        'http://localhost/api/ai/supervisor/stream/v2?sessionId=session-ask-resume&skip=2',
    });
  });
});
