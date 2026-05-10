/**
 * POST /api/ai/nlq/extract-entities
 *
 * Groq llama-4-scout-17b로 쿼리에서 엔티티(server/metric/timeRange)를 추출.
 * 클래리피케이션 사전 차단에 사용됩니다.
 */

import { createGroq } from '@ai-sdk/groq';
import { generateText, Output } from 'ai';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  EXTRACTED_METRICS,
  EXTRACTED_TIME_RANGES,
  KNOWN_ENTITY_SERVER_IDS,
  SYSTEM_PROMPT,
} from '@/lib/ai/entity-extractor';
import { withAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logging';
import { rateLimiters, withRateLimit } from '@/lib/security/rate-limiter';

export const runtime = 'nodejs';
export const maxDuration = 10;

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const EntitySchema = z.object({
  server: z.enum(KNOWN_ENTITY_SERVER_IDS).nullable().optional(),
  metric: z.enum(EXTRACTED_METRICS).nullable().optional(),
  timeRange: z.enum(EXTRACTED_TIME_RANGES).nullable().optional(),
  confidence: z.number().min(0).max(100),
});

async function postHandler(request: NextRequest) {
  let query: unknown;

  try {
    ({ query } = await request.json());
  } catch {
    return NextResponse.json({ confidence: 0 }, { status: 400 });
  }

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return NextResponse.json({ confidence: 0 }, { status: 400 });
  }

  try {
    const { output } = await generateText({
      model: groq('llama-4-scout-17b-8e-instruct'),
      system: SYSTEM_PROMPT,
      prompt: query,
      temperature: 0,
      maxOutputTokens: 64,
      output: Output.object({
        schema: EntitySchema,
        name: 'nlq_entities',
        description:
          'Extract server, metric, time range, and confidence for monitoring clarification.',
      }),
    });

    return NextResponse.json({
      server: output.server ?? undefined,
      metric: output.metric ?? undefined,
      timeRange: output.timeRange ?? undefined,
      confidence: output.confidence,
    });
  } catch (error) {
    logger.warn('[AI NLQ] entity extraction provider fallback', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ confidence: 0 }, { status: 200 });
  }
}

export const POST = withRateLimit(
  rateLimiters.aiAnalysis,
  withAuth(postHandler)
);
