export interface ApiNotReadyResponse {
  body: {
    error: string;
    message: string;
    retryAfterSeconds: number;
    timestamp: string;
  };
  status: 503;
  headers: {
    'Retry-After': string;
  };
}

const API_RETRY_AFTER_SECONDS = 2;

export function shouldBlockApiRequest(
  requestPath: string,
  routesReady: boolean
): boolean {
  return requestPath.startsWith('/api/') && !routesReady;
}

export function buildApiNotReadyResponse(
  now = new Date()
): ApiNotReadyResponse {
  return {
    body: {
      error: 'Service warming up',
      message: 'API routes are still loading. Please retry shortly.',
      retryAfterSeconds: API_RETRY_AFTER_SECONDS,
      timestamp: now.toISOString(),
    },
    status: 503,
    headers: {
      'Retry-After': String(API_RETRY_AFTER_SECONDS),
    },
  };
}
