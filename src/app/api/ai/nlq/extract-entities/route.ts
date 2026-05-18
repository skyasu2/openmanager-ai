/**
 * POST /api/ai/nlq/extract-entities
 *
 * Groq Llama 4 Scout로 쿼리에서 엔티티(server/metric/timeRange)를 추출.
 * 클래리피케이션 사전 차단에 사용됩니다.
 *
 * Note: URL의 `nlq`는 Natural Language Query 기능 카테고리를 가리키는 feature slug이며,
 * Cloud Run의 에이전트 이름("Metrics Query Agent")과는 별개입니다.
 */

import { createGroq } from '@ai-sdk/groq';
import { generateText, Output } from 'ai';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { GROQ_TEXT_MODEL_ID } from '@/config/ai-providers';
import {
  KNOWN_ENTITY_SERVER_IDS,
  normalizeExtractedEntities,
  SEMANTIC_AGGREGATIONS,
  SEMANTIC_AMBIGUITIES,
  SEMANTIC_DOMAINS,
  SEMANTIC_EXECUTION_MODES,
  SEMANTIC_INTENTS,
  SEMANTIC_METRICS,
  SEMANTIC_SCOPES,
  SEMANTIC_TIME_WINDOWS,
  SYSTEM_PROMPT,
} from '@/lib/ai/entity-extractor';
import {
  BLOCKED_INPUT_MESSAGE,
  buildLogSummaryPrompt,
  runQueryGuard,
} from '@/lib/ai/query-guard';
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
  topN: z.number().int().positive().max(20).nullable(),
  ambiguity: z.enum(SEMANTIC_AMBIGUITIES),
  executionMode: z.enum(SEMANTIC_EXECUTION_MODES),
  confidence: z.number().min(0).max(100),
});

// OpenAI-compatible structured-output providers require every object property
// to be listed in JSON Schema `required`. Nullable fields keep the legacy
// response contract while avoiding provider-side schema rejection. The
// top-level metric/timeRange schema is intentionally tolerant because the
// normalizer still preserves only the legacy ExtractedMetric/ExtractedTimeRange
// slots; load/current variants live in intentFrame.
const EntitySchema = z.object({
  server: z.enum(KNOWN_ENTITY_SERVER_IDS).nullable(),
  metric: z.enum(SEMANTIC_METRICS).nullable(),
  timeRange: z.enum(SEMANTIC_TIME_WINDOWS).nullable(),
  intentFrame: SemanticIntentFrameSchema.nullable(),
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

  const guard = runQueryGuard(query);
  if (guard.verdict === 'block') {
    return NextResponse.json(
      {
        confidence: 0,
        blocked: true,
        blockReason: guard.blockReason,
        message: BLOCKED_INPUT_MESSAGE,
      },
      { status: 200 }
    );
  }

  const queryForLLM =
    guard.inputType === 'log_paste' || guard.inputType === 'mixed'
      ? buildLogSummaryPrompt(guard.logExtract ?? '', guard.sanitizedQuery)
      : guard.sanitizedQuery;

  try {
    const { output } = await generateText({
      model: groq(GROQ_TEXT_MODEL_ID),
      system: SYSTEM_PROMPT,
      prompt: queryForLLM,
      temperature: 0,
      maxOutputTokens: 160,
      output: Output.object({
        schema: EntitySchema,
        name: 'nlq_entities',
        description:
          'Extract monitoring entities and a semantic intent frame for clarification.',
      }),
    });

    return NextResponse.json({
      ...normalizeExtractedEntities(output),
      inputType: guard.inputType,
      ...(guard.logExtract && { logExtract: guard.logExtract }),
      ...(guard.truncated && { truncated: true }),
    });
  } catch (error) {
    logger.warn('[AI NLQ] entity extraction provider fallback', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        confidence: 0,
        inputType: guard.inputType,
        ...(guard.logExtract && { logExtract: guard.logExtract }),
        ...(guard.truncated && { truncated: true }),
      },
      { status: 200 }
    );
  }
}

export const POST = withRateLimit(
  rateLimiters.aiAnalysis,
  withAuth(postHandler)
);
