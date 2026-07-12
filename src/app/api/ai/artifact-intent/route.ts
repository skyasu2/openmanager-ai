import {
  createMistral,
  type MistralLanguageModelOptions,
} from '@ai-sdk/mistral';
import { generateText, Output } from 'ai';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withArtifactIntentRuleVersion } from '@/lib/ai/chat-artifacts/artifact-intent-contract';
import { withAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logging';
import { rateLimiters, withRateLimit } from '@/lib/security/rate-limiter';
import {
  classifyChatArtifactIntent,
  shouldUseLLMChatArtifactIntent,
} from './deterministic';

export const maxDuration = 5;

// Small Mistral model for low-cost artifact intent classification.
const CLASSIFIER_MODEL = 'ministral-3b-latest';
const CLASSIFIER_TIMEOUT_MS = 3000;
const MISTRAL_SCALE_PLAN_CONFIRMED_VALUE = 'true';

const SYSTEM_PROMPT = `Classify the user query. Choose exactly one category:
- "incident-report": user wants to generate/write/create/export a failure or incident report document
- "monitoring-analysis": user wants anomaly detection, trend analysis, risk analysis, or failure prediction
- "none": anything else (status questions, general chat, how-to questions, etc.)`;

const IntentSchema = z.object({
  kind: z.enum(['incident-report', 'monitoring-analysis', 'none']),
});

function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'
  );
}

function isProductionClassifierAllowed(): boolean {
  if (!isProductionRuntime()) {
    return true;
  }

  // Free-tier guard: production use of the Tier2 classifier requires an
  // explicit plan confirmation so a deploy cannot silently depend on it.
  return (
    process.env.MISTRAL_SCALE_PLAN_CONFIRMED ===
    MISTRAL_SCALE_PLAN_CONFIRMED_VALUE
  );
}

async function handler(request: NextRequest): Promise<NextResponse> {
  let query: string;
  try {
    const body = await request.json();
    query = typeof body.query === 'string' ? body.query.trim() : '';
  } catch {
    return NextResponse.json({ kind: 'none', reason: 'invalid_request' });
  }

  if (!query) {
    return NextResponse.json({ kind: 'none', reason: 'empty_query' });
  }

  const deterministicIntent = classifyChatArtifactIntent(query);
  if (deterministicIntent.kind !== 'none') {
    return NextResponse.json(deterministicIntent);
  }

  if (!shouldUseLLMChatArtifactIntent(query)) {
    return NextResponse.json({ kind: 'none', reason: 'local_gate_none' });
  }
  if (!isProductionClassifierAllowed()) {
    return NextResponse.json({
      kind: 'none',
      reason: 'production_llm_gate_disabled',
    });
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ kind: 'none', reason: 'llm_unavailable' });
  }

  try {
    const mistral = createMistral({ apiKey });
    const { output } = await generateText({
      model: mistral(CLASSIFIER_MODEL),
      output: Output.object({
        schema: IntentSchema,
        name: 'artifact_intent',
        description:
          'Classify whether the query should open a report or monitoring analysis artifact flow.',
      }),
      instructions: SYSTEM_PROMPT,
      prompt: query,
      temperature: 0,
      maxOutputTokens: 24,
      providerOptions: {
        mistral: {
          strictJsonSchema: true,
          structuredOutputs: true,
        } satisfies MistralLanguageModelOptions,
      },
      timeout: CLASSIFIER_TIMEOUT_MS,
    });

    if (
      output.kind === 'incident-report' ||
      output.kind === 'monitoring-analysis'
    ) {
      return NextResponse.json(
        withArtifactIntentRuleVersion(
          {
            kind: output.kind,
            reason: 'llm_artifact_classification',
          },
          'bff'
        )
      );
    }
    return NextResponse.json({ kind: 'none', reason: 'llm_none' });
  } catch (error) {
    logger.warn('[AI artifact intent] classifier fallback', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ kind: 'none', reason: 'llm_unavailable' });
  }
}

export const POST = withAuth(withRateLimit(rateLimiters.aiAnalysis, handler));
