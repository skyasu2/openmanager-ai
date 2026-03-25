import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerUrl } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';
import { probeSupabaseSession } from '@/lib/supabase/session-probe';
import { getErrorMessage } from '@/types/type-utils';

// MIGRATED: Removed export const runtime = "nodejs" (default)
// MIGRATED: Removed export const dynamic = "force-dynamic" (now default)

const CONNECTION_TIMEOUT_MS = 3000;

type DbStatus = 'online' | 'offline';

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

export async function GET() {
  const health = await getDatabaseHealth();

  return NextResponse.json(
    {
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
    },
    { status: health.healthy ? 200 : 503 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { action?: string };
    const action = body?.action;

    if (action === 'health_check') {
      return GET();
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
