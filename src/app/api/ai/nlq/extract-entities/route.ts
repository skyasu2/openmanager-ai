/**
 * POST /api/ai/nlq/extract-entities
 *
 * Groq llama-4-scout-17b로 쿼리에서 엔티티(server/metric/timeRange)를 추출.
 * 클래리피케이션 사전 차단에 사용됩니다.
 */

import { createGroq } from '@ai-sdk/groq';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { SYSTEM_PROMPT } from '@/lib/ai/entity-extractor';

export const runtime = 'nodejs';
export const maxDuration = 10;

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const EntitySchema = z.object({
  server: z.string().nullable().optional(),
  metric: z.enum(['cpu', 'memory', 'disk', 'network']).nullable().optional(),
  timeRange: z.enum(['1h', '6h', '24h', '7d']).nullable().optional(),
  confidence: z.number().min(0).max(100),
});

export async function POST(request: Request) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ confidence: 0 }, { status: 400 });
    }

    const { object } = await generateObject({
      model: groq('llama-4-scout-17b-8e-instruct'),
      system: SYSTEM_PROMPT,
      prompt: query,
      schema: EntitySchema,
    });

    return NextResponse.json({
      server: object.server ?? undefined,
      metric: object.metric ?? undefined,
      timeRange: object.timeRange ?? undefined,
      confidence: object.confidence,
    });
  } catch {
    return NextResponse.json({ confidence: 0 }, { status: 200 });
  }
}
