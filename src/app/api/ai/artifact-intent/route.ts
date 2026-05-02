import {
  createMistral,
  type MistralLanguageModelOptions,
} from '@ai-sdk/mistral';
import { generateObject } from 'ai';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { shouldUseLLMChatArtifactIntent } from '@/lib/ai/chat-artifacts/chat-artifact-intent';
import { withAuth } from '@/lib/auth/api-auth';
import { rateLimiters, withRateLimit } from '@/lib/security/rate-limiter';

export const maxDuration = 5;

// Small Mistral model for low-cost artifact intent classification.
const CLASSIFIER_MODEL = 'ministral-3b-latest';
const CLASSIFIER_TIMEOUT_MS = 3000;

const SYSTEM_PROMPT = `Classify the user query. Choose exactly one category:
- "incident-report": user wants to generate/write/create/export a failure or incident report document
- "monitoring-analysis": user wants anomaly detection, trend analysis, risk analysis, or failure prediction
- "none": anything else (status questions, general chat, how-to questions, etc.)`;

const IntentSchema = z.object({
  kind: z.enum(['incident-report', 'monitoring-analysis', 'none']),
});

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
  if (!shouldUseLLMChatArtifactIntent(query)) {
    return NextResponse.json({ kind: 'none', reason: 'local_gate_none' });
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ kind: 'none', reason: 'llm_unavailable' });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLASSIFIER_TIMEOUT_MS);

  try {
    const mistral = createMistral({ apiKey });
    const { object } = await generateObject({
      model: mistral(CLASSIFIER_MODEL),
      schema: IntentSchema,
      system: SYSTEM_PROMPT,
      prompt: query,
      temperature: 0,
      maxOutputTokens: 24,
      providerOptions: {
        mistral: {
          strictJsonSchema: true,
          structuredOutputs: true,
        } satisfies MistralLanguageModelOptions,
      },
      abortSignal: controller.signal,
    });

    if (
      object.kind === 'incident-report' ||
      object.kind === 'monitoring-analysis'
    ) {
      return NextResponse.json({
        kind: object.kind,
        reason: 'llm_artifact_classification',
      });
    }
    return NextResponse.json({ kind: 'none', reason: 'llm_none' });
  } catch {
    return NextResponse.json({ kind: 'none', reason: 'llm_unavailable' });
  } finally {
    clearTimeout(timeoutId);
  }
}

export const POST = withRateLimit(rateLimiters.aiAnalysis, withAuth(handler));
