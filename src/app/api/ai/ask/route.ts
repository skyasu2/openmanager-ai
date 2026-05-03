import { NextRequest, NextResponse } from 'next/server';
import { POST as incidentReportPost } from '../incident-report/route';
import { POST as intelligentMonitoringPost } from '../intelligent-monitoring/route';
import { POST as jobsPost } from '../jobs/route';
import {
  GET as supervisorStreamGet,
  POST as supervisorStreamPost,
} from '../supervisor/stream/v2/route';

export const maxDuration = 60;

type AskTransport =
  | 'stream'
  | 'job'
  | 'incident-report'
  | 'monitoring-analysis';

const ASK_DELEGATED_ROUTES: Record<AskTransport, string> = {
  stream: '/api/ai/supervisor/stream/v2',
  job: '/api/ai/jobs',
  'incident-report': '/api/ai/incident-report',
  'monitoring-analysis': '/api/ai/intelligent-monitoring',
};

type AskBody = Record<string, unknown> & {
  transport?: unknown;
  target?: unknown;
};

function readAskTransport(body: AskBody): AskTransport | null {
  const transport = body.transport ?? body.target ?? 'stream';
  if (
    transport === 'stream' ||
    transport === 'job' ||
    transport === 'incident-report' ||
    transport === 'monitoring-analysis'
  ) {
    return transport;
  }
  return null;
}

function stripAskFacadeFields(body: AskBody): Record<string, unknown> {
  const { target: _target, transport: _transport, ...delegatedBody } = body;
  return delegatedBody;
}

function createDelegatedHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  headers.delete('content-length');
  return headers;
}

function createDelegatedPostRequest(
  request: NextRequest,
  delegatedRoute: string,
  body: Record<string, unknown>
): NextRequest {
  return new NextRequest(new URL(delegatedRoute, request.url), {
    method: 'POST',
    headers: createDelegatedHeaders(request),
    body: JSON.stringify(body),
  });
}

function createDelegatedGetRequest(
  request: NextRequest,
  delegatedRoute: string
): NextRequest {
  const delegatedUrl = new URL(delegatedRoute, request.url);
  const requestUrl = new URL(request.url);
  requestUrl.searchParams.forEach((value, key) => {
    delegatedUrl.searchParams.append(key, value);
  });

  return new NextRequest(delegatedUrl, {
    method: 'GET',
    headers: createDelegatedHeaders(request),
  });
}

function withAskFacadeHeaders(
  response: Response,
  delegatedRoute: string
): Response {
  const headers = new Headers(response.headers);
  headers.set('X-AI-Ask-Facade', 'wrapper');
  headers.set('X-AI-Ask-Delegated-Route', delegatedRoute);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function delegateAskRequest(
  request: NextRequest,
  transport: AskTransport,
  body: Record<string, unknown>
): Promise<Response> {
  const delegatedRoute = ASK_DELEGATED_ROUTES[transport];
  const delegatedRequest = createDelegatedPostRequest(
    request,
    delegatedRoute,
    body
  );

  switch (transport) {
    case 'stream':
      return withAskFacadeHeaders(
        await supervisorStreamPost(delegatedRequest),
        delegatedRoute
      );
    case 'job':
      return withAskFacadeHeaders(
        await jobsPost(delegatedRequest),
        delegatedRoute
      );
    case 'incident-report':
      return withAskFacadeHeaders(
        await incidentReportPost(delegatedRequest),
        delegatedRoute
      );
    case 'monitoring-analysis':
      return withAskFacadeHeaders(
        await intelligentMonitoringPost(delegatedRequest),
        delegatedRoute
      );
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: AskBody;

  try {
    body = (await request.json()) as AskBody;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON payload' },
      { status: 400 }
    );
  }

  const transport = readAskTransport(body);
  if (!transport) {
    return NextResponse.json(
      { success: false, error: 'Unsupported ask transport' },
      { status: 400 }
    );
  }

  return delegateAskRequest(request, transport, stripAskFacadeFields(body));
}

export async function GET(request: NextRequest): Promise<Response> {
  const delegatedRoute = ASK_DELEGATED_ROUTES.stream;
  return withAskFacadeHeaders(
    await supervisorStreamGet(
      createDelegatedGetRequest(request, delegatedRoute)
    ),
    delegatedRoute
  );
}
