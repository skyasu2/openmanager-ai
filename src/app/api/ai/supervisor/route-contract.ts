import type { NextResponse } from 'next/server';

export const LEGACY_SUPERVISOR_ROUTE_CONTRACT = 'legacy-supervisor';
export const PRIMARY_SUPERVISOR_ROUTE = '/api/ai/supervisor/stream/v2';

export type LegacySupervisorTransport = 'json' | 'text';

export function applyLegacySupervisorRouteHeaders(
  response: NextResponse,
  transport: LegacySupervisorTransport
): NextResponse {
  response.headers.set('X-AI-Route-Contract', LEGACY_SUPERVISOR_ROUTE_CONTRACT);
  response.headers.set('X-AI-Primary-Route', PRIMARY_SUPERVISOR_ROUTE);
  response.headers.set('X-AI-Transport', transport);
  return response;
}
