import { NextRequest, NextResponse } from 'next/server';
import { rateLimiters, withRateLimit } from '@/lib/security/rate-limiter';
import { getSupabaseServerUrl } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';
import { probeSupabaseSession } from '@/lib/supabase/session-probe';
import { getErrorMessage } from '@/types/type-utils';

// MIGRATED: Removed export const runtime = "nodejs" (default)
// MIGRATED: Removed export const dynamic = "force-dynamic" (now default)

const CONNECTION_TIMEOUT_MS = 3000;
const DATABASE_HEALTH_CACHE_TTL_SECONDS = 15;

type DbStatus = 'online' | 'offline';
type DatabaseHealthPayload = {
  success: boolean;
  healthy: boolean;
  primary: {
    status: DbStatus;
    host: string;
    latencyMs: number;
  };
  pool: {
    size: number;
    available: number;
    waiting: number;
  };
  message?: string;
  timestamp: string;
};

interface DatabaseHealthCacheEntry {
  payload: DatabaseHealthPayload;
  timestamp: number;
}

let databaseHealthCache: DatabaseHealthCacheEntry | null = null;

function getDatabaseHealthCacheHeaders(cacheStatus: 'HIT' | 'MISS') {
  return {
    'Cache-Control': `public, max-age=${DATABASE_HEALTH_CACHE_TTL_SECONDS}, stale-while-revalidate=${DATABASE_HEALTH_CACHE_TTL_SECONDS}`,
    'X-Cache': cacheStatus,
  };
}

function isDatabaseHealthCacheValid(): boolean {
  return (
    databaseHealthCache !== null &&
    Date.now() - databaseHealthCache.timestamp <
      DATABASE_HEALTH_CACHE_TTL_SECONDS * 1000
  );
}

async function getDatabaseHealth(): Promise<{
  status: DbStatus;
  healthy: boolean;
  latencyMs: number;
  message?: string;
}> {
  const start = Date.now();

  try {
    const supabase = await createClient();
    const probeResult = await probeSupabaseSession(supabase, {
      timeoutMs: CONNECTION_TIMEOUT_MS,
      timeoutMessage: 'Database check timeout',
    });

    if (!probeResult.reachable) {
      return {
        status: 'offline',
        healthy: false,
        latencyMs: Date.now() - start,
        message: probeResult.errorMessage,
      };
    }

    return {
      status: 'online',
      healthy: true,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'offline',
      healthy: false,
      latencyMs: Date.now() - start,
      message: getErrorMessage(error),
    };
  }
}

function getDatabaseHost(): string {
  const url = getSupabaseServerUrl();
  if (!url) return 'supabase';

  try {
    return new URL(url).host;
  } catch {
    return 'supabase';
  }
}

async function databaseHealthHandler() {
  if (isDatabaseHealthCacheValid() && databaseHealthCache) {
    return NextResponse.json(databaseHealthCache.payload, {
      status: databaseHealthCache.payload.healthy ? 200 : 503,
      headers: getDatabaseHealthCacheHeaders('HIT'),
    });
  }

  const health = await getDatabaseHealth();
  const payload: DatabaseHealthPayload = {
    success: health.healthy,
    healthy: health.healthy,
    primary: {
      status: health.status,
      host: getDatabaseHost(),
      latencyMs: health.latencyMs,
    },
    pool: {
      size: 0,
      available: 0,
      waiting: 0,
    },
    ...(health.message ? { message: health.message } : {}),
    timestamp: new Date().toISOString(),
  };

  if (health.healthy) {
    databaseHealthCache = {
      payload,
      timestamp: Date.now(),
    };
  }

  return NextResponse.json(payload, {
    status: health.healthy ? 200 : 503,
    headers: getDatabaseHealthCacheHeaders('MISS'),
  });
}

const limitedDatabaseHealthHandler = withRateLimit(
  rateLimiters.monitoring,
  databaseHealthHandler
);

export function GET(
  request: NextRequest = new NextRequest('http://localhost/api/database')
) {
  return limitedDatabaseHealthHandler(request);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { action?: string };
    const action = body?.action;

    if (action === 'health_check') {
      return GET(request);
    }

    if (action === 'reset_pool') {
      return NextResponse.json({
        success: true,
        message:
          'Connection pool reset is managed automatically in serverless runtime.',
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      { success: false, error: `Unsupported action: ${action ?? 'undefined'}` },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON format' },
      { status: 400 }
    );
  }
}
