/**
 * RAG ON/OFF evaluation script for monitoring-assistant queries.
 *
 * Goal:
 * - Compare retrieval quality, latency, and token-cost proxy between:
 *   1) GraphRAG ON  (useGraphRAG=true)
 *   2) GraphRAG OFF (useGraphRAG=false; vector fallback path)
 *
 * Usage:
 *   npx tsx scripts/rag-eval-onoff.ts
 *
 * Notes:
 * - Automatically loads ENV_FILE, .env.local, .env (near scripts/cwd)
 *
 * Optional env:
 *   RAG_EVAL_QUERIES="CPU 급증 원인 분석||메모리 누수 대응||docker logs 명령어"
 */

import { performance } from 'node:perf_hooks';
import './_env';
import { searchKnowledgeBase } from '../src/tools-ai-sdk/reporter-tools/knowledge';

type SourceType = 'vector' | 'graph' | 'web' | 'fallback' | string;

type RagItem = {
  title: string;
  category: string;
  sourceType: SourceType;
  similarity: number;
  content: string;
};

type RagRunResult = {
  success: boolean;
  latencyMs: number;
  totalFound: number;
  topSimilarity: number;
  commandRatio: number;
  contextChars: number;
  estimatedTokens: number;
  sourceTypeCounts: Record<string, number>;
  resultCategories: Record<string, number>;
  error?: string;
};

type ScenarioSummary = {
  label: 'rag_on' | 'rag_off';
  runs: number;
  successRuns: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  avgTopSimilarity: number;
  avgTotalFound: number;
  avgCommandRatio: number;
  avgContextChars: number;
  avgEstimatedTokens: number;
};

const DEFAULT_QUERIES = [
  'CPU 사용률 급증 원인 분석',
  '메모리 누수 의심 대응 방안',
  'DB timeout 증가 원인과 확인 순서',
  'Redis 캐시 장애 시 점검 절차',
  '네트워크 지연이 높을 때 1차 대응',
  '디스크 용량 90% 초과 시 복구 절차',
  'docker logs 명령어와 사용법',
  'kubectl get pods 문제 진단 방법',
] as const;

function parseQueriesFromEnv(): string[] {
  const raw = process.env.RAG_EVAL_QUERIES;
  if (!raw) return [...DEFAULT_QUERIES];
  return raw
    .split('||')
    .map((q) => q.trim())
    .filter((q) => q.length > 0);
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function parseRagItems(output: unknown): RagItem[] {
  const root = asObject(output);
  if (!root) return [];
  const rawResults = root.results;
  if (!Array.isArray(rawResults)) return [];

  const parsed: RagItem[] = [];
  for (const item of rawResults) {
    const row = asObject(item);
    if (!row) continue;
    parsed.push({
      title: String(row.title ?? ''),
      category: String(row.category ?? 'unknown'),
      sourceType: String(row.sourceType ?? 'unknown'),
      similarity: Number(row.similarity ?? 0),
      content: String(row.content ?? ''),
    });
  }
  return parsed;
}

function toTokenEstimate(chars: number): number {
  // Lightweight proxy for Korean/English mixed text context.
  // (exact tokenizer cost requires provider tokenizer integration)
  return Math.ceil(chars / 4);
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item);
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

async function runScenario(
  query: string,
  mode: 'rag_on' | 'rag_off'
): Promise<RagRunResult> {
  const start = performance.now();

  try {
    const output = await searchKnowledgeBase.execute!(
      {
        query,
        useGraphRAG: mode === 'rag_on',
        fastMode: true,
        includeWebSearch: false,
      },
      { toolCallId: `rag-eval-${mode}`, messages: [] }
    );

    const items = parseRagItems(output);
    const latencyMs = performance.now() - start;
    const contextChars = items.reduce((acc, item) => acc + item.content.length, 0);
    const commandCount = items.filter((item) => item.category === 'command').length;

    return {
      success: true,
      latencyMs,
      totalFound: items.length,
      topSimilarity: items[0]?.similarity ?? 0,
      commandRatio: items.length > 0 ? commandCount / items.length : 0,
      contextChars,
      estimatedTokens: toTokenEstimate(contextChars),
      sourceTypeCounts: countBy(items, (item) => String(item.sourceType)),
      resultCategories: countBy(items, (item) => item.category),
    };
  } catch (error) {
    return {
      success: false,
      latencyMs: performance.now() - start,
      totalFound: 0,
      topSimilarity: 0,
      commandRatio: 0,
      contextChars: 0,
      estimatedTokens: 0,
      sourceTypeCounts: {},
      resultCategories: {},
      error: String(error),
    };
  }
}

function summarizeScenario(label: 'rag_on' | 'rag_off', runs: RagRunResult[]): ScenarioSummary {
  const successRuns = runs.filter((r) => r.success);
  const latencies = successRuns.map((r) => r.latencyMs);
  return {
    label,
    runs: runs.length,
    successRuns: successRuns.length,
    avgLatencyMs: average(latencies),
    p95LatencyMs: percentile(latencies, 95),
    avgTopSimilarity: average(successRuns.map((r) => r.topSimilarity)),
    avgTotalFound: average(successRuns.map((r) => r.totalFound)),
    avgCommandRatio: average(successRuns.map((r) => r.commandRatio)),
    avgContextChars: average(successRuns.map((r) => r.contextChars)),
    avgEstimatedTokens: average(successRuns.map((r) => r.estimatedTokens)),
  };
}

async function main() {
  const queries = parseQueriesFromEnv();
  if (queries.length === 0) {
    throw new Error('No queries provided');
  }

  console.log(`RAG evaluation started: queries=${queries.length}`);

  const perQuery: Array<{
    query: string;
    rag_on: RagRunResult;
    rag_off: RagRunResult;
  }> = [];

  for (const query of queries) {
    const ragOn = await runScenario(query, 'rag_on');
    const ragOff = await runScenario(query, 'rag_off');
    perQuery.push({ query, rag_on: ragOn, rag_off: ragOff });
  }

  const ragOnSummary = summarizeScenario(
    'rag_on',
    perQuery.map((r) => r.rag_on)
  );
  const ragOffSummary = summarizeScenario(
    'rag_off',
    perQuery.map((r) => r.rag_off)
  );

  const delta = {
    latency_ms: ragOnSummary.avgLatencyMs - ragOffSummary.avgLatencyMs,
    top_similarity: ragOnSummary.avgTopSimilarity - ragOffSummary.avgTopSimilarity,
    total_found: ragOnSummary.avgTotalFound - ragOffSummary.avgTotalFound,
    command_ratio: ragOnSummary.avgCommandRatio - ragOffSummary.avgCommandRatio,
    estimated_tokens: ragOnSummary.avgEstimatedTokens - ragOffSummary.avgEstimatedTokens,
  };

  console.log('\n=== Per Query (rag_on vs rag_off) ===');
  for (const row of perQuery) {
    console.log(
      JSON.stringify({
        query: row.query,
        rag_on: {
          success: row.rag_on.success,
          latency_ms: Math.round(row.rag_on.latencyMs),
          found: row.rag_on.totalFound,
          top_similarity: Number(row.rag_on.topSimilarity.toFixed(4)),
          estimated_tokens: row.rag_on.estimatedTokens,
        },
        rag_off: {
          success: row.rag_off.success,
          latency_ms: Math.round(row.rag_off.latencyMs),
          found: row.rag_off.totalFound,
          top_similarity: Number(row.rag_off.topSimilarity.toFixed(4)),
          estimated_tokens: row.rag_off.estimatedTokens,
        },
      })
    );
  }

  console.log('\n=== Summary ===');
  console.log(JSON.stringify(ragOnSummary, null, 2));
  console.log(JSON.stringify(ragOffSummary, null, 2));

  console.log('\n=== Delta (rag_on - rag_off) ===');
  console.log(JSON.stringify(delta, null, 2));

  console.log('\n=== Note ===');
  console.log(
    'top_similarity is not directly comparable across modes because rag_on uses weighted hybrid score (vector+text+graph) while rag_off uses vector similarity from search_knowledge_base.'
  );
}

main().catch((error) => {
  console.error('[FATAL] rag-eval-onoff failed:', error);
  process.exit(1);
});
