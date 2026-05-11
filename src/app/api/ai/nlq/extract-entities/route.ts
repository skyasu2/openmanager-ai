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
  normalizeExtractedEntities,
  SEMANTIC_AGGREGATIONS,
  SEMANTIC_AMBIGUITIES,
  SEMANTIC_DOMAINS,
  SEMANTIC_INTENTS,
  SEMANTIC_METRICS,
  SEMANTIC_SCOPES,
  SEMANTIC_TIME_WINDOWS,
  SYSTEM_PROMPT,
} from '@/lib/ai/entity-extractor';
import { withAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logging';
import { rateLimiters, withRateLimit } from '@/lib/security/rate-limiter';

// MIGRATED: Removed export const runtime = "nodejs" (default)
export const maxDuration = 10;

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const SemanticIntentFrameSchema = z.object({
  domain: z.enum(SEMANTIC_DOMAINS),
  intent: z.enum(SEMANTIC_INTENTS),
  scope: z.enum(SEMANTIC_SCOPES),
  targets: z.array(z.string()),
  metric: z.enum(SEMANTIC_METRICS),
  timeWindow: z.enum(SEMANTIC_TIME_WINDOWS),
  aggregation: z.enum(SEMANTIC_AGGREGATIONS),
  topN: z.number().int().positive().max(20).nullable().optional(),
  ambiguity: z.enum(SEMANTIC_AMBIGUITIES),
  confidence: z.number().min(0).max(100),
});

const EntitySchema = z.object({
  server: z.enum(KNOWN_ENTITY_SERVER_IDS).nullable().optional(),
  metric: z.enum(EXTRACTED_METRICS).nullable().optional(),
  timeRange: z.enum(EXTRACTED_TIME_RANGES).nullable().optional(),
  intentFrame: SemanticIntentFrameSchema.nullable().optional(),
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
      maxOutputTokens: 160,
      output: Output.object({
        schema: EntitySchema,
        name: 'nlq_entities',
        description:
          'Extract monitoring entities and a semantic intent frame for clarification.',
      }),
    });

    return NextResponse.json(normalizeExtractedEntities(output));
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
