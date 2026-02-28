/**
 * Runtime Log Level API
 *
 * GET  /api/admin/log-level → Current log level status (Vercel + Cloud Run)
 * PUT  /api/admin/log-level → Change log level at runtime with optional TTL
 */

import { type NextRequest, NextResponse } from 'next/server';
import { isCloudRunEnabled, proxyToCloudRun } from '@/lib/ai-proxy/proxy';
import { withAuth } from '@/lib/auth/api-auth';
import type { LogLevel } from '@/lib/logging';
import {
  getDefaultLogLevel,
  getRuntimeLogLevel,
  resetToDefaultLogLevel,
  setRuntimeLogLevel,
} from '@/lib/logging/runtime';

// MIGRATED: Removed export const runtime = "nodejs" (default)
export const maxDuration = 10;

const VALID_LEVELS: ReadonlySet<string> = new Set([
  'debug',
  'info',
  'warn',
  'error',
  'silent',
  'reset',
]);
const VALID_TARGETS = new Set(['vercel', 'cloud-run', 'all']);

async function getCloudRunLogLevel(): Promise<{
  level: string;
  reachable: boolean;
}> {
  if (!isCloudRunEnabled()) {
    return { level: 'unknown', reachable: false };
  }
  try {
    const result = await proxyToCloudRun({
      path: '/debug/log-level',
      method: 'GET',
      timeout: 5000,
    });
    if (result.success && result.data) {
      const data = result.data as { level: string };
      return { level: data.level, reachable: true };
    }
    return { level: 'unknown', reachable: false };
  } catch {
    return { level: 'unknown', reachable: false };
  }
}

export const GET = withAuth(async (_request: NextRequest) => {
  const cloudRun = await getCloudRunLogLevel();

  return NextResponse.json({
    vercel: {
      level: getRuntimeLogLevel(),
      defaultLevel: getDefaultLogLevel(),
    },
    cloudRun,
  });
});

export const PUT = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    level?: string;
    target?: string;
    ttlSeconds?: number;
  };

  const { level, target = 'all', ttlSeconds } = body;

  if (!level || !VALID_LEVELS.has(level)) {
    return NextResponse.json(
      { error: `Invalid level. Valid: ${[...VALID_LEVELS].join(', ')}` },
      { status: 400 }
    );
  }

  if (!VALID_TARGETS.has(target)) {
    return NextResponse.json(
      { error: `Invalid target. Valid: ${[...VALID_TARGETS].join(', ')}` },
      { status: 400 }
    );
  }

  const applied: { vercel?: string; cloudRun?: string } = {};
  let expiresAt: string | null = null;

  // Apply to Vercel
  if (target === 'vercel' || target === 'all') {
    if (level === 'reset') {
      resetToDefaultLogLevel();
      applied.vercel = getDefaultLogLevel();
    } else {
      setRuntimeLogLevel(level as LogLevel, ttlSeconds);
      applied.vercel = level;
    }

    if (level !== 'reset' && ttlSeconds && ttlSeconds > 0) {
      const clampedTtl = Math.min(ttlSeconds, 3600);
      expiresAt = new Date(Date.now() + clampedTtl * 1000).toISOString();
    }
  }

  // Proxy to Cloud Run
  if (target === 'cloud-run' || target === 'all') {
    if (isCloudRunEnabled()) {
      try {
        const result = await proxyToCloudRun({
          path: '/debug/log-level',
          method: 'PUT',
          body: { level, ttlSeconds },
          timeout: 5000,
        });
        if (result.success && result.data) {
          const data = result.data as { currentLevel: string; expiresAt?: string | null };
          applied.cloudRun = data.currentLevel;

          if (data.expiresAt) {
            expiresAt = data.expiresAt;
          }
        } else {
          applied.cloudRun = 'unreachable';
        }
      } catch {
        applied.cloudRun = 'unreachable';
      }
    } else {
      applied.cloudRun = 'disabled';
    }
  }

  return NextResponse.json({ applied, expiresAt });
});
